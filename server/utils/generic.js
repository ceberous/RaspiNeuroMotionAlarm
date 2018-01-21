require("shelljs/global");
const spawn = require( "child_process" ).spawn;
const ps = require( "ps-node" );
const path = require( "path" );

var arg1 = 3 	// = Minimum Seconds of Continuous Motion
var arg2 = 1 	// = Total Motion Events Acceptable Before Alert
var arg3 = 3 	// = Minimum Time of Motion Before Alert
var arg4 = 20 	// = Cooloff Period Duration
const lCode1 = path.join( __dirname , "../../py_scripts" , "newMotion.py" );
console.log( lCode1 );
var wState = false;
var wChild = null;
var wPIDResultSet = [];

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
	ps.lookup( { command: "python" } ,
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
		}
	);
	return wPIDResultSet;
};
module.exports.childPIDLookup = CHILD_PID_LOOKUP;

function START_PY_PROCESS() {
	
	wChild = spawn( "python" , [ lCode1 , arg1 , arg2 , arg3 , arg4 ] );
	console.log( "launched pyscript" );
	CHILD_PID_LOOKUP();
	
	wState = true;
	wChild.on( "error" , function( code ) {
		console.log( code );
	});
	wChild.on( "exit" , function(code) {
		console.log( code );
	});

}
module.exports.startPYProcess = START_PY_PROCESS;

function KILL_ALL_PY_PROCESS() {
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
			exec( "pkill -9 python" , { silent: true ,  async: false } );
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