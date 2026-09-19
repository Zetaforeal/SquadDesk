/**
 * 分页工具：统一解析 page/pageSize，返回 Prisma where 所需参数
 */
function parsePagination(query, defaults = { page: 1, pageSize: 20, maxPageSize: 100 }) {
  let page = parseInt(query.page, 10);
  let pageSize = parseInt(query.pageSize, 10);
  if (!page || page < 1) page = defaults.page;
  if (!pageSize || pageSize < 1) pageSize = defaults.pageSize;
  if (pageSize > defaults.maxPageSize) pageSize = defaults.maxPageSize;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** 组装分页响应体 */
function paginated(list, total, page, pageSize) {
  return {
    list,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

module.exports = { parsePagination, paginated };
