const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { validateSupplier, escapeRegex, isValidObjectId } = require('../utils/validators');
const { logActivity } = require('../utils/activity');

exports.list = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const filter = {};
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
    }
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();
    const counts = await Product.aggregate([{ $group: { _id: '$supplier', n: { $sum: 1 } } }]);
    const countMap = {};
    counts.forEach((c) => { countMap[c._id] = c.n; });
    res.render('suppliers/index', { title: 'Suppliers', suppliers, countMap, q });
  } catch (err) { next(err); }
};

exports.showNew = (req, res) => res.render('suppliers/form', { title: 'Add supplier', supplier: {}, errors: [], isEdit: false });

exports.create = async (req, res, next) => {
  try {
    const { errors, values } = validateSupplier(req.body);
    if (errors.length) return res.status(400).render('suppliers/form', { title: 'Add supplier', supplier: values, errors, isEdit: false });
    try {
      const s = await Supplier.create(values);
      await logActivity(req, 'supplier.create', 'Supplier', s._id, 'Created supplier "' + s.name + '"');
    } catch (err) {
      if (err.code === 11000) return res.status(400).render('suppliers/form', { title: 'Add supplier', supplier: values, errors: ['A supplier with that name already exists.'], isEdit: false });
      throw err;
    }
    req.flash('success', 'Supplier added.');
    res.redirect('/suppliers');
  } catch (err) { next(err); }
};

exports.showEdit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return next();
    res.render('suppliers/form', { title: 'Edit supplier', supplier, errors: [], isEdit: true });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return next();
    const { errors, values } = validateSupplier(req.body);
    if (errors.length) return res.status(400).render('suppliers/form', { title: 'Edit supplier', supplier: { _id: supplier._id, ...values }, errors, isEdit: true });
    Object.assign(supplier, values);
    try {
      await supplier.save();
    } catch (err) {
      if (err.code === 11000) return res.status(400).render('suppliers/form', { title: 'Edit supplier', supplier: { _id: supplier._id, ...values }, errors: ['A supplier with that name already exists.'], isEdit: true });
      throw err;
    }
    await logActivity(req, 'supplier.update', 'Supplier', supplier._id, 'Updated supplier "' + supplier.name + '"');
    req.flash('success', 'Supplier updated.');
    res.redirect('/suppliers');
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return next();
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return next();
    const inUse = await Product.countDocuments({ supplier: supplier._id });
    if (inUse > 0) {
      req.flash('danger', 'Cannot delete "' + supplier.name + '": ' + inUse + ' product(s) still use it. Move or delete those products first.');
      return res.redirect('/suppliers');
    }
    await supplier.deleteOne();
    await logActivity(req, 'supplier.delete', 'Supplier', supplier._id, 'Deleted supplier "' + supplier.name + '"');
    req.flash('success', 'Supplier deleted.');
    res.redirect('/suppliers');
  } catch (err) { next(err); }
};
