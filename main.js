const schedule = require( "node-schedule" );
const ip = require("ip");
const fs = require( "fs" );
const path = require( "path" );

process.on( "unhandledRejection" , function( reason , p ) {
    console.error( reason, "Unhandled Rejection at Promise" , p );
    console.trace();
});
process.on( "uncaughtException" , function( err ) {
    console.error( err , "Uncaught Exception thrown" );
    console.trace();
});

const wPORT = 6161;
var app = server = null;
const GenericUtils = require( "./server/utils/generic.js" );

var startTime = new schedule.RecurrenceRule();
startTime.dayOfWeek = [ new schedule.Range( 0 , 6 ) ];
startTime.hour = 22;
startTime.minute = 30;
var stopTime = new schedule.RecurrenceRule();
stopTime.dayOfWeek = [ new schedule.Range( 0 , 6 ) ];
stopTime.hour = 9;
stopTime.minute = 00;

var startEvent = null;
var stopEvent = null;

const WebSocket = require( "ws" );
var wss = wss_interval = null;

function LOAD_WEBSOCKET_STUFF() {
	return new Promise( function( resolve , reject ) {
		try {
			wss.on( "connection" ,  function( socket , req ) {
				socket.on( "message" ,  function( message ) {
					try { message = JSON.parse( message ); }
					catch( e ) { var a = message; message = { "type": a }; }
					// console.log( message );
					switch( message.type ) {
						case "pong":
							//console.log( "inside pong()" );
							this.isAlive = true;
							break;
						case "error":
							require( "./server/slackManager.js" ).discordPostError( message.message );
							break;
						case "event":
							require( "./server/slackManager.js" ).discordPostEvent( message.message );
							break;
						case "record":
							require( "./server/slackManager.js" ).discordPostRecord( message.message );
							//require( "./server/slackManager.js" ).postStill();
							break;
						case "extra":
							require( "./server/slackManager.js" ).postStill();
							break;
						case "videoReady":
							console.log( "WebSocket Master --> " + message.message );
							require( "./server/utils/generic.js" ).generateVideo( message.message );
							break;							
						default:
							break;
					}
				});
			});
			// wss_interval = setInterval( function ping() {
			// 	wss.clients.forEach( function each( ws ) {
			// 		if ( ws.isAlive === false ) { console.log( "terminating client" ); return ws.terminate(); }
			// 		ws.isAlive = false;
			// 		//ws.send( JSON.stringify( { message: "ping" } ) );
			// 	});
			// } , 30000 );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

const localIP = ip.address();
var LIVE_HTML_PAGE = '<img alt=""id="liveimage"src=""/><img alt="" id="liveimage" src=""/> <script type="text/javascript">(function(){setInterval(function(){var myImageElement=document.getElementById("liveimage");myImageElement.src="http://';
LIVE_HTML_PAGE = LIVE_HTML_PAGE + localIP + ":" + wPORT + '/live_image?"';
LIVE_HTML_PAGE = LIVE_HTML_PAGE + " + new Date().getTime()},500)}());</script>";

( async ()=> {
	console.log( "SERVER STARTING" );

	fs.writeFileSync( path.join( __dirname , "client" , "views" , "live.html" ) , LIVE_HTML_PAGE );
	//console.log( "Wrote LIVE_HTML_PAGE file" );

	app = require( "./server/express/app.js" );
	server = require( "http" ).createServer( app );
	wss = new WebSocket.Server({ server });
	
	await require( "./server/slackManager.js" ).initialize();
	console.log( "LOADED Slack-Client" );
	require( "./server/slackManager.js" ).post( "main.js restarted" );

	server.listen( wPORT , async function() {
		console.log( "\thttp://localhost:" + wPORT.toString() );
	});

	var wRestart = false;
	const now = new Date();
    const hours = now.getHours();
    console.log( hours.toString() );
	if( hours >= startTime.hour  ) { wRestart = true; }
	else if ( hours <= stopTime.hour ) {
		wRestart = true;
		if ( hours === stopTime.hour ) {
			if ( now.getMinutes() >= stopTime.minute ) { wRestart = false; }
		}
	}
	if ( wRestart ) {
		require( "./server/slackManager.js" ).post( "motionSave.py needs launched , starting" );
		GenericUtils.restartPYProcess();
	}

	startEvent = schedule.scheduleJob( startTime , function(){
		console.log( "scheduled start" );
		const cur_state = GenericUtils.getState();
		if ( !cur_state.state ) { GenericUtils.startPYProcess(); } 
		else { GenericUtils.restartPYProcess(); }
		require( "./server/slackManager.js" ).post( "motionSave.py scheduled start" );
	});

	stopEvent = schedule.scheduleJob( stopTime , function(){
		console.log( "scheduled stop" );
		GenericUtils.killAllPYProcess();
		require( "./server/slackManager.js" ).post( "motionSave.py scheduled stop" );
	});

	process.on( "unhandledRejection" , function( reason , p ) {
	    require( "./server/slackManager.js" ).postError( reason );
	});
	process.on( "uncaughtException" , function( err ) {
	    require( "./server/slackManager.js" ).postError( err );
	});

	process.on( "SIGINT" , async function () {
		await require( "./server/slackManager.js" ).postError( "main.js crashed !!" );
		GenericUtils.killAllPYProcess();
		setTimeout( function() {
			process.exit( 1 );
		} , 3000 );
	});

	await LOAD_WEBSOCKET_STUFF();
	console.log( "SERVER READY" );
})();