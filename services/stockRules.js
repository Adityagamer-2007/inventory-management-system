// Pure business rules for stock. No database code here, so they are easy to unit test.

function isLowStock(quantity, minStock) {
  return quantity <= minStock;
}

function stockStatus(quantity, minStock) {
  if (quantity <= 0) return 'out';
  if (quantity <= minStock) return 'low';
  return 'ok';
}

// Returns { ok, error, newStock } for a proposed movement.
function evaluateMovement(type, quantity, currentStock) {
  if (type !== 'in' && type !== 'out') return { ok: false, error: 'Unknown transaction type.' };
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: 'Quantity must be a whole number of at least 1.' };
  if (!Number.isInteger(currentStock) || currentStock < 0) return { ok: false, error: 'Current stock is invalid.' };
  if (type === 'out' && quantity > currentStock) {
    return { ok: false, error: 'Not enough stock. Available: ' + currentStock + ', requested: ' + quantity + '.' };
  }
  return { ok: true, newStock: type === 'in' ? currentStock + quantity : currentStock - quantity };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function inventoryValue(items) {
  let cost = 0;
  let retail = 0;
  for (const p of items) {
    cost += p.quantity * p.purchasePrice;
    retail += p.quantity * p.sellingPrice;
  }
  return { cost: round2(cost), retail: round2(retail), profit: round2(retail - cost) };
}

module.exports = { isLowStock, stockStatus, evaluateMovement, round2, inventoryValue };
