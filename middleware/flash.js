module.exports = function flash(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session) return;
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, message });
  };
  res.locals.flash = (req.session && req.session.flash) || [];
  if (req.session) req.session.flash = [];
  next();
};
