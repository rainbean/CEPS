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
