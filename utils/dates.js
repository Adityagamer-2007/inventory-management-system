// Turns "YYYY-MM-DD" form values into a safe date range (inclusive of the whole "to" day).
function parseDateRange(from, to) {
  const out = { from: null, to: null, error: '' };
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (from) {
    if (!re.test(from) || Number.isNaN(new Date(from + 'T00:00:00').getTime())) out.error = 'The "from" date is not valid.';
    else out.from = new Date(from + 'T00:00:00');
  }
  if (to && !out.error) {
    if (!re.test(to) || Number.isNaN(new Date(to + 'T23:59:59.999').getTime())) out.error = 'The "to" date is not valid.';
    else out.to = new Date(to + 'T23:59:59.999');
  }
  if (!out.error && out.from && out.to && out.from > out.to) {
    out.error = 'The "from" date must be before the "to" date.';
    out.from = null;
    out.to = null;
  }
  return out;
}

function createdAtFilter(range) {
  if (!range.from && !range.to) return {};
  const f = {};
  if (range.from) f.$gte = range.from;
  if (range.to) f.$lte = range.to;
  return { createdAt: f };
}

module.exports = { parseDateRange, createdAtFilter };
