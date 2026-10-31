const { getDashboardData } = require('../services/dashboardService');

exports.index = async (req, res, next) => {
  try {
    const data = await getDashboardData();
    // "<" is escaped so the JSON can sit safely inside an HTML <script type="application/json"> block.
    const chartJson = JSON.stringify(data.charts).replace(/</g, '\\u003c');
    res.render('dashboard/index', { title: 'Dashboard', data, chartJson });
  } catch (err) {
    next(err);
  }
};
