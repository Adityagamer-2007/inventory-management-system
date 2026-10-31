function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Whole number string -> number, or NaN
function parseWhole(value) {
  const s = str(String(value ?? ''));
  return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
}

// Money with at most 2 decimals -> number, or NaN
function parseMoney(value) {
  const s = str(String(value ?? ''));
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return parseFloat(s);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const SKU_RE = /^[A-Za-z0-9._-]{2,40}$/;

function validatePassword(password) {
  const errors = [];
  if (typeof password !== 'string' || password.length < 8) errors.push('Password must be at least 8 characters.');
  else {
    if (password.length > 72) errors.push('Password must be 72 characters or fewer.');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.push('Password must contain at least one letter and one number.');
  }
  return errors;
}

function validateProduct(body) {
  const errors = [];
  const v = {
    name: str(body.name),
    sku: str(body.sku).toUpperCase(),
    description: str(body.description),
    category: str(body.category),
    supplier: str(body.supplier),
    purchasePrice: parseMoney(body.purchasePrice),
    sellingPrice: parseMoney(body.sellingPrice),
    quantity: parseWhole(body.quantity === undefined || body.quantity === '' ? '0' : body.quantity),
    minStock: parseWhole(body.minStock === undefined || body.minStock === '' ? '5' : body.minStock),
  };
  if (v.name.length < 2 || v.name.length > 120) errors.push('Product name must be 2 to 120 characters.');
  if (!SKU_RE.test(v.sku)) errors.push('SKU must be 2 to 40 characters: letters, numbers, dot, dash or underscore.');
  if (v.description.length > 1000) errors.push('Description must be 1000 characters or fewer.');
  if (!isValidObjectId(v.category)) errors.push('Please choose a category.');
  if (!isValidObjectId(v.supplier)) errors.push('Please choose a supplier.');
  if (Number.isNaN(v.purchasePrice)) errors.push('Purchase price must be a number of 0 or more with up to 2 decimals.');
  if (Number.isNaN(v.sellingPrice)) errors.push('Selling price must be a number of 0 or more with up to 2 decimals.');
  if (Number.isNaN(v.quantity) || v.quantity > 1000000000) errors.push('Quantity must be a whole number of 0 or more.');
  if (Number.isNaN(v.minStock) || v.minStock > 1000000000) errors.push('Minimum stock must be a whole number of 0 or more.');
  if (!Number.isNaN(v.purchasePrice) && v.purchasePrice > 1000000000) errors.push('Purchase price is too large.');
  if (!Number.isNaN(v.sellingPrice) && v.sellingPrice > 1000000000) errors.push('Selling price is too large.');
  return { errors, values: v };
}

function validateCategory(body) {
  const errors = [];
  const v = { name: str(body.name), description: str(body.description) };
  if (v.name.length < 2 || v.name.length > 60) errors.push('Category name must be 2 to 60 characters.');
  if (v.description.length > 300) errors.push('Description must be 300 characters or fewer.');
  return { errors, values: v };
}

function validateSupplier(body) {
  const errors = [];
  const v = { name: str(body.name), phone: str(body.phone), email: str(body.email).toLowerCase(), address: str(body.address) };
  if (v.name.length < 2 || v.name.length > 80) errors.push('Supplier name must be 2 to 80 characters.');
  if (!PHONE_RE.test(v.phone)) errors.push('Contact number must be 7 to 20 characters (digits, spaces, + - ( ) only).');
  if (v.email && !EMAIL_RE.test(v.email)) errors.push('Email address is not valid.');
  if (v.address.length > 250) errors.push('Address must be 250 characters or fewer.');
  return { errors, values: v };
}

function validateUserInput(body, { requirePassword = false, allowRole = false } = {}) {
  const errors = [];
  const v = {
    username: str(body.username).toLowerCase(),
    name: str(body.name),
    email: str(body.email).toLowerCase(),
    role: str(body.role),
  };
  if (!USERNAME_RE.test(v.username)) errors.push('Username must be 3 to 30 characters: lowercase letters, numbers, dot, dash or underscore.');
  if (v.name.length < 2 || v.name.length > 80) errors.push('Full name must be 2 to 80 characters.');
  if (!EMAIL_RE.test(v.email)) errors.push('Email address is not valid.');
  if (allowRole && !['admin', 'staff'].includes(v.role)) errors.push('Role must be Admin or Staff.');
  if (requirePassword) errors.push(...validatePassword(body.password));
  return { errors, values: v };
}

function validateMovementInput(body) {
  const errors = [];
  const v = { product: str(body.product), quantity: parseWhole(body.quantity), note: str(body.note) };
  if (!isValidObjectId(v.product)) errors.push('Please choose a product.');
  if (Number.isNaN(v.quantity) || v.quantity < 1 || v.quantity > 1000000) errors.push('Quantity must be a whole number between 1 and 1,000,000.');
  if (v.note.length > 300) errors.push('Note must be 300 characters or fewer.');
  return { errors, values: v };
}

module.exports = {
  isValidObjectId, escapeRegex, parseWhole, parseMoney, validatePassword,
  validateProduct, validateCategory, validateSupplier, validateUserInput, validateMovementInput,
};
