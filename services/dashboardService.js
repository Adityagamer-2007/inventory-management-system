const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const StockTransaction = require('../models/StockTransaction');
const ActivityLog = require('../models/ActivityLog');

const LOW_STOCK = { $expr: { $lte: ['$quantity', '$minStock'] } };

async function getDashboardData() {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [totalProducts, totalCategories, totalSuppliers, qtyAgg, lowStockCount, lowStockItems, recentTransactions, recentActivity, byCategory, movements] =
    await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      Supplier.countDocuments(),
      Product.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
      Product.countDocuments(LOW_STOCK),
      Product.find(LOW_STOCK).sort({ quantity: 1 }).limit(6).populate('category', 'name').lean(),
      StockTransaction.find().sort({ createdAt: -1 }).limit(8).lean(),
      ActivityLog.find().sort({ createdAt: -1 }).limit(8).lean(),
      Product.aggregate([
        { $group: { _id: '$category', qty: { $sum: '$quantity' } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $project: { qty: 1, name: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'Unknown'] } } },
        { $sort: { qty: -1 } },
      ]),
      StockTransaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' }, qty: { $sum: '$quantity' } } },
      ]),
    ]);

  // Build a 14-day series with zeros for days that had no movement.
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days.push(key);
  }
  const lookup = {};
  for (const m of movements) lookup[m._id.day + '|' + m._id.type] = m.qty;

  return {
    totals: {
      products: totalProducts,
      categories: totalCategories,
      suppliers: totalSuppliers,
      stockQuantity: qtyAgg.length ? qtyAgg[0].total : 0,
      lowStock: lowStockCount,
    },
    lowStockItems,
    recentTransactions,
    recentActivity,
    charts: {
      stockByCategory: { labels: byCategory.map((c) => c.name), values: byCategory.map((c) => c.qty) },
      movements: {
        labels: days.map((d) => d.slice(5)),
        stockIn: days.map((d) => lookup[d + '|in'] || 0),
        stockOut: days.map((d) => lookup[d + '|out'] || 0),
      },
    },
  };
}

module.exports = { getDashboardData, LOW_STOCK };
