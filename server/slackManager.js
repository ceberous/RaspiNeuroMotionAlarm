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
			const timeName = require( "./utils/generic.js" ).time();
			const still_data = fs.readFileSync( still_path );
			await discordBot.createMessage( discordCreds.events_channel_id , timeName , {
				file: still_data ,
				name: timeName + ".jpeg"
			});
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.postStill = POST_STILL;

// function POST_VIDEO( wPath ) {
// 	return new Promise( async function( resolve , reject ) {
// 		try {
// 			const timeName = require( "./utils/generic.js" ).time();
// 			const video_data = fs.readFileSync( wPath );
// 			await discordBot.createMessage( discordCreds.events_channel_id , timeName , {
// 				file: still_data ,
// 				name: timeName + ".mp4"
// 			});
// 			resolve();
// 		}
// 		catch( error ) { console.log( error ); reject( error ); }
// 	});
// }
// module.exports.postVideo = POST_VIDEO;

function POST_VIDEO_LINK( wPath ) {
	return new Promise( async function( resolve , reject ) {
		try {
			const timeName = require( "./utils/generic.js" ).time();
			const still_data = fs.readFileSync( still_path );
			await discordBot.createMessage( discordCreds.events_channel_id , timeName , {
				file: still_data ,
				name: timeName + ".jpeg"
			});
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.postVideLink = POST_VIDEO_LINK;

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
			discordBot.registerCommandAlias( "alert" , "sms" );

			var callCommand = discordBot.registerCommand( "call" , ( msg , args ) => {
				if( args.length === 0 ) {
					OS_COMMAND( "/usr/local/bin/callDad" );
					return;
				}
				if ( args[ 0 ] === "house" ) {
					OS_COMMAND( "/usr/local/bin/callHouse" );
					return;
				}

				if ( args[ 0 ] === "mom" ) {
					OS_COMMAND( "/usr/local/bin/callMom" );
					return;
				}
				if ( args[ 0 ] === "me" || args[ 0 ] === "test" ) {
					OS_COMMAND( "/usr/local/bin/callMe" );
					return;
				}
				if ( args[ 0 ] === "dad" ) {
					OS_COMMAND( "/usr/local/bin/callDad" );
					return;
				}
			}, {
				description: "Makes Voice Call to Number",
				fullDescription: "Makes Voice Call to Number",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});

			var stopCommand = discordBot.registerCommand( "stop" , ( msg , args ) => {
				if( args.length === 0 ) {
					require( "./utils/generic.js" ).killAllPYProcess();
					return;
				}
			}, {
				description: "Stops PY Process",
				fullDescription: "Stops PY Process",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});

			var restartCommand = discordBot.registerCommand( "restart" , ( msg , args ) => {
				if( args.length === 0 ) {
					require( "./utils/generic.js" ).restartPYProcess();
					return;
				}
			}, {
				description: "Restarts PY Process",
				fullDescription: "Restarts PY Process",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});
			discordBot.registerCommandAlias( "start" , "restart" );

			var getStateCommand = discordBot.registerCommand( "state" , ( msg , args ) => {
				if( args.length === 0 ) {
					const cur_state = require( "./utils/generic.js" ).getState();
					return "Py Process Active = " + cur_state.state;
				}
			}, {
				description: "Get PY Process State",
				fullDescription: "Get PY Process State",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});

			var fpyCommand = discordBot.registerCommand( "fpy" , ( msg , args ) => {
				if( args.length === 0 ) {
					const active_py_procs = require( "./utils/generic.js" ).childPIDLookup();
					return "Active PY PID's = " + active_py_procs.join( " , " );
				}
			}, {
				description: "Returns Running PY Processes",
				fullDescription: "Returns Running PY Processes",
				usage: "<text>" ,
				reactionButtonTimeout: 0
			});

			await discordBot.connect();
			setTimeout( function() {
				resolve();
			} , 2000 );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.initialize = INITIALIZE;