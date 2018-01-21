const express = require( "express" );
const path = require( "path" );
const bodyParser = require( "body-parser" );
const cors = require( "cors" );
const wPORT = 6161;

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

module.exports = app;