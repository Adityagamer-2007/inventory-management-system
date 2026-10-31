const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { LOW_STOCK } = require('./dashboardService');
const { stockStatus, round2 } = require('./stockRules');
const { createdAtFilter } = require('../utils/dates');

const REPORT_TYPES = [
  { key: 'stock', label: 'Current stock', usesDates: false },
  { key: 'low-stock', label: 'Low stock', usesDates: false },
  { key: 'valuation', label: 'Inventory valuation', usesDates: false },
  { key: 'product-wise', label: 'Product-wise movement', usesDates: true },
  { key: 'stock-in', label: 'Stock In', usesDates: true },
  { key: 'stock-out', label: 'Stock Out', usesDates: true },
  { key: 'transactions', label: 'All transactions', usesDates: true },
];

const STATUS_TEXT = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' };

function productRows(products) {
  return products.map((p) => ({
    name: p.name,
    sku: p.sku,
    category: p.category ? p.category.name : '',
    supplier: p.supplier ? p.supplier.name : '',
    quantity: p.quantity,
    minStock: p.minStock,
    status: STATUS_TEXT[stockStatus(p.quantity, p.minStock)],
  }));
}

const POPULATE = [{ path: 'category', select: 'name' }, { path: 'supplier', select: 'name' }];

async function buildReport(type, range) {
  const dateFilter = createdAtFilter(range);

  if (type === 'stock') {
    const products = await Product.find().sort({ name: 1 }).populate(POPULATE).lean();
    return {
      title: 'Current stock report',
      columns: [
        { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
        { key: 'supplier', label: 'Supplier' }, { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'minStock', label: 'Minimum', type: 'number' }, { key: 'status', label: 'Status' },
      ],
      rows: productRows(products),
      summary: [
        { label: 'Products', value: products.length },
        { label: 'Total units', value: products.reduce((s, p) => s + p.quantity, 0) },
      ],
    };
  }

  if (type === 'low-stock') {
    const products = await Product.find(LOW_STOCK).sort({ quantity: 1 }).populate(POPULATE).lean();
    return {
      title: 'Low-stock report',
      columns: [
        { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
        { key: 'supplier', label: 'Supplier' }, { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'minStock', label: 'Minimum', type: 'number' }, { key: 'status', label: 'Status' },
      ],
      rows: productRows(products),
      summary: [{ label: 'Products needing restock', value: products.length }],
    };
  }

  if (type === 'valuation') {
    const products = await Product.find().sort({ name: 1 }).populate(POPULATE).lean();
    const rows = products.map((p) => ({
      name: p.name, sku: p.sku, quantity: p.quantity,
      purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice,
      costValue: round2(p.quantity * p.purchasePrice),
      retailValue: round2(p.quantity * p.sellingPrice),
    }));
    const cost = round2(rows.reduce((s, r) => s + r.costValue, 0));
    const retail = round2(rows.reduce((s, r) => s + r.retailValue, 0));
    return {
      title: 'Inventory valuation report',
      columns: [
        { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'purchasePrice', label: 'Purchase price', type: 'money' }, { key: 'sellingPrice', label: 'Selling price', type: 'money' },
        { key: 'costValue', label: 'Stock value at cost', type: 'money' }, { key: 'retailValue', label: 'Stock value at selling price', type: 'money' },
      ],
      rows,
      summary: [
        { label: 'Total value at cost', value: cost, type: 'money' },
        { label: 'Total value at selling price', value: retail, type: 'money' },
        { label: 'Potential gross profit', value: round2(retail - cost), type: 'money' },
      ],
    };
  }

  if (type === 'product-wise') {
    const [products, agg] = await Promise.all([
      Product.find().sort({ name: 1 }).populate(POPULATE).lean(),
      StockTransaction.aggregate([
        { $match: dateFilter },
        { $group: { _id: { product: '$product', type: '$type' }, qty: { $sum: '$quantity' } } },
      ]),
    ]);
    const map = {};
    for (const a of agg) map[a._id.product + '|' + a._id.type] = a.qty;
    const rows = products.map((p) => {
      const inQty = map[p._id + '|in'] || 0;
      const outQty = map[p._id + '|out'] || 0;
      return { name: p.name, sku: p.sku, category: p.category ? p.category.name : '', stockIn: inQty, stockOut: outQty, net: inQty - outQty, quantity: p.quantity };
    });
    return {
      title: 'Product-wise inventory report',
      columns: [
        { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
        { key: 'stockIn', label: 'Stock in', type: 'number' }, { key: 'stockOut', label: 'Stock out', type: 'number' },
        { key: 'net', label: 'Net change', type: 'number' }, { key: 'quantity', label: 'Current stock', type: 'number' },
      ],
      rows,
      summary: [
        { label: 'Total stock in', value: rows.reduce((s, r) => s + r.stockIn, 0) },
        { label: 'Total stock out', value: rows.reduce((s, r) => s + r.stockOut, 0) },
      ],
    };
  }

  // stock-in, stock-out, transactions
  const filter = { ...dateFilter };
  let title = 'Transaction report';
  if (type === 'stock-in') { filter.type = 'in'; title = 'Stock In report'; }
  if (type === 'stock-out') { filter.type = 'out'; title = 'Stock Out report'; }
  const txns = await StockTransaction.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
  const rows = txns.map((t) => ({
    date: t.createdAt, product: t.productName, sku: t.sku, type: t.type === 'in' ? 'Stock In' : 'Stock Out',
    quantity: t.quantity, previousStock: t.previousStock, newStock: t.newStock, user: t.username, note: t.note,
  }));
  return {
    title,
    columns: [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'product', label: 'Product' }, { key: 'sku', label: 'SKU' },
      { key: 'type', label: 'Type' }, { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'previousStock', label: 'Previous', type: 'number' }, { key: 'newStock', label: 'New', type: 'number' },
      { key: 'user', label: 'User' }, { key: 'note', label: 'Note' },
    ],
    rows,
    summary: [
      { label: 'Transactions', value: rows.length },
      { label: 'Total units moved', value: rows.reduce((s, r) => s + r.quantity, 0) },
    ],
  };
}

module.exports = { buildReport, REPORT_TYPES };
