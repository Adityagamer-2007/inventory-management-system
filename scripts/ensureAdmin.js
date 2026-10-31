// Runs automatically before "npm run dev" / "npm start" (see package.json "predev"/"prestart").
// Makes sure the administrator exists in the configured MongoDB (Atlas) database.
//   - Account missing  -> created from ADMIN_* values in .env (password hashed with bcrypt)
//   - Account present  -> left completely untouched (a password you changed later is never overwritten)
//   - Account missing and ADMIN_PASSWORD empty -> stops with instructions (startup is blocked)
// To deliberately reset the admin password use:  npm run create-admin
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { config, assertConfig } = require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { validateUserInput, validatePassword } = require('../utils/validators');

async function main() {
  assertConfig(); // MONGODB_URI + SESSION_SECRET present and sane
  await connectDB();

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim();
  const password = process.env.ADMIN_PASSWORD || '';

  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    const note = existing.role !== 'admin' || !existing.active ? ' (WARNING: it is not an active admin; run "npm run create-admin" to repair it)' : '';
    console.log('Admin check: account "' + existing.username + '" already exists, left unchanged.' + note);
    return;
  }

  if (!password) {
    throw new Error('No admin account "' + username + '" exists yet and ADMIN_PASSWORD is empty in .env.\nRun "npm run create-admin" to create it (you will be asked for a password).');
  }
  const { errors, values } = validateUserInput({ username, name, email });
  errors.push(...validatePassword(password));
  if (errors.length) throw new Error('Cannot create the admin account:\n - ' + errors.join('\n - '));
  if (await User.findOne({ email: values.email })) {
    throw new Error('Cannot create admin: the email ' + values.email + ' already belongs to another account. Change ADMIN_EMAIL in .env.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username: values.username, name: values.name, email: values.email, passwordHash, role: 'admin' });
  await ActivityLog.create({ username: 'system', action: 'user.admin_bootstrap', entityType: 'User', entityId: String(user._id), message: 'Admin account "' + user.username + '" created automatically on first start' });
  console.log('Admin check: administrator "' + user.username + '" created in database "' + mongoose.connection.name + '".');
}

main()
  .catch((err) => {
    console.error('\n' + err.message + '\n');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
