const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    minStock: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
      validate: { validator: Number.isInteger, message: 'Minimum stock must be a whole number' },
    },
    image: { type: String, default: '' }, // file name inside public/uploads
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ quantity: 1 });

module.exports = mongoose.model('Product', productSchema);
