const express = require('express');
const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');
const { requireLogin, requireRole, redirectIfLoggedIn } = require('../middleware/auth');
const { uploadProductImage } = require('../middleware/upload');

const auth = require('../controllers/authController');
const dashboard = require('../controllers/dashboardController');
const products = require('../controllers/productController');
const categories = require('../controllers/categoryController');
const suppliers = require('../controllers/supplierController');
const stock = require('../controllers/stockController');
const reports = require('../controllers/reportController');
const users = require('../controllers/userController');
const account = require('../controllers/accountController');
const activity = require('../controllers/activityController');

const router = express.Router();
const admin = requireRole('admin');

// Only failed attempts count: 10 per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('auth/login', {
      title: 'Log in', layout: 'layouts/auth', form: {}, allowRegistration: config.allowRegistration,
      errors: ['Too many failed attempts. Please wait 15 minutes and try again.'],
    }),
});
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// ---- Public / auth ----
router.get('/login', redirectIfLoggedIn, auth.showLogin);
router.post('/login', redirectIfLoggedIn, loginLimiter, auth.login);
router.post('/logout', requireLogin, auth.logout);
router.get('/reset-password/:token', resetLimiter, auth.showReset);
router.post('/reset-password/:token', resetLimiter, auth.reset);

if (config.allowRegistration) {
  router.get('/register', redirectIfLoggedIn, auth.showRegister);
  router.post('/register', redirectIfLoggedIn, loginLimiter, auth.register);
}

// ---- Everything below needs a login ----
router.use(requireLogin);

router.get('/', dashboard.index);

// Products (Staff + Admin, delete = Admin)
router.get('/products', products.list);
router.get('/products/new', products.showNew);
router.post('/products', uploadProductImage, products.create);
router.get('/products/:id', products.show);
router.get('/products/:id/edit', products.showEdit);
router.post('/products/:id/edit', uploadProductImage, products.update);
router.post('/products/:id/delete', admin, products.remove);
router.get('/low-stock', products.lowStock);

// Categories (add = Staff + Admin; edit/delete = Admin)
router.get('/categories', categories.list);
router.get('/categories/new', categories.showNew);
router.post('/categories', categories.create);
router.get('/categories/:id/edit', admin, categories.showEdit);
router.post('/categories/:id/edit', admin, categories.update);
router.post('/categories/:id/delete', admin, categories.remove);

// Suppliers (same rules as categories)
router.get('/suppliers', suppliers.list);
router.get('/suppliers/new', suppliers.showNew);
router.post('/suppliers', suppliers.create);
router.get('/suppliers/:id/edit', admin, suppliers.showEdit);
router.post('/suppliers/:id/edit', admin, suppliers.update);
router.post('/suppliers/:id/delete', admin, suppliers.remove);

// Stock
router.get('/stock/in', stock.showForm('in'));
router.post('/stock/in', stock.submit('in'));
router.get('/stock/out', stock.showForm('out'));
router.post('/stock/out', stock.submit('out'));
router.get('/stock/transactions', stock.history);

// Reports
router.get('/reports', reports.index);

// Account settings
router.get('/account', account.show);
router.post('/account/profile', account.updateProfile);
router.post('/account/password', account.changePassword);

// Admin only
router.get('/users', admin, users.list);
router.get('/users/new', admin, users.showNew);
router.post('/users', admin, users.create);
router.get('/users/:id/edit', admin, users.showEdit);
router.post('/users/:id/edit', admin, users.update);
router.post('/users/:id/toggle', admin, users.toggleActive);
router.post('/users/:id/reset-link', admin, users.createResetLink);
router.get('/activity', admin, activity.list);

module.exports = router;
