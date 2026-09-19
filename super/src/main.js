import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);


// 前端更新后兜底：懒加载 chunk 404（旧版本缓存）时自动刷新拉取新版
// 用全局 error/unhandledrejection 监听，覆盖所有动态 import 失败场景（router.onError 只覆盖路由切换）
let reloading = false;
function shouldReload(msg) {
  return msg.includes('Failed to fetch dynamically imported module')
    || msg.includes('Loading chunk')
    || msg.includes('Importing a module script failed')
    || msg.includes('error loading dynamically imported module');
}
function autoReload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}
router.onError((err) => { if (shouldReload(String(err?.message || ''))) autoReload(); });
window.addEventListener('error', (e) => { if (e.message && shouldReload(String(e.message))) autoReload(); });
window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e?.reason?.message || e?.reason || '');
  if (msg && shouldReload(msg)) autoReload();
});


app.mount('#app');
