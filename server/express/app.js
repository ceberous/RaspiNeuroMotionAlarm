const express = require( "express" );
const fs = require( "fs" );
const path = require( "path" );
const bodyParser = require( "body-parser" );
const cors = require( "cors" );
const wPORT = 6161;
function W_SLEEP( ms ) { return new Promise( resolve => setTimeout( resolve , ms ) ); }

var app = express();
app.use( express.static( path.join( __dirname , "client" ) ) );
app.use( cors( { origin: "http://localhost:" + wPORT.toString() } ) );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: true } ) );

const GenericUtils = require( "../utils/generic.js" );

const HTMLPath = path.join( __dirname , "../../client" , "index.html" );
console.log( HTMLPath );
app.get( "/" , function( req , res ) {
	res.sendFile( HTMLPath );
});

app.get( "/state" , function( req , res ) {
	const cur_state = GenericUtils.getState();
	res.json( cur_state );
	// res.json({ 
	// 	"state" : wState , "arg1": arg1 , "arg2": arg2 , "arg3": arg3, "arg4": arg4, 
	// 	"sHour" : startTime.hour, "sMinute": startTime.minute, "eHour" : stopTime.hour, "eMinute": stopTime.minute
	// });
});

app.get( "/restart" , function( req , res ) {
	GenericUtils.restartPYProcess();
	const cur_state = GenericUtils.getState();
	res.json( { "state" : cur_state.state } );
});

app.get( "/turnon" , function( req , res ) {
	const cur_state = GenericUtils.getState();
	if ( cur_state.state ) {
		console.log( "restarting" );
		GenericUtils.restartPYProcess();
	}
	else {
		console.log( "starting" );
		GenericUtils.startPYProcess();
	}
	res.json( { "state" : cur_state.state } );
});

app.get( "/turnoff" , function( req , res ) {
	GenericUtils.killAllPYProcess();
	const cur_state = GenericUtils.getState();
	res.json( { "state" : cur_state.state } );
});

app.post( "/setargs/" , function( req , res ) {
	var arg1 = arg2 = arg3 = arg4 = null;
	if (req.body.arg1.length >= 1) { arg1 = req.body.arg1; }
	if (req.body.arg2.length >= 1) { arg2 = req.body.arg2; }
	if (req.body.arg3.length >= 1) { arg3 = req.body.arg3; }
	if (req.body.arg4.length >= 1) { arg4 = req.body.arg4; }
	GenericUtils.setArgs( arg1 , arg2 , arg3 , arg4 );
	console.log( "new args = " + arg1 + " " + arg2 + " " + arg3 + " " + arg4  );
	var cur_state = GenericUtils.getState();
	if ( cur_state.state ) {
		GenericUtils.restartPYProcess();
	}
	cur_state = GenericUtils.getState();
	res.json( cur_state );
});

const HTML_Live_Path = path.join( __dirname , "../../client/views/" , "live.html" );
app.get( "/live" , function( req , res ) {
	res.sendFile( HTML_Live_Path );
});

const FramePATH = path.join( __dirname , "../../client" , "frame.jpeg" );
app.get( "/live_image" , async function( req , res , next ) {
	fs.readFile( FramePATH , function( err , data ) {
		if ( err) { throw err; }
		else {
			res.writeHead( 200 , {'Content-Type': 'image/jpeg'} );
			res.write( data );
			res.end();
		}
	});
});

const HTML_Latest_Video_Path = path.join( __dirname , "../../client/views/" , "video.html" );
app.get( "/video" , function( req , res ) {
	res.sendFile( HTML_Latest_Video_Path );
});

var latest_video_path = "";
function SET_LATEST_VIDEO_PATH( wPath ) {
	if ( wPath ) {
		if ( wPath !== null ) {
			if ( wPath !== "null" ) {
				console.log( "Setting latest_video_path --> " + wPath );
				latest_video_path = wPath;
			}
		}
	}	
}
app.setLatestVideoPath = SET_LATEST_VIDEO_PATH;

app.get( "/latest" , async function( req , res , next ) {
	
	console.log( latest_video_path );
	if ( req.query.path ) {
		if ( req.query.path !== null ) {
			if ( req.query.path !== "null" ) {
				latest_video_path = req.query.path;
				latest_video_path = latest_video_path.split( "-" );
			}
		}
	}
	console.log( req.query );
	console.log( latest_video_path );
	
	// fs.readFileSync( latest_video_path , function( err , data ) {
	// 	if ( err) { throw err; }
	// 	else {
	// 		res.writeHead( 200 , {'Content-Type': 'video/mp4'} );
	// 		res.write( data );
	// 		res.end();
	// 	}
	// });

	if ( !latest_video_path ) { res.json( { "conversion" : "failed" } ); }
	if ( !latest_video_path[ 0 ] ) { res.json( { "conversion" : "failed" } ); }
	if ( !latest_video_path[ 1 ] ) { res.json( { "conversion" : "failed" } ); }

	var filePath = path.join( __dirname , "../../RECORDS" , latest_video_path[ 0 ] , latest_video_path[ 1 ] , "video.mp4" );
	console.log( "Recieved File Path === " );
	console.log( filePath );

	//res.json( { "testing" : filePath } );

	fs.stat( filePath , function(err, stats) {
		if ( err ) {
			if ( err.code === 'ENOENT' ) {
				// 404 Error if file not found
				//return res.sendStatus(404);
				res.end( err ); // I added this
			}
			res.end( err );
		}

		var range = req.headers.range;

		if ( !range ) {
			// 416 Wrong range
			//return res.sendStatus(416);
			console.log('Err: It seems like someone tried to download the video.');
			res.end( err );
		}
		else{
			var positions   = range.replace(/bytes=/, "").split("-");
			var start       = parseInt(positions[0], 10);
			var total       = stats.size;
			var end         = positions[1] ? parseInt(positions[1], 10) : total - 1;
			var chunksize   = (end - start) + 1;

			res.writeHead( 206, {
				"Content-Range": "bytes " + start + "-" + end + "/" + total ,
				"Accept-Ranges": "bytes" ,
				"Content-Length": chunksize ,
				"Content-Type": "video/mp4"
			});

			var stream = fs.createReadStream( filePath , {
				start: start,
				end: end
			}).on("open", function() {
				stream.pipe(res);
			}).on("error", function(err) {
				res.end(err);
			});
		}
	});

});

/*
const FramePATH = path.join( __dirname , "../../client" , "frame.jpeg" );
app.get( "/live" , async function( req , res , next ) {
	console.log( "begin" );
	res.writeHead( 200 , {'Content-Type': 'image/jpeg'} );
	wTimeout = false;
	setTimeout( function() {
		console.log( "end timeout" );
		wTimeout = true;
	} , 30000 );
	console.log( "start while()" );
	while( !wTimeout ) {
		fs.readFile( FramePATH , function( err , data ) {
			if ( err) { throw err; }
			else {
				res.write( data );
				next();
			}
		});
		await W_SLEEP( 300 );
	}
	console.log( "end" );
	res.end();

});
*/

module.exports = app;