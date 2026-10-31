const path = require('path');
// Always load the .env that sits next to package.json, no matter which folder the command is run from.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  isProduction,
  port: parseInt(process.env.PORT, 10) || 3000,
  // No localhost fallback: the database must be configured explicitly in .env (MongoDB Atlas).
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  dbName: (process.env.MONGODB_DB || 'inventory_management').trim(),
  sessionSecret: process.env.SESSION_SECRET,
  allowRegistration: String(process.env.ALLOW_REGISTRATION).toLowerCase() === 'true',
  cookieSecure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  appName: 'Inventory Management System',
};

// Hides "user:password@" so credentials never reach the terminal.
function redact(text) {
  return String(text).replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1***:***@');
}

// Checks the MongoDB settings only (used by the app AND by the scripts).
function assertDbConfig() {
  const uri = config.mongoUri;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Copy .env.example to .env and paste your MongoDB Atlas connection string.');
  }
  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  if (/[<>]/.test(uri.split('@')[0]) || /<[^>]*>/.test(uri)) {
    throw new Error('MONGODB_URI still contains a placeholder such as <username> or <password>. Remove the < > brackets and use your real Atlas database user and password.');
  }
}

function assertConfig() {
  assertDbConfig();
  const secret = config.sessionSecret;
  if (!secret || secret.length < 16 || secret.startsWith('replace-me')) {
    throw new Error(
      'SESSION_SECRET is missing or too weak. Copy .env.example to .env and set a long random SESSION_SECRET.'
    );
  }
}

module.exports = { config, assertConfig, assertDbConfig, redact };
