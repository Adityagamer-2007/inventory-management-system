const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, default: 'system' },
    action: { type: String, required: true }, // e.g. "product.create"
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    message: { type: String, required: true, maxlength: 400 },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
