import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { title: '登录' } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/clubs',
    children: [
      { path: 'clubs', component: () => import('@/views/ClubList.vue'), meta: { title: '俱乐部管理' } },
      { path: 'clubs/:id', component: () => import('@/views/ClubDetail.vue'), meta: { title: '俱乐部详情' } },
      { path: 'stats', component: () => import('@/views/Stats.vue'), meta: { title: '全局数据' } },
      { path: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '系统设置' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/clubs' },
];

const router = createRouter({ history: createWebHistory('/super/'), routes });

router.beforeEach((to) => {
  const token = localStorage.getItem('super_token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) return '/clubs';
});

export default router;
