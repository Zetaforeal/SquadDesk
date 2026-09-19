<template>
  <el-container class="main-layout">
    <el-aside width="200px" class="aside">
      <div class="logo">
        <Crosshair class="logo-icon" />
        <span>打手端</span>
      </div>
      <el-menu :default-active="$route.path" router background-color="#203a43" text-color="#b8c4d4" active-text-color="#ffffff">
        <el-menu-item index="/grab">
          <Zap class="menu-icon" /><span>抢单大厅</span>
          <el-badge v-if="grabCount > 0" :value="grabCount" class="badge" />
        </el-menu-item>
        <el-menu-item index="/orders"><ClipboardList class="menu-icon" /><span>我的接单</span></el-menu-item>
        <el-menu-item index="/withdraw"><Wallet class="menu-icon" /><span>提现</span></el-menu-item>
        <el-menu-item index="/commissions"><Coins class="menu-icon" /><span>佣金记录</span></el-menu-item>
        <el-menu-item index="/profile"><User class="menu-icon" /><span>个人中心</span></el-menu-item>
      </el-menu>
      <div class="aside-bottom">
        <el-switch v-model="online" active-text="在线" inactive-text="下线" @change="toggleOnline" />
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="page-title">{{ $route.meta.title || '' }}</div>
        <div class="user-area">
          <span class="nickname">{{ nickname }}</span>
          <el-tag size="small" :type="online ? 'success' : 'info'">{{ online ? '在线' : '下线' }}</el-tag>
          <el-button link type="danger" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { Crosshair, Zap, ClipboardList, Wallet, Coins, User } from 'lucide-vue-next';
import request from '@/utils/request';

const router = useRouter();
const nickname = localStorage.getItem('player_nickname') || '打手';
const online = ref(false);
const grabCount = ref(0);
let timer = null;

async function loadProfile() {
  const p = await request.get('/profile');
  online.value = !!p.online;
}

async function toggleOnline(val) {
  await request.put('/online', { online: val });
}

// 轮询：新单提醒 + 在线状态（打手端 Web 轮询策略 10~15s）
async function poll() {
  try {
    const orders = await request.get('/available-orders');
    grabCount.value = orders.length;
  } catch (e) { /* 未登录等场景忽略 */ }
}

async function logout() {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  localStorage.removeItem('player_token');
  localStorage.removeItem('player_tenantId');
  router.push('/login');
}

onMounted(() => {
  loadProfile();
  poll();
  timer = setInterval(poll, 10000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.main-layout { height: 100vh; }
.aside { background: #203a43; display: flex; flex-direction: column; }
.logo {
  height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;
  color: #fff; font-size: 16px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.logo-icon { width: 22px; height: 22px; }
.aside :deep(.el-menu) { border-right: none; flex: 1; }
.menu-icon { width: 18px; height: 18px; margin-right: 4px; }
.badge { margin-left: auto; }
.aside-bottom {
  padding: 16px; display: flex; justify-content: center;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.header {
  background: #fff; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #e4e7ed; height: 60px;
}
.page-title { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.user-area { display: flex; align-items: center; gap: 12px; }
.nickname { color: #606266; font-size: 14px; }
.main { background: #f5f7fa; padding: 20px; }
</style>
