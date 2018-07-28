const Slack = require( "slack" );
var bot = null;
const wToken = require( "../personal.js" ).slack.access_token;

require( "shelljs/global" );
const fs = require( "fs" );
const path = require( "path" );
const still_path = path.join( __dirname , ".." , "client" , "frame.jpeg" );
console.log( still_path );
const Eris = require("eris");
var discordBot = null;
var discordCreds = require( "../personal.js" ).discord_creds;

function DISCORD_POST_ERROR( wMessage ) {
	return new Promise( async function( resolve , reject ) {
		try {
			await discordBot.createMessage( discordCreds.error_channel_id , wMessage );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});s
}
module.exports.discordPostError = DISCORD_POST_ERROR;

function DISCORD_POST_EVENT( wMessage ) {
	return new Promise( async function( resolve , reject ) {
		try {
			await discordBot.createMessage( discordCreds.events_channel_id , wMessage );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});s
}
module.exports.discordPostEvent = DISCORD_POST_EVENT;

function DISCORD_POST_RECORD( wMessage ) {
	return new Promise( async function( resolve , reject ) {
		try {
			await discordBot.createMessage( discordCreds.records_channel_id , wMessage );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});s
}
module.exports.discordPostRecord = DISCORD_POST_RECORD;

const xChannel = "#raspi-neuro";
function POST_MESSAGE( wMessage , wChannel ) {
	return new Promise( async function( resolve , reject ) {
		try {
			if ( !wMessage ) { resolve(); return; }
			wChannel = wChannel || xChannel;
			//await bot.chat.postMessage( { token: wToken , channel: wChannel , text: wMessage  } );
			if ( wChannel === xChannel ) {
				await discordBot.createMessage( discordCreds.events_channel_id , wMessage );
			}
			else {
				await discordBot.createMessage( discordCreds.error_channel_id , wMessage );
			}
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.post = POST_MESSAGE;

const wErrChannel = "#raspn-err";
function POST_SLACK_ERROR( wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			if ( !wStatus ) { resolve(); return; }
			if ( typeof wStatus !== "string" ) {
				try { wStatus = wStatus.toString(); }
				catch( e ) { wStatus = e; }
			}
			//await POST_MESSAGE( wStatus , wErrChannel );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.postError = POST_SLACK_ERROR;

function POST_STILL() {
	return new Promise( async function( resolve , reject ) {
		try {
			const still_data = fs.readFileSync( still_path );
			await discordBot.createMessage( discordCreds.events_channel_id , "still" , {
				file: still_data ,
				name: "still.jpeg"
			});
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.postStill = POST_STILL;

function RESTART_PM2() {
	return new Promise( function( resolve , reject ) {
		try {
			exec( "pm2 restart all" , { silent: true , async: false } );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.restartPM2 = RESTART_PM2;


function OS_COMMAND( wTask ) {
	return new Promise( function( resolve , reject ) {
		try {
			var result = null;
			var x1 = exec( wTask , { silent: true , async: false } );
			if ( x1.stderr ) { result = x1.stderr }
			else { result = x1.stdout.trim() }
			resolve( result );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function INITIALIZE() {
	return new Promise( async function( resolve , reject ) {
		try {
			//bot = await new Slack( { wToken } );
			discordBot = new Eris.CommandClient( discordCreds.token , {} , {
				description: "333",
				owner: discordCreds.bot_id ,
				prefix: "!"
			});
			var stillCommand = discordBot.registerCommand( "still" , ( msg , args ) => {
				if( args.length === 0 ) {
					POST_STILL();
				}
				return;
			}, {
				description: "Posts Still",
				fullDescription: "Posts Still",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});
			discordBot.registerCommandAlias( "frame" , "still" );

			var smsCommand = discordBot.registerCommand( "sms" , ( msg , args ) => {
				if( args.length === 0 ) {
					OS_COMMAND( "/usr/local/bin/sendMotionSMS" );
				}
				return;
			}, {
				description: "Sends Extra Motion SMS",
				fullDescription: "Sends Extra Motion SMS",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});
			discordBot.registerCommandAlias( "notify" , "sms" );
			await discordBot.connect();
			setTimeout( function() {
				resolve();
			} , 2000 );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.initialize = INITIALIZE;