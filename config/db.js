const mongoose = require('mongoose');
const { config, assertDbConfig, redact } = require('./env');

mongoose.set('strictQuery', true);

// True when the connection string already names a database (".../inventory_management?...").
function uriHasDbName(uri) {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i);
  return !!(m && m[1]);
}

async function connectDB() {
  assertDbConfig();
  const options = { serverSelectionTimeoutMS: 15000 };
  // Atlas strings copied from the dashboard have no database name; without this MongoDB would use "test".
  if (!uriHasDbName(config.mongoUri)) options.dbName = config.dbName;
  try {
    await mongoose.connect(config.mongoUri, options);
    console.log('MongoDB connected: ' + mongoose.connection.name + ' @ ' + mongoose.connection.host);
  } catch (err) {
    console.error('\nCould not connect to MongoDB.');
    console.error('Reason: ' + redact(err.message));
    if (/bad auth|authentication failed/i.test(err.message)) {
      console.error('Hint: wrong Atlas database username or password in MONGODB_URI (Atlas > Database Access).');
    } else if (/ENOTFOUND|EAI_AGAIN|ETIMEOUT|querySrv/i.test(err.message)) {
      console.error('Hint: DNS/network problem. Check your internet connection and the host names in MONGODB_URI.');
    } else if (/Server selection timed out|Could not connect to any servers|whitelist|ECONNREFUSED|ReplicaSetNoPrimary|ssl|tls/i.test(err.message)) {
      console.error('Hint: Atlas > Network Access must allow your current IP address (or 0.0.0.0/0 for testing).');
    }
    console.error('See the "MongoDB Atlas setup" section of README.md.\n');
    throw err;
  }
}

module.exports = connectDB;
