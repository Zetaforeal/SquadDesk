import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { title: '登录' } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/grab',
    children: [
      { path: 'grab', component: () => import('@/views/GrabPool.vue'), meta: { title: '抢单大厅' } },
      { path: 'orders', component: () => import('@/views/MyOrders.vue'), meta: { title: '我的接单' } },
      { path: 'orders/:id', component: () => import('@/views/OrderDetail.vue'), meta: { title: '订单详情' } },
      { path: 'withdraw', component: () => import('@/views/Withdraw.vue'), meta: { title: '提现' } },
      { path: 'commissions', component: () => import('@/views/Commissions.vue'), meta: { title: '佣金记录' } },
      { path: 'profile', component: () => import('@/views/Profile.vue'), meta: { title: '个人中心' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/grab' },
];

const router = createRouter({ history: createWebHistory('/player/'), routes });

router.beforeEach((to) => {
  const token = localStorage.getItem('player_token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) return '/grab';
});

export default router;
