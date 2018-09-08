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

const LVID_FP = path.join( __dirname , "latest_video_id.txt" );
app.get( "/latest" , async function( req , res , next ) {

	var latest_video_path = undefined;
		
	if ( req.query ) {
		if ( req.query.path ) {
			if ( req.query.path !== null ) {
				if ( req.query.path !== "null" ) {
					latest_video_path = req.query.path;
					latest_video_path = latest_video_path.split( "-" );
					console.log( "Recieved An Update from URL param" );
				}
			}		
		}
	}
	
	if ( latest_video_path === undefined ) {
		console.log( "Blank URL Params , Reading from File" );
		latest_video_path = fs.readFileSync( LVID_FP ).toString().split( "\n" )[ 0 ];
		latest_video_path = latest_video_path.split( "-" );		
	}
	console.log( latest_video_path );

	if ( !latest_video_path ) { res.json( { "conversion" : "failed" } ); return; }
	if ( !latest_video_path[ 0 ] ) { res.json( { "conversion" : "failed" } ); return; }
	if ( !latest_video_path[ 1 ] ) { res.json( { "conversion" : "failed" } ); return; }

	var filePath = path.join( __dirname , "../../RECORDS" , latest_video_path[ 0 ] , latest_video_path[ 1 ] , "video.mp4" );
	console.log( "Recieved File Path === " );
	console.log( filePath );

	fs.stat( filePath , function( err , stats ) {

		var range = req.headers.range;
		var parts = range.replace(/bytes=/, "").split("-");
		var partialstart = parts[0];
		var partialend = parts[1];
		var total = stats.size;
		var start = parseInt(partialstart, 10);
		var end = partialend ? parseInt(partialend, 10) : total - 1;
		var chunksize = (end - start) + 1;
		var mimeType = mimeTypes[extension] || 'text/plain; charset=utf-8';
		res.writeHead( 206, {
			'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
			'Accept-Ranges': 'bytes',
			'Content-Length': chunksize,
			'Content-Type': mimeType
		});
		var fileStream = fs.createReadStream(file, {
			start: start,
			end: end
		});
		fileStream.pipe(res);
		res.on('close', function() {
			console.log('response closed');
			if (res.fileStream) {
				res.fileStream.unpipe(this);
				if (this.fileStream.fd) {
					fs.close(this.fileStream.fd);
				}
			}
		});
		
		return;
	});


	// fs.stat( filePath , function(err, stats) {
	// 	if ( err ) {
	// 		if ( err.code === 'ENOENT' ) {
	// 			// 404 Error if file not found
	// 			//return res.sendStatus(404);
	// 			res.end( err ); // I added this
	// 		}
	// 		res.end( err );
	// 	}

	// 	var range = req.headers.range;

	// 	if ( !range ) {
	// 		// 416 Wrong range
	// 		//return res.sendStatus(416);
	// 		console.log('Err: It seems like someone tried to download the video.');
	// 		res.end( err );
	// 	}
	// 	else{
	// 		var positions   = range.replace(/bytes=/, "").split("-");
	// 		var start       = parseInt(positions[0], 10);
	// 		var total       = stats.size;
	// 		var end         = positions[1] ? parseInt(positions[1], 10) : total - 1;
	// 		var chunksize   = (end - start) + 1;

	// 		res.writeHead( 206, {
	// 			"Content-Range": "bytes " + start + "-" + end + "/" + total ,
	// 			"Accept-Ranges": "bytes" ,
	// 			"Content-Length": chunksize ,
	// 			"Content-Type": "video/mp4"
	// 		});

	// 		var stream = fs.createReadStream( filePath , {
	// 			start: start,
	// 			end: end
	// 		}).on("open", function() {
	// 			stream.pipe(res);
	// 		}).on("error", function(err) {
	// 			res.end(err);
	// 		});
	// 	}

	// });

});

module.exports = app;