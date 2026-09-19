<template>
  <el-container class="main-layout">
    <el-aside width="200px" class="aside">
      <div class="logo">
        <ShieldCheck class="logo-icon" />
        <span>超管后台</span>
      </div>
      <el-menu :default-active="$route.path" router background-color="#141e30" text-color="#b8c4d4" active-text-color="#ffffff">
        <el-menu-item index="/clubs"><Building2 class="menu-icon" /><span>俱乐部管理</span></el-menu-item>
        <el-menu-item index="/stats"><BarChart3 class="menu-icon" /><span>全局数据</span></el-menu-item>
        <el-menu-item index="/settings"><Settings class="menu-icon" /><span>系统设置</span></el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="page-title">{{ $route.meta.title || '' }}</div>
        <el-button link type="danger" @click="logout">退出登录</el-button>
      </el-header>
      <el-main class="main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { ShieldCheck, Building2, BarChart3, Settings } from 'lucide-vue-next';

const router = useRouter();

async function logout() {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  localStorage.removeItem('super_token');
  router.push('/login');
}
</script>

<style scoped>
.main-layout { height: 100vh; }
.aside { background: #141e30; display: flex; flex-direction: column; }
.logo {
  height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;
  color: #fff; font-size: 16px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.logo-icon { width: 22px; height: 22px; }
.aside :deep(.el-menu) { border-right: none; }
.menu-icon { width: 18px; height: 18px; margin-right: 4px; }
.header {
  background: #fff; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #e4e7ed; height: 60px;
}
.page-title { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.main { background: #f5f7fa; padding: 20px; }
</style>
