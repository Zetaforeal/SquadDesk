/**
 * 统一响应格式 { code, message, data }
 * code: 0 成功；401 未登录；403 越权；业务错误码见下表
 */
const Code = {
  OK: 0,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATE_ERROR: 400,
  // 租户域
  TENANT_NOT_FOUND: 1001,
  CLUB_EXPIRED: 1002,
  PLAYER_OFFLINE: 1003,
  PLAYER_NO_QRCODE: 1004,
  // 订单域
  ORDER_STATUS_INVALID: 2001,
};

function ok(res, data = null, message = 'success') {
  res.json({ code: Code.OK, message, data });
}

function fail(res, code = Code.VALIDATE_ERROR, message = 'error', data = null) {
  res.status(200).json({ code, message, data });
}

/** 业务异常：可直接 throw，由 errorHandler 统一响应 */
class BizError extends Error {
  constructor(code, message, data = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

module.exports = { Code, ok, fail, BizError };
