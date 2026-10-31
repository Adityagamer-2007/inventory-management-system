const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Snapshots keep history readable even if the product is deleted later.
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    type: { type: String, enum: ['in', 'out'], required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    note: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
