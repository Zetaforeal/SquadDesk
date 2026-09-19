/**
 * 北京时间校准脚本（可独立执行，验证时间源连通性）
 * 用法：node scripts/sync-time.js
 */
require('dotenv').config();
const { syncTime, formatNow, secondsSinceSync } = require('../src/utils/time');

(async () => {
  console.log('开始校准北京时间...');
  await syncTime();
  console.log(`当前校准后时间: ${formatNow()}（距上次校准 ${secondsSinceSync()}s）`);
  process.exit(0);
})();
