const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { applyMovement, StockError } = require('../services/stockService');
const { validateMovementInput, escapeRegex, isValidObjectId } = require('../utils/validators');
const { parseDateRange, createdAtFilter } = require('../utils/dates');
const { paginate, buildPageInfo } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');

const TYPES = {
  in: { title: 'Stock In', verb: 'added to', logVerb: 'Stock In' },
  out: { title: 'Stock Out', verb: 'removed from', logVerb: 'Stock Out' },
};

async function products() {
  return Product.find().sort({ name: 1 }).select('name sku quantity').lean();
}

exports.showForm = (type) => async (req, res, next) => {
  try {
    const selected = isValidObjectId(req.query.product) ? req.query.product : '';
    res.render('stock/form', { title: TYPES[type].title, type, products: await products(), form: { product: selected }, errors: [] });
  } catch (err) { next(err); }
};

exports.submit = (type) => async (req, res, next) => {
  try {
    const { errors, values } = validateMovementInput(req.body);
    const rerender = async (status) =>
      res.status(status).render('stock/form', { title: TYPES[type].title, type, products: await products(), form: values, errors });

    if (errors.length) return rerender(400);
    try {
      const { product, transaction } = await applyMovement({ productId: values.product, type, quantity: values.quantity, note: values.note, user: req.user });
      await logActivity(req, 'stock.' + type, 'Product', product._id,
        TYPES[type].logVerb + ': ' + values.quantity + ' x "' + product.name + '" (' + transaction.previousStock + ' -> ' + transaction.newStock + ')');
      req.flash('success', values.quantity + ' unit(s) ' + TYPES[type].verb + ' "' + product.name + '". New stock: ' + product.quantity + '.');
      if (product.quantity <= product.minStock) req.flash('warning', '"' + product.name + '" is now at or below its minimum stock (' + product.minStock + ').');
      return res.redirect('/stock/transactions');
    } catch (err) {
      if (err instanceof StockError) { errors.push(err.userMessage); return rerender(400); }
      throw err;
    }
  } catch (err) { next(err); }
};

exports.history = async (req, res, next) => {
  try {
    const type = ['in', 'out'].includes(req.query.type) ? req.query.type : '';
    const q = String(req.query.q || '').trim().slice(0, 80);
    const range = parseDateRange(String(req.query.from || ''), String(req.query.to || ''));

    const filter = { ...createdAtFilter(range) };
    if (type) filter.type = type;
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ productName: re }, { sku: re }];
    }
    const { page, limit, skip } = paginate(req.query, 15);
    const [total, transactions] = await Promise.all([
      StockTransaction.countDocuments(filter),
      StockTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.render('stock/history', {
      title: 'Transaction history', transactions, type, q,
      from: String(req.query.from || ''), to: String(req.query.to || ''),
      pageInfo: buildPageInfo(page, limit, total),
      dateError: range.error,
    });
  } catch (err) { next(err); }
};
