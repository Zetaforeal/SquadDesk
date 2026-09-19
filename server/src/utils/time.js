/**
 * 统一时间入口（网络校准的北京时间，不依赖服务器系统时钟）
 *
 * 使用方式：
 *   const { now, formatNow, toDate } = require('../utils/time');
 *   const ts = now();            // 校准后的北京时间毫秒时间戳（等价 Date.now()+offset）
 *   const str = formatNow();     // "YYYY-MM-DD HH:mm:ss"
 *
 * 业务代码一律禁止直接 new Date() 裸用，统一走本模块。
 * 启动时与每小时从多源校准 offset。
 */
const { env } = require('../config');

let offsetMs = 0; // 本地时钟相对标准北京时间的偏移：标准时间 = Date.now() + offsetMs
let lastSyncAt = 0;
let syncing = false;

/** 时间源列表（多源 fallback） */
const TIME_SOURCES = [
  ...(env.TIME_SYNC_URLS.length ? env.TIME_SYNC_URLS : []),
  'https://quan.suning.com/getSysTime.do',
  'https://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 将毫秒时间戳格式化为北京时间字符串 YYYY-MM-DD HH:mm:ss */
function formatTs(ts) {
  const d = new Date(ts);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** 从单个 HTTP 时间源抓取服务器时间（毫秒） */
async function fetchServerTime(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`时间源响应异常: HTTP ${res.status}`);
    const text = await res.text();

    // 苏宁: {"sysTime2":"2026-08-09 20:30:00","sysTime1":"20260809203000"}
    let m = text.match(/"sysTime1"\s*:\s*"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})"/);
    if (m) {
      return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`);
    }
    // 淘宝: {"data":{"t":"1720000000000"}}
    m = text.match(/"t"\s*:\s*"(\d{13})"/);
    if (m) return parseInt(m[1], 10);
    // 通用 ISO/UTC 时间戳
    const ts = Date.parse(text.trim().replace(/^"|"$/g, ''));
    if (!Number.isNaN(ts)) return ts;
    throw new Error('无法解析时间源响应');
  } finally {
    clearTimeout(timer);
  }
}

/** 网络校准：多源取时间，计算 offset（取成功率最高的源，多个源取中位数防异常） */
async function syncTime() {
  if (syncing) return;
  syncing = true;
  const results = [];
  for (const url of TIME_SOURCES) {
    try {
      const t0 = Date.now();
      const serverTs = await fetchServerTime(url);
      const rtt = Date.now() - t0;
      // 网络往返误差按半程修正
      const corrected = serverTs + Math.floor(rtt / 2);
      results.push(corrected - Date.now());
    } catch (e) {
      // 单源失败忽略，继续下一个
    }
  }
  if (results.length) {
    results.sort((a, b) => a - b);
    const mid = results[Math.floor(results.length / 2)];
    offsetMs = mid;
    lastSyncAt = Date.now();
    console.log(`[time] 北京时间校准成功 offset=${offsetMs}ms sources=${results.length} ${formatNow()}`);
  } else {
    console.warn('[time] 所有时间源均不可达，继续使用上次校准值（或本地时钟）');
  }
  syncing = false;
}

/** 当前校准后的北京时间毫秒时间戳 */
function now() {
  return Date.now() + offsetMs;
}

/** 当前校准后的北京时间 Date 对象（供 Prisma/MySQL 写入使用） */
function toDate(ts) {
  return new Date(ts === undefined ? now() : ts);
}

/** 当前校准后的北京时间字符串 */
function formatNow() {
  return formatTs(now());
}

/** 距上次校准的秒数 */
function secondsSinceSync() {
  return Math.floor((Date.now() - lastSyncAt) / 1000);
}

// 启动校准 + 每小时重校
syncTime();
setInterval(syncTime, env.TIME_SYNC_INTERVAL_HOURS * 3600 * 1000);

module.exports = { now, toDate, formatNow, formatTs, syncTime, secondsSinceSync };
