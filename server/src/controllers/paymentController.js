/**
 * 支付控制器：统一回调 /api/payment/notify（order_no 反查租户验签）
 */
const orderService = require('../services/order.service');
const { parseXml, buildXml } = require('../utils/wxpay');
const logger = require('../utils/logger');

/**
 * 微信支付回调（XML）
 * 返回微信要求的格式：<xml><return_code>SUCCESS</return_code></xml>
 */
async function notify(req, res, next) {
  try {
    const xml = req.body && typeof req.body === 'string' ? req.body : '';
    if (!xml) return res.type('application/xml').send(buildXml({ return_code: 'FAIL', return_msg: 'empty' }));
    const xmlObj = await parseXml(xml);
    if (!xmlObj.out_trade_no) {
      return res.type('application/xml').send(buildXml({ return_code: 'FAIL', return_msg: 'no order_no' }));
    }
    const result = await orderService.handlePaymentNotify(xmlObj);
    if (result.code === 'SUCCESS') {
      return res.type('application/xml').send(buildXml({ return_code: 'SUCCESS' }));
    }
    return res.type('application/xml').send(buildXml({ return_code: 'FAIL', return_msg: result.msg || 'fail' }));
  } catch (e) {
    logger.error(e, { event: 'payment_notify_failed' });
    return res.type('application/xml').send(buildXml({ return_code: 'FAIL', return_msg: 'server error' }));
  }
}

module.exports = { notify };
