/**
 * Global enum definition
 */
function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

define("CEPS_MAGIC_CODE", 0x43455053);
define("LEN_MIN_CEPS_MSG", 25);

define("REQ_SEND_MSG", 0x0004);
define("LEN_REQ_SEND_MSG", 25);

define("REP_SEND_MSG", 0x0104);
define("LEN_REP_SEND_MSG", 25);

define("REQ_GET_EXT_PORT", 0x0008);
define("LEN_REQ_GET_EXT_PORT", 41);

// state of session profiles
define("STATE_UNKNOWN",     0);
define("STATE_PRIVATE",     1);
define("STATE_PUBLIC_REQ",  2);
define("STATE_PUBLIC_DEST", 3);
define("STATE_UPNP_REQ",    4);
define("STATE_UPNP_DEST",   5);
define("STATE_PUNCH_REQ",   6);
define("STATE_PUNCH_DEST",  7);
define("STATE_RELAY",       8);

// steps to advance of state machine of session profiles
define("STEP_UNKNOWN",      0);
define("STEP_MAP_UPNP",     1);
define("STEP_EXT_PORT",     2);
define("STEP_PUNCH",        3);
define("STEP_LISTEN_AT",    4);
define("STEP_SEND_TO",      5);
define("STEP_SAVE_SESSION", 6);

