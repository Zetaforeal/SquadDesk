/**
 * 订单号生成：CLUB{租户码大写}{yyyyMMddHHmmss}{4位随机}
 * 支付回调据此反查租户与订单（order_no 全局唯一）
 */
const crypto = require('crypto');
const { formatNow } = require('./time');

function generateOrderNo(clubCode) {
  const code = (clubCode || 'X').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const ts = formatNow().replace(/[-: ]/g, ''); // yyyyMMddHHmmss
  const rand = crypto.randomInt(0, 10000).toString().padStart(4, '0');
  return `CLUB${code}${ts}${rand}`;
}

module.exports = { generateOrderNo };
