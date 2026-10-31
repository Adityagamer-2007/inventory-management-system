const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateMovement, stockStatus, isLowStock, inventoryValue, round2 } = require('../services/stockRules');

test('stock in increases quantity', () => {
  assert.deepEqual(evaluateMovement('in', 5, 10), { ok: true, newStock: 15 });
});

test('stock out decreases quantity', () => {
  assert.deepEqual(evaluateMovement('out', 4, 10), { ok: true, newStock: 6 });
});

test('stock out of the exact remaining quantity is allowed and reaches zero', () => {
  assert.deepEqual(evaluateMovement('out', 10, 10), { ok: true, newStock: 0 });
});

test('stock out above available stock is rejected (no negative stock)', () => {
  const r = evaluateMovement('out', 11, 10);
  assert.equal(r.ok, false);
  assert.match(r.error, /Not enough stock/);
});

test('invalid quantities are rejected', () => {
  for (const q of [0, -3, 1.5, NaN, '5', null, undefined]) {
    assert.equal(evaluateMovement('in', q, 10).ok, false, 'quantity ' + String(q));
  }
});

test('unknown transaction type is rejected', () => {
  assert.equal(evaluateMovement('adjust', 1, 10).ok, false);
});

test('invalid current stock is rejected', () => {
  assert.equal(evaluateMovement('in', 1, -1).ok, false);
});

test('low stock is at or below the minimum', () => {
  assert.equal(isLowStock(5, 5), true);
  assert.equal(isLowStock(4, 5), true);
  assert.equal(isLowStock(6, 5), false);
});

test('stock status labels', () => {
  assert.equal(stockStatus(0, 5), 'out');
  assert.equal(stockStatus(3, 5), 'low');
  assert.equal(stockStatus(5, 5), 'low');
  assert.equal(stockStatus(6, 5), 'ok');
  assert.equal(stockStatus(0, 0), 'out');
});

test('inventory valuation sums cost and retail value', () => {
  const v = inventoryValue([
    { quantity: 10, purchasePrice: 2.5, sellingPrice: 4 },
    { quantity: 3, purchasePrice: 100, sellingPrice: 150.5 },
  ]);
  assert.equal(v.cost, 325);
  assert.equal(v.retail, 491.5);
  assert.equal(v.profit, 166.5);
});

test('round2 avoids floating point drift', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(1.005 * 100), 100.5);
});
