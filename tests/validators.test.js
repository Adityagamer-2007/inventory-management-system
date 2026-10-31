const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../utils/validators');

const goodProduct = {
  name: 'Desk Lamp', sku: 'lam-001', description: 'LED', category: 'a'.repeat(24), supplier: 'b'.repeat(24),
  purchasePrice: '120.50', sellingPrice: '199', quantity: '10', minStock: '3',
};

test('valid product passes and SKU is upper-cased', () => {
  const r = v.validateProduct(goodProduct);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.sku, 'LAM-001');
  assert.equal(r.values.purchasePrice, 120.5);
  assert.equal(r.values.quantity, 10);
});

test('negative or malformed prices are rejected', () => {
  for (const bad of ['-5', 'abc', '1.234', '', '1e3']) {
    const r = v.validateProduct({ ...goodProduct, purchasePrice: bad });
    assert.ok(r.errors.some((e) => /Purchase price/.test(e)), 'price ' + bad);
  }
});

test('negative, decimal or non-numeric quantity is rejected', () => {
  for (const bad of ['-1', '2.5', 'ten']) {
    const r = v.validateProduct({ ...goodProduct, quantity: bad });
    assert.ok(r.errors.some((e) => /Quantity/.test(e)), 'quantity ' + bad);
  }
});

test('missing category or supplier is rejected', () => {
  const r = v.validateProduct({ ...goodProduct, category: '', supplier: 'nope' });
  assert.ok(r.errors.some((e) => /category/.test(e)));
  assert.ok(r.errors.some((e) => /supplier/.test(e)));
});

test('SKU with spaces or symbols is rejected', () => {
  assert.ok(v.validateProduct({ ...goodProduct, sku: 'bad sku!' }).errors.length > 0);
});

test('stock movement validation', () => {
  const ok = v.validateMovementInput({ product: 'c'.repeat(24), quantity: '7', note: 'restock' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.quantity, 7);
  for (const q of ['0', '-2', '1.5', 'x', '', '2000000']) {
    assert.ok(v.validateMovementInput({ product: 'c'.repeat(24), quantity: q }).errors.length > 0, 'qty ' + q);
  }
  assert.ok(v.validateMovementInput({ product: 'not-an-id', quantity: '1' }).errors.length > 0);
});

test('password rules', () => {
  assert.ok(v.validatePassword('short1').length > 0);
  assert.ok(v.validatePassword('onlyletters').length > 0);
  assert.ok(v.validatePassword('12345678').length > 0);
  assert.deepEqual(v.validatePassword('goodpass123'), []);
  assert.ok(v.validatePassword('a1'.repeat(40)).length > 0);
});

test('supplier validation', () => {
  assert.deepEqual(v.validateSupplier({ name: 'Acme', phone: '+91 98100 11111', email: 'a@b.co', address: '' }).errors, []);
  assert.ok(v.validateSupplier({ name: 'Acme', phone: 'abc', email: '' }).errors.length > 0);
  assert.ok(v.validateSupplier({ name: 'Acme', phone: '1234567', email: 'not-an-email' }).errors.length > 0);
});

test('category validation', () => {
  assert.deepEqual(v.validateCategory({ name: 'Tools' }).errors, []);
  assert.ok(v.validateCategory({ name: 'x' }).errors.length > 0);
});

test('user input validation', () => {
  const ok = v.validateUserInput({ username: 'Jane.Doe', name: 'Jane', email: 'JANE@EXAMPLE.COM', password: 'abcdefg1' }, { requirePassword: true });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.username, 'jane.doe');
  assert.equal(ok.values.email, 'jane@example.com');
  assert.ok(v.validateUserInput({ username: 'a b', name: 'J', email: 'x' }).errors.length >= 3);
  assert.ok(v.validateUserInput({ username: 'jane', name: 'Jane', email: 'j@x.io', role: 'root' }, { allowRole: true }).errors.length > 0);
});

test('escapeRegex neutralises regex characters', () => {
  const re = new RegExp(v.escapeRegex('a.b(c)*'), 'i');
  assert.ok(re.test('xx A.B(C)* yy'));
  assert.ok(!re.test('aXb(c)'));
});

test('isValidObjectId', () => {
  assert.equal(v.isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(v.isValidObjectId('507f1f77bcf86cd79943901'), false);
  assert.equal(v.isValidObjectId({ $ne: '' }), false);
});
