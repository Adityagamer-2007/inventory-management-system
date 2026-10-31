const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { validateUserInput, isValidObjectId } = require('../utils/validators');
const { removesLastActiveAdmin } = require('../services/userRules');
const { hashToken, SALT_ROUNDS } = require('./authController');
const { logActivity } = require('../utils/activity');

async function otherActiveAdmins(userId) {
  return User.countDocuments({ role: 'admin', active: true, _id: { $ne: userId } });
}

exports.list = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1 }).lean();
    res.render('users/index', { title: 'User management', users });
  } catch (err) { next(err); }
};

exports.showNew = (req, res) => res.render('users/form', { title: 'Add staff account', form: {}, errors: [], isEdit: false });

exports.create = async (req, res, next) => {
  try {
    // Admins create Staff accounts here. Promote to Admin later via Edit (explicit action, logged).
    const { errors, values } = validateUserInput(req.body, { requirePassword: true });
    if (req.body.password !== req.body.confirmPassword) errors.push('Passwords do not match.');
    if (!errors.length && (await User.findOne({ $or: [{ username: values.username }, { email: values.email }] }))) {
      errors.push('That username or email is already in use.');
    }
    if (errors.length) return res.status(400).render('users/form', { title: 'Add staff account', form: values, errors, isEdit: false });
    const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    const user = await User.create({ username: values.username, name: values.name, email: values.email, passwordHash, role: 'staff' });
    await logActivity(req, 'user.create', 'User', user._id, 'Created staff account "' + user.username + '"');
    req.flash('success', 'Staff account created.');
    res.redirect('/users');
  } catch (err) { next(err); }
};

exports.showEdit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const target = await User.findById(req.params.id).lean();
    if (!target) return next();
    res.render('users/form', { title: 'Edit user', form: target, errors: [], isEdit: true });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const target = await User.findById(req.params.id);
    if (!target) return next();
    const { errors, values } = validateUserInput(req.body, { allowRole: true });
    const isSelf = target._id.equals(req.user._id);
    const newActive = isSelf ? target.active : req.body.active === 'on';

    if (!errors.length) {
      const clash = await User.findOne({ _id: { $ne: target._id }, $or: [{ username: values.username }, { email: values.email }] });
      if (clash) errors.push('That username or email is already in use.');
      const guard = removesLastActiveAdmin({ target, otherActiveAdmins: await otherActiveAdmins(target._id), newRole: values.role, newActive });
      if (guard) errors.push('This change would leave the system without an active administrator.');
    }
    if (errors.length) return res.status(400).render('users/form', { title: 'Edit user', form: { ...values, _id: target._id, active: newActive }, errors, isEdit: true });

    const roleChanged = target.role !== values.role;
    const activeChanged = target.active !== newActive;
    Object.assign(target, { username: values.username, name: values.name, email: values.email, role: values.role, active: newActive });
    await target.save();
    let msg = 'Updated user "' + target.username + '"';
    if (roleChanged) msg += ', role is now ' + target.role;
    if (activeChanged) msg += ', account ' + (newActive ? 'activated' : 'deactivated');
    await logActivity(req, 'user.update', 'User', target._id, msg);
    req.flash('success', 'User updated.');
    res.redirect('/users');
  } catch (err) { next(err); }
};

exports.toggleActive = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const target = await User.findById(req.params.id);
    if (!target) return next();
    if (target._id.equals(req.user._id)) {
      req.flash('danger', 'You cannot deactivate your own account.');
      return res.redirect('/users');
    }
    const newActive = !target.active;
    if (removesLastActiveAdmin({ target, otherActiveAdmins: await otherActiveAdmins(target._id), newRole: target.role, newActive })) {
      req.flash('danger', 'You cannot deactivate the last active administrator.');
      return res.redirect('/users');
    }
    target.active = newActive;
    await target.save();
    await logActivity(req, 'user.' + (newActive ? 'activate' : 'deactivate'), 'User', target._id, (newActive ? 'Activated' : 'Deactivated') + ' account "' + target.username + '"');
    req.flash('success', 'Account ' + (newActive ? 'activated' : 'deactivated') + '.');
    res.redirect('/users');
  } catch (err) { next(err); }
};

// Admin creates a one-time link (valid 1 hour). The user opens it and chooses a new password.
exports.createResetLink = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const target = await User.findById(req.params.id);
    if (!target) return next();
    const token = crypto.randomBytes(32).toString('hex');
    target.resetTokenHash = hashToken(token); // only the hash is stored
    target.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await target.save();
    await logActivity(req, 'user.reset_link', 'User', target._id, 'Created a password reset link for "' + target.username + '"');
    const link = req.protocol + '://' + req.get('host') + '/reset-password/' + token;
    req.flash('success', 'Reset link for ' + target.username + ' (valid for 1 hour, works once): ' + link);
    res.redirect('/users');
  } catch (err) { next(err); }
};
