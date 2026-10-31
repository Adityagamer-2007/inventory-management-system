// Sets a new password for an EXISTING account. Nothing is deleted.
//   npm run reset-password                       (asks for username, then you type a new password)
//   npm run reset-password -- aditya             (username given)
//   npm run reset-password -- aditya --generate  (creates a random password and prints it once, here)
//   add --activate to also re-activate a deactivated account
const readline = require('readline');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { validatePassword } = require('../utils/validators');
const { generatePassword } = require('../utils/passwords');

function ask(rl, question, hidden) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(question, resolve);
    process.stdout.write(question);
    const original = rl._writeToOutput;
    rl._writeToOutput = () => {};
    rl.question('', (a) => { rl._writeToOutput = original; process.stdout.write('\n'); resolve(a); });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  let identifier = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();
  const generate = flags.includes('--generate');
  const activate = flags.includes('--activate');

  await connectDB();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  try {
    if (!identifier) identifier = (await ask(rl, 'Username or email of the account: ', false)).trim().toLowerCase();
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user) {
      console.log('\nNo account matches "' + identifier + '". Run "npm run list-users" to see the real usernames,');
      console.log('or "npm run create-admin" if no users exist yet.');
      process.exitCode = 1;
      return;
    }

    let password;
    if (generate) {
      password = generatePassword();
    } else {
      password = await ask(rl, 'New password (min 8 chars, letters + numbers): ', true);
      const again = await ask(rl, 'Repeat new password: ', true);
      if (password !== again) throw new Error('Passwords did not match. Nothing was changed.');
    }
    const problems = validatePassword(password);
    if (problems.length) throw new Error('Password rejected:\n - ' + problems.join('\n - '));

    // Same library and cost as the application (bcrypt, 12 rounds).
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    if (activate) user.active = true;
    await user.save();
    await ActivityLog.create({ username: 'system', action: 'user.password_reset_cli', entityType: 'User', entityId: String(user._id), message: 'Password reset from the command line for ' + user.username });

    console.log('\nPassword updated for "' + user.username + '" (role: ' + user.role + ').');
    if (generate) console.log('New password (shown once, change it later in Account settings): ' + password);
    if (!user.active) console.log('Warning: this account is DEACTIVATED and cannot log in. Re-run with --activate to enable it.');
  } finally {
    rl.close();
  }
}

main().catch((e) => { console.error('\n' + e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
