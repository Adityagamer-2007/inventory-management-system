const User = require('../models/User');

// Loads the logged-in user on every request, so deactivation or role changes apply immediately.
async function loadUser(req, res, next) {
  try {
    req.user = null;
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.active) req.user = user;
      else delete req.session.userId;
    }
    res.locals.currentUser = req.user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.flash('warning', 'Please log in to continue.');
  res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('errors/403', { title: 'Access denied', layout: 'layouts/main' });
    }
    next();
  };
}

function redirectIfLoggedIn(req, res, next) {
  if (req.user) return res.redirect('/');
  next();
}

module.exports = { loadUser, requireLogin, requireRole, redirectIfLoggedIn };
