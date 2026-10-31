// Loads fictional sample data. Run "npm run create-admin" first so the sample
// stock history can be attributed to a real user.
//   npm run seed          adds sample data (skips items that already exist)
//   npm run seed:reset    deletes products, categories, suppliers and stock history first
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const User = require('../models/User');

const categories = [
  ['Stationery', 'Pens, paper and desk items'],
  ['Electronics', 'Cables, chargers and small devices'],
  ['Furniture', 'Chairs, desks and storage'],
  ['Cleaning', 'Cleaning and hygiene supplies'],
  ['Packaging', 'Boxes, tape and wrapping'],
];

const suppliers = [
  ['Northwind Traders', '+91 98100 11111', 'sales@northwind.example', '12 Market Road, Delhi'],
  ['BrightLine Supplies', '+91 98100 22222', 'orders@brightline.example', '48 Industrial Area, Noida'],
  ['Summit Wholesale', '+91 98100 33333', 'hello@summit.example', '5 Trade Centre, Gurugram'],
];

// name, sku, category, supplier, purchase, selling, quantity, min, description
const products = [
  ['Ballpoint Pen (Blue, Box of 50)', 'STA-001', 'Stationery', 'Northwind Traders', 180, 260, 120, 30, 'Smooth blue ballpoint pens.'],
  ['A4 Copier Paper (500 sheets)', 'STA-002', 'Stationery', 'Northwind Traders', 210, 290, 14, 20, '75 GSM white copier paper.'],
  ['Spiral Notebook A5', 'STA-003', 'Stationery', 'Summit Wholesale', 35, 60, 85, 25, '160 pages, ruled.'],
  ['USB-C Charging Cable 1m', 'ELE-001', 'Electronics', 'BrightLine Supplies', 90, 199, 60, 15, 'Braided fast-charge cable.'],
  ['Wireless Mouse', 'ELE-002', 'Electronics', 'BrightLine Supplies', 320, 549, 8, 10, '2.4 GHz optical mouse.'],
  ['HDMI Cable 2m', 'ELE-003', 'Electronics', 'BrightLine Supplies', 140, 260, 0, 8, 'High-speed HDMI cable.'],
  ['Office Chair (Mesh Back)', 'FUR-001', 'Furniture', 'Summit Wholesale', 3200, 4800, 12, 4, 'Adjustable height office chair.'],
  ['Steel Filing Cabinet', 'FUR-002', 'Furniture', 'Summit Wholesale', 5200, 7400, 3, 3, 'Four-drawer filing cabinet.'],
  ['Hand Sanitizer 500ml', 'CLE-001', 'Cleaning', 'Northwind Traders', 75, 130, 45, 20, 'Alcohol-based sanitizer.'],
  ['Floor Cleaner 1L', 'CLE-002', 'Cleaning', 'Northwind Traders', 85, 150, 30, 10, 'Citrus floor cleaner.'],
  ['Packing Tape (Pack of 6)', 'PAC-001', 'Packaging', 'Summit Wholesale', 120, 210, 70, 20, 'Clear 48mm tape.'],
  ['Cardboard Box Medium (Bundle of 10)', 'PAC-002', 'Packaging', 'Summit Wholesale', 160, 270, 18, 15, 'Corrugated shipping boxes.'],
];

async function main() {
  await connectDB();

  if (process.argv.includes('--reset')) {
    await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Supplier.deleteMany({}), StockTransaction.deleteMany({})]);
    console.log('Existing inventory data removed (users were NOT touched).');
  }

  const catMap = {};
  for (const [name, description] of categories) {
    const doc = (await Category.findOne({ name }).collation({ locale: 'en', strength: 2 })) || (await Category.create({ name, description }));
    catMap[name] = doc._id;
  }
  const supMap = {};
  for (const [name, phone, email, address] of suppliers) {
    const doc = (await Supplier.findOne({ name }).collation({ locale: 'en', strength: 2 })) || (await Supplier.create({ name, phone, email, address }));
    supMap[name] = doc._id;
  }

  const admin = await User.findOne({ role: 'admin', active: true });
  let created = 0;
  let history = 0;
  for (const [name, sku, cat, sup, purchasePrice, sellingPrice, quantity, minStock, description] of products) {
    if (await Product.exists({ sku })) continue;
    const product = await Product.create({ name, sku, description, category: catMap[cat], supplier: supMap[sup], purchasePrice, sellingPrice, quantity, minStock });
    created++;

    // Fake history that adds up to the current quantity: one big stock-in, plus a stock-out/stock-in pair.
    if (admin && quantity > 0) {
      const out = Math.max(1, Math.floor(quantity * 0.2));
      const first = quantity + out;
      const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
      const base = { product: product._id, productName: name, sku, user: admin._id, username: admin.username };
      await StockTransaction.create([
        { ...base, type: 'in', quantity: first, previousStock: 0, newStock: first, note: 'Opening stock (sample data)', createdAt: daysAgo(9), updatedAt: daysAgo(9) },
        { ...base, type: 'out', quantity: out, previousStock: first, newStock: quantity, note: 'Sample sale', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      ], { timestamps: false });
      history += 2;
    }
  }

  console.log('Seed finished: ' + created + ' product(s) added, ' + history + ' stock transaction(s) added.');
  if (!admin) console.log('Note: no administrator exists yet, so no sample stock history was created. Run "npm run create-admin", then "npm run seed:reset".');
}

main()
  .catch((err) => {
    console.error('Seed failed: ' + err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
