const Category = require('../models/Category');
const Product = require('../models/Product');
const { validateCategory, escapeRegex, isValidObjectId } = require('../utils/validators');
const { logActivity } = require('../utils/activity');

exports.list = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 60);
    const filter = q ? { name: new RegExp(escapeRegex(q), 'i') } : {};
    const categories = await Category.find(filter).sort({ name: 1 }).lean();
    const counts = await Product.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]);
    const countMap = {};
    counts.forEach((c) => { countMap[c._id] = c.n; });
    res.render('categories/index', { title: 'Categories', categories, countMap, q });
  } catch (err) { next(err); }
};

exports.showNew = (req, res) => res.render('categories/form', { title: 'Add category', category: {}, errors: [], isEdit: false });

exports.create = async (req, res, next) => {
  try {
    const { errors, values } = validateCategory(req.body);
    if (errors.length) return res.status(400).render('categories/form', { title: 'Add category', category: values, errors, isEdit: false });
    try {
      const c = await Category.create(values);
      await logActivity(req, 'category.create', 'Category', c._id, 'Created category "' + c.name + '"');
    } catch (err) {
      if (err.code === 11000) return res.status(400).render('categories/form', { title: 'Add category', category: values, errors: ['A category with that name already exists.'], isEdit: false });
      throw err;
    }
    req.flash('success', 'Category added.');
    res.redirect('/categories');
  } catch (err) { next(err); }
};

exports.showEdit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const category = await Category.findById(req.params.id).lean();
    if (!category) return next();
    res.render('categories/form', { title: 'Edit category', category, errors: [], isEdit: true });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const category = await Category.findById(req.params.id);
    if (!category) return next();
    const { errors, values } = validateCategory(req.body);
    if (errors.length) return res.status(400).render('categories/form', { title: 'Edit category', category: { _id: category._id, ...values }, errors, isEdit: true });
    category.name = values.name;
    category.description = values.description;
    try {
      await category.save();
    } catch (err) {
      if (err.code === 11000) return res.status(400).render('categories/form', { title: 'Edit category', category: { _id: category._id, ...values }, errors: ['A category with that name already exists.'], isEdit: true });
      throw err;
    }
    await logActivity(req, 'category.update', 'Category', category._id, 'Updated category "' + category.name + '"');
    req.flash('success', 'Category updated.');
    res.redirect('/categories');
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const category = await Category.findById(req.params.id);
    if (!category) return next();
    const inUse = await Product.countDocuments({ category: category._id });
    if (inUse > 0) {
      req.flash('danger', 'Cannot delete "' + category.name + '": ' + inUse + ' product(s) still use it. Move or delete those products first.');
      return res.redirect('/categories');
    }
    await category.deleteOne();
    await logActivity(req, 'category.delete', 'Category', category._id, 'Deleted category "' + category.name + '"');
    req.flash('success', 'Category deleted.');
    res.redirect('/categories');
  } catch (err) { next(err); }
};
