const { buildReport, REPORT_TYPES } = require('../services/reportService');
const { parseDateRange } = require('../utils/dates');
const { toCsv } = require('../utils/csv');
const { logActivity } = require('../utils/activity');

exports.index = async (req, res, next) => {
  try {
    const typeKey = REPORT_TYPES.some((t) => t.key === req.query.type) ? req.query.type : 'stock';
    const typeInfo = REPORT_TYPES.find((t) => t.key === typeKey);
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const range = typeInfo.usesDates ? parseDateRange(from, to) : { from: null, to: null, error: '' };
    const report = await buildReport(typeKey, range);

    if (req.query.format === 'csv') {
      await logActivity(req, 'report.export', 'Report', typeKey, 'Exported CSV: ' + report.title);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="' + typeKey + '-report.csv"');
      return res.send(toCsv(report.columns, report.rows));
    }
    res.render('reports/index', { title: 'Reports', types: REPORT_TYPES, typeKey, typeInfo, report, from, to, dateError: range.error });
  } catch (err) { next(err); }
};
