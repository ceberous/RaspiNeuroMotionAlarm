const schedule = require( "node-schedule" );

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
startTime.minute = 00;
var stopTime = new schedule.RecurrenceRule();
stopTime.dayOfWeek = [ new schedule.Range( 0 , 6 ) ];
stopTime.hour = 9;
stopTime.minute = 00;

var startEvent = null;
var stopEvent = null;

( async ()=> {
	console.log( "SERVER STARTING" );

	app = require( "./server/express/app.js" );
	server = require( "http" ).createServer( app );
	
	await require( "./server/slackManager.js" ).initialize();
	console.log( "LOADED Slack-Client" );
	require( "./server/slackManager.js" ).post( "main.js restarted" );

	server.listen( wPORT , async function() {
		console.log( "\thttp://localhost:" + wPORT.toString() );
	});

	var now = new Date();
    var day = now.getDay();
    var hours = now.getHours();
	if( startTime.hour < hours < stopTime.hour ) {
		//if( hours !== s || now.getMinutes() <= 30 ) {

		//}
		GenericUtils.restartPYProcess();
		require( "./server/slackManager.js" ).post( "main.js restarted , newMotion.py needs launched , starting" );
	}

	startEvent = schedule.scheduleJob( startTime , function(){
		console.log( "scheduled start" );
		const cur_state = GenericUtils.getState();
		if ( !cur_state.state ) { GenericUtils.startPYProcess(); } 
		else { GenericUtils.restartPYProcess(); }
		require( "./server/slackManager.js" ).post( "newMotion.py scheduled start" );
	});

	stopEvent = schedule.scheduleJob( stopTime , function(){
		console.log( "scheduled stop" );
		GenericUtils.killAllPYProcess();
		require( "./server/slackManager.js" ).post( "newMotion.py scheduled stop" );
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

	console.log( "SERVER READY" );
})();