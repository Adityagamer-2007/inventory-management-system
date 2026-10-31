const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv, escapeCell } = require('../utils/csv');
const { generateToken, tokensMatch } = require('../utils/csrf');
const { parseDateRange, createdAtFilter } = require('../utils/dates');
const { detectImageType } = require('../utils/imageCheck');
const { removesLastActiveAdmin } = require('../services/userRules');
const { paginate, buildPageInfo } = require('../utils/pagination');

test('csv escapes commas, quotes and newlines', () => {
  assert.equal(escapeCell('a,b'), '"a,b"');
  assert.equal(escapeCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCell('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCell(null), '');
  assert.equal(escapeCell(42), '42');
});

test('csv blocks spreadsheet formula injection in text but keeps negative numbers', () => {
  assert.equal(escapeCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCell('@cmd'), "'@cmd");
  assert.equal(escapeCell(-5), '-5');
});

test('toCsv builds header and rows', () => {
  const csv = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }]);
  assert.equal(csv, '\uFEFFA,B\r\n1,x\r\n2,"y,z"\r\n');
});

test('csrf tokens are random and compared strictly', () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a, b);
  assert.equal(a.length, 64);
  assert.equal(tokensMatch(a, a), true);
  assert.equal(tokensMatch(a, b), false);
  assert.equal(tokensMatch(a, ''), false);
  assert.equal(tokensMatch('', ''), false);
  assert.equal(tokensMatch(a, undefined), false);
  assert.equal(tokensMatch(a, a + 'x'), false);
});

test('date range parsing', () => {
  const r = parseDateRange('2026-01-10', '2026-01-12');
  assert.equal(r.error, '');
  assert.ok(r.to > new Date('2026-01-12T12:00:00'), 'to-date includes the whole day');
  assert.ok(parseDateRange('nonsense', '').error);
  const reversed = parseDateRange('2026-03-01', '2026-02-01');
  assert.ok(reversed.error);
  assert.equal(reversed.from, null);
  assert.deepEqual(createdAtFilter({ from: null, to: null }), {});
  assert.ok(createdAtFilter(r).createdAt.$gte instanceof Date);
});

test('image type detection uses file contents, not file names', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(10)]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);
  assert.equal(detectImageType(png).mime, 'image/png');
  assert.equal(detectImageType(jpg).mime, 'image/jpeg');
  assert.equal(detectImageType(gif).mime, 'image/gif');
  assert.equal(detectImageType(webp).mime, 'image/webp');
  assert.equal(detectImageType(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(detectImageType(Buffer.from('MZ' + 'x'.repeat(30))), null);
  assert.equal(detectImageType(Buffer.alloc(3)), null);
});

test('last active administrator cannot be removed or deactivated', () => {
  const admin = { role: 'admin', active: true };
  assert.equal(removesLastActiveAdmin({ target: admin, otherActiveAdmins: 0, newRole: 'staff', newActive: true }), true);
  assert.equal(removesLastActiveAdmin({ target: admin, otherActiveAdmins: 0, newRole: 'admin', newActive: false }), true);
  assert.equal(removesLastActiveAdmin({ target: admin, otherActiveAdmins: 1, newRole: 'staff', newActive: true }), false);
  assert.equal(removesLastActiveAdmin({ target: admin, otherActiveAdmins: 0, newRole: 'admin', newActive: true }), false);
  assert.equal(removesLastActiveAdmin({ target: { role: 'staff', active: true }, otherActiveAdmins: 0, newRole: 'staff', newActive: false }), false);
});

test('pagination', () => {
  assert.deepEqual(paginate({ page: '3' }, 10), { page: 3, limit: 10, skip: 20 });
  assert.equal(paginate({ page: '-4' }, 10).page, 1);
  assert.equal(paginate({ page: 'abc' }, 10).page, 1);
  assert.deepEqual(buildPageInfo(1, 10, 0), { page: 1, limit: 10, total: 0, totalPages: 1 });
  assert.equal(buildPageInfo(9, 10, 25).page, 3);
});

test('generated passwords satisfy the password rules and differ each time', () => {
  const { generatePassword } = require('../utils/passwords');
  const { validatePassword } = require('../utils/validators');
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = generatePassword();
    assert.equal(p.length, 16);
    assert.deepEqual(validatePassword(p), []);
    seen.add(p);
  }
  assert.equal(seen.size, 200);
});
