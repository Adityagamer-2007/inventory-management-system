const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const StockTransaction = require('../models/StockTransaction');
const { validateProduct, escapeRegex, isValidObjectId } = require('../utils/validators');
const { paginate, buildPageInfo } = require('../utils/pagination');
const { deleteUpload } = require('../utils/files');
const { logActivity } = require('../utils/activity');

async function formData() {
  const [categories, suppliers] = await Promise.all([Category.find().sort({ name: 1 }).lean(), Supplier.find().sort({ name: 1 }).lean()]);
  return { categories, suppliers };
}

exports.list = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const category = isValidObjectId(req.query.category) ? req.query.category : '';
    const supplier = isValidObjectId(req.query.supplier) ? req.query.supplier : '';
    const filter = {};
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { sku: re }];
    }
    if (category) filter.category = category;
    if (supplier) filter.supplier = supplier;

    const { page, limit, skip } = paginate(req.query, 10);
    const [total, products, lists] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).populate('category', 'name').populate('supplier', 'name').lean(),
      formData(),
    ]);
    res.render('products/index', {
      title: 'Products', products, ...lists, q, category, supplier,
      pageInfo: buildPageInfo(page, limit, total),
    });
  } catch (err) { next(err); }
};

exports.showNew = async (req, res, next) => {
  try {
    res.render('products/form', { title: 'Add product', product: {}, errors: [], isEdit: false, ...(await formData()) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { errors, values } = validateProduct(req.body);
    if (req.uploadError) errors.push(req.uploadError);
    if (!errors.length) {
      const [cat, sup] = await Promise.all([Category.exists({ _id: values.category }), Supplier.exists({ _id: values.supplier })]);
      if (!cat) errors.push('The selected category does not exist.');
      if (!sup) errors.push('The selected supplier does not exist.');
      if (await Product.exists({ sku: values.sku })) errors.push('A product with SKU "' + values.sku + '" already exists.');
    }
    if (errors.length) {
      if (req.savedImage) deleteUpload(req.savedImage);
      return res.status(400).render('products/form', { title: 'Add product', product: values, errors, isEdit: false, ...(await formData()) });
    }
    let product;
    try {
      product = await Product.create({ ...values, image: req.savedImage || '' });
    } catch (err) {
      if (req.savedImage) deleteUpload(req.savedImage);
      if (err.code === 11000) {
        return res.status(400).render('products/form', { title: 'Add product', product: values, errors: ['A product with that SKU already exists.'], isEdit: false, ...(await formData()) });
      }
      throw err;
    }
    // Opening stock is recorded as a Stock In so the history always adds up.
    if (product.quantity > 0) {
      await StockTransaction.create({
        product: product._id, productName: product.name, sku: product.sku, type: 'in', quantity: product.quantity,
        previousStock: 0, newStock: product.quantity, user: req.user._id, username: req.user.username, note: 'Opening stock',
      });
    }
    await logActivity(req, 'product.create', 'Product', product._id, 'Created product "' + product.name + '" (' + product.sku + ')');
    req.flash('success', 'Product added.');
    res.redirect('/products/' + product._id);
  } catch (err) { next(err); }
};

exports.show = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const product = await Product.findById(req.params.id).populate('category', 'name').populate('supplier', 'name phone email').lean();
    if (!product) return next();
    const history = await StockTransaction.find({ product: product._id }).sort({ createdAt: -1 }).limit(10).lean();
    res.render('products/show', { title: product.name, product, history });
  } catch (err) { next(err); }
};

exports.showEdit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const product = await Product.findById(req.params.id).lean();
    if (!product) return next();
    res.render('products/form', { title: 'Edit product', product, errors: [], isEdit: true, ...(await formData()) });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const product = await Product.findById(req.params.id);
    if (!product) return next();
    const { errors, values } = validateProduct({ ...req.body, quantity: String(product.quantity) });
    if (req.uploadError) errors.push(req.uploadError);
    if (!errors.length) {
      const [cat, sup, dup] = await Promise.all([
        Category.exists({ _id: values.category }),
        Supplier.exists({ _id: values.supplier }),
        Product.exists({ sku: values.sku, _id: { $ne: product._id } }),
      ]);
      if (!cat) errors.push('The selected category does not exist.');
      if (!sup) errors.push('The selected supplier does not exist.');
      if (dup) errors.push('Another product already uses SKU "' + values.sku + '".');
    }
    if (errors.length) {
      if (req.savedImage) deleteUpload(req.savedImage);
      return res.status(400).render('products/form', { title: 'Edit product', product: { ...values, _id: product._id, image: product.image }, errors, isEdit: true, ...(await formData()) });
    }
    const oldImage = product.image;
    // Quantity is NOT editable here: it only changes through Stock In / Stock Out so history stays accurate.
    const { quantity, ...editable } = values; // eslint-disable-line no-unused-vars
    Object.assign(product, editable);
    if (req.savedImage) product.image = req.savedImage;
    else if (req.body.removeImage === 'on') product.image = '';
    try {
      await product.save();
    } catch (err) {
      if (req.savedImage) deleteUpload(req.savedImage);
      if (err.code === 11000) {
        return res.status(400).render('products/form', { title: 'Edit product', product: { ...values, _id: product._id, image: oldImage }, errors: ['Another product already uses that SKU.'], isEdit: true, ...(await formData()) });
      }
      throw err;
    }
    if (oldImage && oldImage !== product.image) deleteUpload(oldImage);
    await logActivity(req, 'product.update', 'Product', product._id, 'Updated product "' + product.name + '" (' + product.sku + ')');
    req.flash('success', 'Product updated.');
    res.redirect('/products/' + product._id);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const product = await Product.findById(req.params.id);
    if (!product) return next();
    await product.deleteOne();
    if (product.image) deleteUpload(product.image);
    await logActivity(req, 'product.delete', 'Product', product._id, 'Deleted product "' + product.name + '" (' + product.sku + ')');
    req.flash('success', 'Product deleted. Its stock history was kept.');
    res.redirect('/products');
  } catch (err) { next(err); }
};

exports.lowStock = async (req, res, next) => {
  try {
    const products = await Product.find({ $expr: { $lte: ['$quantity', '$minStock'] } })
      .sort({ quantity: 1 }).populate('category', 'name').populate('supplier', 'name phone').lean();
    res.render('products/low-stock', { title: 'Low-stock alerts', products });
  } catch (err) { next(err); }
};
