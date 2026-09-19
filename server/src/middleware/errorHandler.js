/**
 * 全局错误处理中间件（必须最后挂载）
 * - BizError：按 code 返回业务错误（HTTP 200 + 业务码）
 * - 其他：500 + 错误日志
 */
const { BizError, Code } = require('../utils/response');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // multer 文件大小超限
  if (err && err.name === 'MulterError') {
    return res.json({ code: Code.VALIDATE_ERROR, message: '上传失败: ' + err.message, data: null });
  }

  if (err instanceof BizError) {
    return res.json({ code: err.code, message: err.message, data: err.data ?? null });
  }

  // 参数校验类错误（express-validator 或自定义 ValidationError 带 status）
  if (err && err.statusCode === 400) {
    return res.json({ code: Code.VALIDATE_ERROR, message: err.message, data: null });
  }

  logger.error(err, {
    method: req.method,
    path: req.originalUrl,
    tenantId: req.tenantId ?? undefined,
  });
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
}

module.exports = errorHandler;
