function paginate(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

function buildPageInfo(page, limit, total) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return { page: Math.min(page, totalPages), limit, total, totalPages };
}

module.exports = { paginate, buildPageInfo };
