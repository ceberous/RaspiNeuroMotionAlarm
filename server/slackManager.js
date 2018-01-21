const Slack = require( "slack" );
var bot = null;
const wToken = require( "../personal.js" ).slack.access_token;

const xChannel = "#raspi-neuro";
function POST_MESSAGE( wMessage , wChannel ) {
	return new Promise( async function( resolve , reject ) {
		try {
			if ( !wMessage ) { resolve(); return; }
			wChannel = wChannel || xChannel;
			await bot.chat.postMessage( { token: wToken , channel: wChannel , text: wMessage  } );
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
			await POST_MESSAGE( wStatus , wErrChannel );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.postError = POST_SLACK_ERROR;

function INITIALIZE() {
	return new Promise( async function( resolve , reject ) {
		try {
			bot = await new Slack( { wToken } );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.initialize = INITIALIZE;