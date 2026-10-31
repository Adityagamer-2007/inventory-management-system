const ActivityLog = require('../models/ActivityLog');

// Records who did what. Never pass passwords or tokens in `message`.
async function logActivity(req, action, entityType, entityId, message) {
  try {
    const user = req && req.user;
    await ActivityLog.create({
      user: user ? user._id : undefined,
      username: user ? user.username : 'system',
      action,
      entityType: entityType || '',
      entityId: entityId ? String(entityId) : '',
      message: String(message).slice(0, 400),
      ip: req && req.ip ? req.ip : '',
    });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

module.exports = { logActivity };
