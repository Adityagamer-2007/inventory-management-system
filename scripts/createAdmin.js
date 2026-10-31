// Creates the administrator account, or safely RESETS it if the username already exists.
//
//   npm run create-admin
//
// Values come from environment variables (.env) and anything missing is asked interactively:
//   ADMIN_USERNAME, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
//
// Behaviour (idempotent, never creates duplicates):
//   - username not found  -> a new admin is created
//   - username found      -> the SAME account is updated: new bcrypt password hash, role = admin,
//                            active = true, pending reset links cleared
//   - email used by a different account -> stops with an error, nothing is changed
// The plaintext password is never stored and never printed.
const readline = require('readline');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { validateUserInput, validatePassword } = require('../utils/validators');

const SALT_ROUNDS = 12; // same cost as the application (controllers/authController.js)

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(question, resolve);
    process.stdout.write(question);
    const original = rl._writeToOutput;
    rl._writeToOutput = () => {}; // do not echo typed characters
    rl.question('', (answer) => {
      rl._writeToOutput = original;
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  let username = (process.env.ADMIN_USERNAME || '').trim();
  let name = (process.env.ADMIN_NAME || '').trim();
  let email = (process.env.ADMIN_EMAIL || '').trim();
  let password = process.env.ADMIN_PASSWORD || '';

  if (!username || !email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    try {
      console.log('Create or reset the administrator account\n');
      if (!username) username = await ask(rl, 'Username (login ID): ');
      if (!name) name = await ask(rl, 'Full name: ');
      if (!email) email = await ask(rl, 'Email: ');
      if (!password) {
        password = await ask(rl, 'Password (min 8 chars, letters + numbers): ', { hidden: true });
        const again = await ask(rl, 'Repeat password: ', { hidden: true });
        if (password !== again) throw new Error('Passwords did not match. Nothing was changed.');
      }
    } finally {
      rl.close();
    }
  }

  const { errors, values } = validateUserInput({ username, name: name || username, email });
  errors.push(...validatePassword(password));
  if (errors.length) throw new Error('Could not save the admin account:\n - ' + errors.join('\n - '));

  await connectDB();

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const existing = await User.findOne({ username: values.username });

  if (existing) {
    const emailOwner = await User.findOne({ email: values.email, _id: { $ne: existing._id } });
    if (emailOwner) throw new Error('The email "' + values.email + '" already belongs to a different account (' + emailOwner.username + '). Nothing was changed.');
    existing.passwordHash = passwordHash;
    existing.role = 'admin';
    existing.active = true;
    existing.resetTokenHash = undefined;
    existing.resetTokenExpires = undefined;
    await existing.save();
    await ActivityLog.create({ username: 'system', action: 'user.admin_reset_cli', entityType: 'User', entityId: String(existing._id), message: 'Admin account "' + existing.username + '" reset from the command line' });
    console.log('\nExisting account "' + existing.username + '" was updated: password reset, role = admin, account active.');
  } else {
    const emailOwner = await User.findOne({ email: values.email });
    if (emailOwner) throw new Error('The email "' + values.email + '" already belongs to the account "' + emailOwner.username + '". Use a different ADMIN_EMAIL. Nothing was changed.');
    const user = await User.create({ username: values.username, name: values.name, email: values.email, passwordHash, role: 'admin' });
    await ActivityLog.create({ username: 'system', action: 'user.admin_created_cli', entityType: 'User', entityId: String(user._id), message: 'Admin account "' + user.username + '" created from the command line' });
    console.log('\nAdministrator "' + user.username + '" created in database "' + mongoose.connection.name + '".');
  }
  console.log('You can now log in at http://localhost:' + require('../config/env').config.port + '/login');
  if (process.env.ADMIN_PASSWORD) console.log('Tip: remove ADMIN_PASSWORD from your .env file now that the account exists.');
}

main()
  .catch((err) => {
    console.error('\n' + err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
