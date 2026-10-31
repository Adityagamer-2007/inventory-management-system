const ActivityLog = require('../models/ActivityLog');
const { paginate, buildPageInfo } = require('../utils/pagination');
const { escapeRegex } = require('../utils/validators');

exports.list = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const filter = q ? { $or: [{ username: new RegExp(escapeRegex(q), 'i') }, { message: new RegExp(escapeRegex(q), 'i') }, { action: new RegExp(escapeRegex(q), 'i') }] } : {};
    const { page, limit, skip } = paginate(req.query, 20);
    const [total, logs] = await Promise.all([ActivityLog.countDocuments(filter), ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()]);
    res.render('activity/index', { title: 'Activity log', logs, q, pageInfo: buildPageInfo(page, limit, total) });
  } catch (err) { next(err); }
};
