const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const mongoose = require('mongoose');

const { config, assertConfig } = require('./config/env');
const connectDB = require('./config/db');
const { loadUser } = require('./middleware/auth');
const flash = require('./middleware/flash');
const csrf = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errors');
const format = require('./utils/format');
const { stockStatus } = require('./services/stockRules');
const Product = require('./models/Product');
const routes = require('./routes');

function buildApp() {
  const app = express();
  if (config.isProduction) app.set('trust proxy', 1);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
          'style-src': ["'self'", 'https://cdn.jsdelivr.net'],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'", 'https://cdn.jsdelivr.net'],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      strictTransportSecurity: config.isProduction,
    })
  );

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.isProduction ? '1d' : 0 }));

  app.use(
    session({
      name: 'ims.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'sessions', ttl: 8 * 60 * 60 }),
      cookie: { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 8 * 60 * 60 * 1000 },
    })
  );

  // Defaults available in every view
  app.use((req, res, next) => {
    res.locals.appName = config.appName;
    res.locals.currentUser = null;
    res.locals.lowStockCount = 0;
    res.locals.currentPath = req.path;
    res.locals.fmt = format;
    res.locals.stockStatus = stockStatus;
    res.locals.title = config.appName;
    // Builds a link to another page of the current list, keeping filters.
    res.locals.pageUrl = (page) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query)) if (k !== 'page' && typeof v === 'string') params.set(k, v);
      params.set('page', page);
      return req.path + '?' + params.toString();
    };
    next();
  });
  app.use(flash);
  app.use(csrf);
  app.use(loadUser);
  // Number shown next to "Low stock" in the sidebar.
  app.use(async (req, res, next) => {
    try {
      res.locals.lowStockCount = req.user ? await Product.countDocuments({ $expr: { $lte: ['$quantity', '$minStock'] } }) : 0;
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  assertConfig();
  await connectDB();
  const app = buildApp();
  app.listen(config.port, () => {
    console.log('Inventory Management System running at http://localhost:' + config.port);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { buildApp };
