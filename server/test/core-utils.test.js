const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePagination, paginated } = require('../src/utils/pagination');
const { stripHtml, safeText } = require('../src/utils/sanitize');
const { sign, buildXml, parseXml, nonceStr, verifyNotifySign } = require('../src/utils/wxpay');

test('pagination normalizes invalid input and caps page size', () => {
  assert.deepEqual(parsePagination({ page: '-2', pageSize: '9999' }), {
    page: 1,
    pageSize: 100,
    skip: 0,
    take: 100,
  });
  assert.deepEqual(paginated(['x'], 21, 2, 20), {
    list: ['x'], total: 21, page: 2, pageSize: 20, totalPages: 2,
  });
});

test('text sanitization removes markup and applies limits', () => {
  assert.equal(stripHtml(' <b>Hello</b><script>alert(1)</script> '), 'Helloalert(1)');
  assert.equal(safeText('<i>abcdef</i>', 3), 'abc');
});

test('wechat signing is deterministic and ignores existing sign', () => {
  const params = { b: '2', a: '1', empty: '', sign: 'ignored' };
  assert.equal(sign(params, 'secret'), '9F565CCD686CFA5DC3B06B3A89E4E3AD');
  const signed = { a: '1', b: '2', sign: sign(params, 'secret') };
  assert.equal(verifyNotifySign(signed, 'secret'), true);
  assert.equal(verifyNotifySign({ ...signed, b: '3' }, 'secret'), false);
});

test('wechat XML round-trips safely', async () => {
  const xml = buildXml({ return_code: 'SUCCESS', message: '<paid>&ok' });
  assert.deepEqual(await parseXml(xml), { return_code: 'SUCCESS', message: '<paid>&ok' });
});

test('wechat nonces have requested length and are not repeated', () => {
  const first = nonceStr(32);
  const second = nonceStr(32);
  assert.equal(first.length, 32);
  assert.equal(second.length, 32);
  assert.notEqual(first, second);
});
