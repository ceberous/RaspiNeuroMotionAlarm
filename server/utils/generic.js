require("shelljs/global");
const spawn = require( "child_process" ).spawn;
const ps = require( "ps-node" );
const path = require( "path" );
const fs = require( "fs" );

var arg1 = 1 	// = Minimum Seconds of Continuous Motion
var arg2 = 4 	// = Total Motion Events Acceptable Before Alert
var arg3 = 45 	// = Minimum Time of Motion Before Alert
var arg4 = 90 	// = Cooloff Period Duration
const lCode1 = path.join( __dirname , "../../py_scripts" , "motionSave.py" );
console.log( lCode1 );
var wState = false;
var wChild = null;
var wFFMPEG_Child = null;
var wPIDResultSet = [];

const MonthNames = [ "JAN" , "FEB" , "MAR" , "APR" , "MAY" , "JUN" , "JUL" , "AUG" , "SEP" , "OCT" , "NOV" , "DEC" ];
function GET_NOW_TIME() {
	const today = new Date();
	var day = today.getDate();
	if ( parseInt( day ) < 10 ) { day = "0" + day; }
	const month = MonthNames[ today.getMonth() ];
	const year = today.getFullYear();
	var hours = today.getHours();
	if ( parseInt( hours ) < 10 ) { hours = "0" + hours; }
	var minutes = today.getMinutes();
	if ( parseInt( minutes ) < 10 ) { minutes = "0" + minutes; }
	var seconds = today.getSeconds();
	if ( parseInt( seconds ) < 10 ) { seconds = "0" + seconds; }
	var milliseconds = today.getMilliseconds();
	const mi = parseInt( milliseconds );
	if ( mi < 10 ) { milliseconds = "00" + milliseconds; }
	else if ( mi < 100 ) { milliseconds = "0" + milliseconds; }
	//return day + month + year + " @ " + hours + ":" + minutes + ":" + seconds + "." + milliseconds
	return day + month + year + " @ " + hours + ":" + minutes + ":" + seconds;
}
module.exports.time = GET_NOW_TIME;

function SET_ARGS( wArg1 , wArg2 , wArg3 , wArg4 ) {
	arg1 = wArg1 || arg1;
	arg2 = wArg2 || arg2;
	arg3 = wArg3 || arg3;
	arg4 = wArg4 || arg4;
}
module.exports.setArgs = SET_ARGS;

function GET_STATE() {
	return { state: wState , arg1: arg1 , arg2: arg2 , arg3: arg3 , arg4: arg4 };
}
module.exports.getState = GET_STATE;

function CHILD_PID_LOOKUP() {
	wPIDResultSet = [];
	return ps.lookup( { command: "python" } ,
		function( err , resultList ) {
			if ( err ) { throw new Error( err ); }
			resultList.forEach(function( process ){
				if( process ){
					process.arguments.forEach( function( item ) {
						if ( item === lCode1 ) {
							wPIDResultSet.push( process.pid );
							console.log( "python PID = " + process.pid.toString() );
						}
					});
				}
			});
			return wPIDResultSet;
		}
	);
	//return wPIDResultSet;
};
module.exports.childPIDLookup = CHILD_PID_LOOKUP;

// https://pypi.python.org/pypi/python-crontab/
// https://stackoverflow.com/questions/12871740/how-to-detach-a-spawned-child-process-in-a-node-js-script
// https://stackoverflow.com/questions/696839/how-do-i-write-a-bash-script-to-restart-a-process-if-it-dies
function START_PY_PROCESS() {
	wChild = null;
	wChild = spawn( "python" , [ lCode1 , arg1 , arg2 , arg3 , arg4 ] , { detached: true, stdio: [ 'ignore' , 'ignore' , 'ignore' ] } );
	console.log( "launched pyscript" );
	CHILD_PID_LOOKUP();
	
	wState = true;
	wChild.on( "error" , function( code ) {
		require(  "../slackManager.js" ).postError( code );
		console.log( code );
	});
	wChild.on( "exit" , function(code) {
		require(  "../slackManager.js" ).postError( code );
		console.log( code );
	});
	setTimeout( function () {
		wChild.unref();
	} , 3000 );
}
module.exports.startPYProcess = START_PY_PROCESS;

function KILL_ALL_PY_PROCESS() {
	exec( "sudo pkill -9 python" , { silent: true ,  async: false } );
	wPIDResultSet.forEach(function( item , index ) {
		try {
			ps.kill( item , function( err ){
				if (err) { console.log( err ); }
				else { 
					wState = false;
					console.log( "killed PID: " + item.toString() );
					wPIDResultSet.splice( index , 1 );
				}
			});
		}
		catch(err){
			exec( "sudo pkill -9 python" , { silent: true ,  async: false } );
			console.log(err);
		}
	});
}
module.exports.killAllPYProcess = KILL_ALL_PY_PROCESS;

function RESTART_PY_PROCESS() {
	console.log("restarting")
	KILL_ALL_PY_PROCESS();
	wState = false;
	setTimeout(function(){
		START_PY_PROCESS();
	}, 3000 );
}
module.exports.restartPYProcess = RESTART_PY_PROCESS;

function GRACEFUL_EXIT() {
	console.log("restarting")
	KILL_ALL_PY_PROCESS();
	wState = false;
	setTimeout(function(){
		START_PY_PROCESS();
	}, 5000 );
}
module.exports.gracefulExit = GRACEFUL_EXIT;

const LATEST_VIDEO_FP = path.join( __dirname , "../express" , "latest_video_id.txt" );

const JPEG_TO_MP4 = "ffmpeg -y -f image2 -r 30 -i ";
const JPEG_TO_MP4_2 = " -s 500x500 -vcodec libx264 -profile:v high444 -refs 16 -crf 0 -preset ultrafast ";
const JPEG_TO_MP4_3 = "video.mp4";
function GENERATE_VIDEO( wPath ) {
	
	console.log( wPath );
	if ( !wPath ) { return; }
	const saved_orig_path = wPath;
	wPath = wPath.split( "-" );

	wPath = path.join( __dirname , "../../RECORDS" , wPath[ 0 ] , wPath[ 1 ] );
	console.log( wPath );
	var wBasePath = wPath;
	wPath = JPEG_TO_MP4 + path.join( wPath , "%03d.jpg" ) + JPEG_TO_MP4_2 + path.join( wPath , JPEG_TO_MP4_3 );
	console.log( wPath );

	// var x1 = exec( wPath , { silent: true , async: false } );
	// if ( x1.stderr ) { return( x1.stderr ); }
	// if ( x1.stdout ) {
	// 	const wURL = "http://192.168.0.25:6161/video?path=" + saved_orig_path;
	// 	console.log( wURL );
	// 	require(  "../slackManager.js" ).discordPostEvent( wURL );
	// }
	// return x1.stdout;
	
	// var child = exec( wPath , { async:true });
	// child.stdout.on( 'data' , function( data ) {
	// 	const wURL = "http://192.168.0.25:6161/video?path=" + saved_orig_path;
	// 	console.log( wURL );
	// 	require(  "../slackManager.js" ).discordPostEvent( wURL );
	// });

	exec( wPath , function( code, stdout, stderr) {
		console.log('Exit code:', code);
		console.log('Program output:', stdout);
		console.log('Program stderr:', stderr);
		const wURL = "http://192.168.1.2:6161/video?path=" + saved_orig_path;
		console.log( wURL );
		console.log( "Attempting to Save --> " + LATEST_VIDEO_FP );
		console.log( saved_orig_path );
		require(  "../slackManager.js" ).discordPostEvent( wURL );
		//require( "../slackManager.js" ).postVideo( path.join( wBasePath , JPEG_TO_MP4_3 ) )
	});

	exec( "rm " + LATEST_VIDEO_FP , { silent: true , async: false } );
	fs.writeFileSync( LATEST_VIDEO_FP , saved_orig_path , { encoding: "utf8" , flag: "a+" } );

	// wFFMPEG_Child = null;
	// var wArgs = [
	// 	"-f" , "image2" ,
	// 	"-r" , "30" ,
	// 	"-i" , "'" + path.join( __dirname , "../../RECORDS" , wPath[ 0 ] , wPath[ 1 ] , "%03d.jpg" ) + "'" ,
	// 	"-s" , "500x500" ,
	// 	"-vcodec" , "libx264" ,
	// 	"-profile:v" , "high444" ,
	// 	"-refs" , "16" ,
	// 	"-crf" , "0" ,
	// 	"-preset" , "ultrafast" , 
	// 	"'" + path.join( __dirname , "../../RECORDS" , wPath[ 0 ] , wPath[ 1 ] , "video.mp4" ) + "'"
	// ];
	// console.log( wArgs );
	// wFFMPEG_Child = spawn( "ffmpeg" , wArgs , { detached: true, stdio: [ 'ignore' , 'ignore' , 'ignore' ] } );
	// console.log( "launched ffmpeg jpeg conversion" );

	// wFFMPEG_Child.on( "error" , function( code ) {
	// 	require(  "../slackManager.js" ).postError( code );
	// 	console.log( code );
	// });
	// wFFMPEG_Child.on( "exit" , function(code) {
	// 	require(  "../slackManager.js" ).postError( code );
	// 	console.log( code );
	// });
	// setTimeout( function () {
	// 	const wURL = "http://192.168.1.2:6161/video?path=" + encodeURIComponent( saved_orig_path );
	// 	console.log( wURL );
	// 	require(  "../slackManager.js" ).discordPostEvent( wURL );
	// 	wFFMPEG_Child.unref();
	// } , 3000 );

}
module.exports.generateVideo = GENERATE_VIDEO;