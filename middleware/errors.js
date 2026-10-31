const { config } = require('../config/env');

// Logged-out visitors get the simple centred layout, logged-in users get the full app layout.
function layoutFor(req) {
  return req.user ? 'layouts/main' : 'layouts/auth';
}

function notFound(req, res) {
  res.status(404).render('errors/404', { title: 'Page not found', layout: layoutFor(req) });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error(err);

  if (err.code === 'EBADCSRF') {
    return res.status(403).render('errors/500', {
      layout: layoutFor(req),
      title: 'Security check failed',
      heading: 'Security check failed',
      message: err.message,
    });
  }
  if (err.name === 'CastError') return notFound(req, res);

  res.status(status).render('errors/500', {
    layout: layoutFor(req),
    title: 'Something went wrong',
    heading: 'Something went wrong',
    message: status < 500 ? err.message : 'An unexpected error occurred. Please try again.',
    detail: !config.isProduction && status >= 500 ? err.stack : '',
  });
}

module.exports = { notFound, errorHandler };
