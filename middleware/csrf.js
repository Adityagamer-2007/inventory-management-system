const { generateToken, tokensMatch } = require('../utils/csrf');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Every session gets one secret token. Forms include it as a hidden field "_csrf".
module.exports = function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = generateToken();
  res.locals.csrfToken = req.session.csrfToken;
  if (SAFE_METHODS.includes(req.method)) return next();

  const provided = (req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token');
  if (!tokensMatch(req.session.csrfToken, provided)) {
    const err = new Error('Invalid or missing security token. Reload the page and try again.');
    err.status = 403;
    err.code = 'EBADCSRF';
    return next(err);
  }
  next();
};
