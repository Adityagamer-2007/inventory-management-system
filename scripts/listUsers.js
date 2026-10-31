// Shows which accounts exist (username, email, role, active). Never prints password hashes.
//   npm run list-users
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  await connectDB();
  const users = await User.find().sort({ createdAt: 1 }).select('username email role active lastLoginAt').lean();
  if (!users.length) {
    console.log('\nNo users exist in this database. Run:  npm run create-admin');
    return;
  }
  console.log('\nExisting accounts:');
  console.table(users.map((u) => ({ username: u.username, email: u.email, role: u.role, active: u.active, lastLogin: u.lastLoginAt ? u.lastLoginAt.toISOString() : 'never' })));
  console.log('If your account is listed but you forgot the password, run:  npm run reset-password');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
