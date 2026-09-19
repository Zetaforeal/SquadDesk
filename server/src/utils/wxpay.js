/**
 * 微信支付工具（JSAPI v2，多租户）
 * 所有函数接收租户配置 cfg（来自 club_configs），不再读取全局配置
 */
const crypto = require('crypto');
const { Builder, parseStringPromise } = require('xml2js');
const { BizError } = require('./response');
const { Code } = require('./response');

/** MD5 签名 */
function sign(params, apiKey) {
  const keys = Object.keys(params).filter(
    (k) => params[k] !== undefined && params[k] !== '' && k !== 'sign'
  );
  keys.sort();
  const str = keys.map((k) => `${k}=${params[k]}`).join('&') + `&key=${apiKey}`;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

/** 随机字符串 */
function nonceStr(len = 32) {
  return crypto.randomBytes(Math.ceil(len * 0.75)).toString('base64url').slice(0, len);
}

/** 对象转 XML */
function buildXml(obj) {
  const clean = Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== ''));
  return new Builder({ headless: true, rootName: 'xml', cdata: true, renderOpts: { pretty: false } }).buildObject(clean);
}

/** 使用成熟解析器处理 XML，禁用数组包装便于签名验证。 */
async function parseXml(xml) {
  return parseStringPromise(xml, { explicitArray: false, explicitRoot: false, trim: true });
}

/**
 * 统一下单（JSAPI）
 * @param {object} cfg - 租户微信配置 { appId, mchId, apiKey, notifyUrl }
 * @param {object} args - { outTradeNo, body, totalFee(分), openid }
 * @returns {Promise<{prepayId, payParams}>}
 */
async function unifiedOrder(cfg, { outTradeNo, body, totalFee, openid }) {
  const params = {
    appid: cfg.appId,
    mch_id: cfg.mchId,
    nonce_str: nonceStr(),
    body,
    out_trade_no: outTradeNo,
    total_fee: totalFee,
    spbill_create_ip: '127.0.0.1',
    notify_url: cfg.notifyUrl,
    trade_type: 'JSAPI',
    openid,
  };
  params.sign = sign(params, cfg.apiKey);

  const resp = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
    method: 'POST',
    body: buildXml(params),
    headers: { 'Content-Type': 'text/xml' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new BizError(Code.VALIDATE_ERROR, `微信支付网关异常: HTTP ${resp.status}`);
  const xml = await resp.text();
  const data = await parseXml(xml);

  if (data.return_code !== 'SUCCESS') {
    throw new BizError(Code.VALIDATE_ERROR, '微信支付下单失败: ' + (data.return_msg || '未知错误'));
  }
  if (data.result_code !== 'SUCCESS') {
    throw new BizError(Code.VALIDATE_ERROR, '微信支付下单失败: ' + (data.err_code_des || data.err_code || '未知错误'));
  }

  const payParams = {
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: nonceStr(),
    package: `prepay_id=${data.prepay_id}`,
    signType: 'MD5',
  };
  payParams.paySign = sign(
    {
      appId: cfg.appId,
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: 'MD5',
    },
    cfg.apiKey
  );

  return { prepayId: data.prepay_id, payParams };
}

/**
 * 支付回调签名验证（用订单所属租户的 apiKey）
 */
function verifyNotifySign(xmlObj, apiKey) {
  const signVal = xmlObj.sign;
  if (!signVal) return false;
  const params = { ...xmlObj };
  delete params.sign;
  const expected = Buffer.from(sign(params, apiKey));
  const received = Buffer.from(String(signVal).toUpperCase());
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

module.exports = { unifiedOrder, verifyNotifySign, sign, buildXml, parseXml, nonceStr };
