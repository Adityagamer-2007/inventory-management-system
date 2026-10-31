const bcrypt = require('bcrypt');
const User = require('../models/User');
const { validateUserInput, validatePassword } = require('../utils/validators');
const { SALT_ROUNDS } = require('./authController');
const { logActivity } = require('../utils/activity');

exports.show = (req, res) => {
  res.render('account/index', { title: 'Account settings', profileErrors: [], passwordErrors: [], form: req.user });
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { errors, values } = validateUserInput({ ...req.body, username: req.user.username });
    if (!errors.length && (await User.findOne({ _id: { $ne: req.user._id }, email: values.email }))) errors.push('That email is already in use.');
    if (errors.length) return res.status(400).render('account/index', { title: 'Account settings', profileErrors: errors, passwordErrors: [], form: { ...req.user.toObject(), ...values } });
    req.user.name = values.name;
    req.user.email = values.email;
    await req.user.save();
    await logActivity(req, 'account.update', 'User', req.user._id, 'Updated own profile');
    req.flash('success', 'Profile updated.');
    res.redirect('/account');
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+passwordHash');
    const errors = [];
    if (!(await bcrypt.compare(String(req.body.currentPassword || ''), user.passwordHash))) errors.push('Current password is incorrect.');
    errors.push(...validatePassword(req.body.newPassword));
    if (req.body.newPassword !== req.body.confirmPassword) errors.push('New passwords do not match.');
    if (errors.length) return res.status(400).render('account/index', { title: 'Account settings', profileErrors: [], passwordErrors: errors, form: req.user });
    user.passwordHash = await bcrypt.hash(req.body.newPassword, SALT_ROUNDS);
    await user.save();
    await logActivity(req, 'account.password', 'User', user._id, 'Changed own password');
    req.flash('success', 'Password changed.');
    res.redirect('/account');
  } catch (err) { next(err); }
};
