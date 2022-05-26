const debug = require('debug');
const tarball = require('tarball');

exports.handler = async (_event, _context) => {
  return {
    debug: !!debug,
    tarball: !!tarball,
  };
}
