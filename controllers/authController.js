const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { config } = require('../config/env');
const { validateUserInput, validatePassword } = require('../utils/validators');
const { logActivity } = require('../utils/activity');

const SALT_ROUNDS = 12;
// Used to keep response time similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

exports.showLogin = (req, res) => {
  res.render('auth/login', { title: 'Log in', layout: 'layouts/auth', form: {}, errors: [], allowRegistration: config.allowRegistration });
};

exports.login = async (req, res, next) => {
  try {
    const identifier = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const errors = [];
    if (!identifier) errors.push('Enter your username or email.');
    if (!password) errors.push('Enter your password.');

    let user = null;
    if (!errors.length) {
      user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] }).select('+passwordHash');
      const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
      if (!user || !ok) {
        user = null;
        errors.push('Invalid username or password.');
      } else if (!user.active) {
        user = null;
        errors.push('This account has been deactivated. Please contact an administrator.');
      }
    }

    if (errors.length) {
      return res.status(401).render('auth/login', {
        title: 'Log in', layout: 'layouts/auth', form: { username: identifier }, errors, allowRegistration: config.allowRegistration,
      });
    }

    const returnTo = req.session.returnTo;
    // New session id after login prevents session fixation.
    req.session.regenerate(async (err) => {
      if (err) return next(err);
      try {
        req.session.userId = user._id.toString();
        user.lastLoginAt = new Date();
        await user.save();
        req.user = user;
        await logActivity(req, 'auth.login', 'User', user._id, user.username + ' logged in');
        const safe = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
        // Make sure the session is written to MongoDB before redirecting, so the next request is logged in.
        req.session.save((saveErr) => (saveErr ? next(saveErr) : res.redirect(safe)));
      } catch (e) {
        next(e);
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    if (req.user) await logActivity(req, 'auth.logout', 'User', req.user._id, req.user.username + ' logged out');
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('ims.sid');
      res.redirect('/login');
    });
  } catch (err) {
    next(err);
  }
};

exports.showRegister = (req, res) => {
  res.render('auth/register', { title: 'Register', layout: 'layouts/auth', form: {}, errors: [] });
};

exports.register = async (req, res, next) => {
  try {
    const { errors, values } = validateUserInput(req.body, { requirePassword: true });
    if (req.body.password !== req.body.confirmPassword) errors.push('Passwords do not match.');
    if (!errors.length) {
      const exists = await User.findOne({ $or: [{ username: values.username }, { email: values.email }] });
      if (exists) errors.push('That username or email is already registered.');
    }
    if (errors.length) {
      return res.status(400).render('auth/register', { title: 'Register', layout: 'layouts/auth', form: values, errors });
    }
    const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    // Self-registration can only ever create Staff accounts.
    const user = await User.create({ username: values.username, name: values.name, email: values.email, passwordHash, role: 'staff' });
    await logActivity({ user, ip: req.ip }, 'user.register', 'User', user._id, 'New staff account registered: ' + user.username);
    req.flash('success', 'Account created. You can log in now.');
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
};

async function findByResetToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return User.findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() }, active: true }).select('+resetTokenHash +resetTokenExpires');
}

exports.showReset = async (req, res, next) => {
  try {
    const user = await findByResetToken(req.params.token);
    if (!user) {
      return res.status(400).render('errors/500', { title: 'Reset link invalid', layout: 'layouts/auth', heading: 'Reset link is invalid or expired', message: 'Ask an administrator to create a new password reset link for you.' });
    }
    res.render('auth/reset', { title: 'Set a new password', layout: 'layouts/auth', token: req.params.token, errors: [] });
  } catch (err) {
    next(err);
  }
};

exports.reset = async (req, res, next) => {
  try {
    const user = await findByResetToken(req.params.token);
    if (!user) {
      return res.status(400).render('errors/500', { title: 'Reset link invalid', layout: 'layouts/auth', heading: 'Reset link is invalid or expired', message: 'Ask an administrator to create a new password reset link for you.' });
    }
    const errors = validatePassword(req.body.password);
    if (req.body.password !== req.body.confirmPassword) errors.push('Passwords do not match.');
    if (errors.length) return res.status(400).render('auth/reset', { title: 'Set a new password', layout: 'layouts/auth', token: req.params.token, errors });

    user.passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    user.resetTokenHash = undefined; // one-time use
    user.resetTokenExpires = undefined;
    await user.save();
    await logActivity({ user, ip: req.ip }, 'user.password_reset', 'User', user._id, 'Password was reset for ' + user.username);
    req.flash('success', 'Password updated. Please log in.');
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
};

exports.hashToken = hashToken;
exports.SALT_ROUNDS = SALT_ROUNDS;
