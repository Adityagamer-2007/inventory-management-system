const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { evaluateMovement } = require('./stockRules');

class StockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockError';
    this.userMessage = message;
  }
}

// null = not tested yet, true/false after the first attempt.
let transactionsSupported = null;

function isTransactionUnsupported(err) {
  const msg = String((err && err.message) || '');
  return err && (err.code === 20 || /replica set|Transaction numbers|transactions are not supported/i.test(msg));
}

// One atomic update: stock out only succeeds if enough stock is still there.
async function updateStock({ productId, type, quantity, session }) {
  const delta = type === 'in' ? quantity : -quantity;
  const filter = { _id: productId };
  if (type === 'out') filter.quantity = { $gte: quantity };
  const product = await Product.findOneAndUpdate(filter, { $inc: { quantity: delta } }, { new: true, session });
  if (!product) {
    const exists = await Product.findById(productId).session(session || null).select('quantity');
    if (!exists) throw new StockError('Product not found.');
    const check = evaluateMovement(type, quantity, exists.quantity);
    throw new StockError(check.error || 'Stock could not be updated.');
  }
  return { product, delta };
}

function buildRecord({ product, delta, type, quantity, note, user }) {
  return {
    product: product._id,
    productName: product.name,
    sku: product.sku,
    type,
    quantity,
    previousStock: product.quantity - delta,
    newStock: product.quantity,
    user: user._id,
    username: user.username,
    note: note || '',
  };
}

async function withTransaction({ productId, type, quantity, note, user }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const { product, delta } = await updateStock({ productId, type, quantity, session });
      const [txn] = await StockTransaction.create([buildRecord({ product, delta, type, quantity, note, user })], { session });
      result = { product, transaction: txn };
    });
    return result;
  } finally {
    session.endSession();
  }
}

// Fallback for MongoDB without replica set (e.g. a plain local install).
// The stock change is atomic. If saving the history record fails, the change is undone.
async function withoutTransaction({ productId, type, quantity, note, user }) {
  const { product, delta } = await updateStock({ productId, type, quantity });
  try {
    const txn = await StockTransaction.create(buildRecord({ product, delta, type, quantity, note, user }));
    return { product, transaction: txn };
  } catch (err) {
    await Product.updateOne({ _id: productId }, { $inc: { quantity: -delta } });
    throw err;
  }
}

async function applyMovement(args) {
  if (transactionsSupported !== false) {
    try {
      const result = await withTransaction(args);
      transactionsSupported = true;
      return result;
    } catch (err) {
      if (isTransactionUnsupported(err)) transactionsSupported = false;
      else throw err;
    }
  }
  return withoutTransaction(args);
}

module.exports = { applyMovement, StockError };
