// Pure rule: would this change remove the last active administrator?
function removesLastActiveAdmin({ target, otherActiveAdmins, newRole, newActive }) {
  const isActiveAdminNow = target.role === 'admin' && target.active;
  const willBeActiveAdmin = newRole === 'admin' && newActive;
  return isActiveAdminNow && !willBeActiveAdmin && otherActiveAdmins < 1;
}

module.exports = { removesLastActiveAdmin };
