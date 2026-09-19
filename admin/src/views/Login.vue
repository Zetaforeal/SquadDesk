<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="brand-icon"><Store /></div>
        <h1>俱乐部管理后台</h1>
        <p>多租户 SaaS 商城派单平台</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" size="large" @keyup.enter="submit">
        <el-form-item prop="tenantId">
          <el-input v-model="form.tenantId" placeholder="俱乐部 ID（5 位租户号，如 10001）" :prefix-icon="Building2" />
        </el-form-item>
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-button type="primary" size="large" class="submit-btn" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Store, Building2, User, Lock } from 'lucide-vue-next';
import request from '@/utils/request';

const router = useRouter();
const formRef = ref();
const loading = ref(false);
const form = reactive({ tenantId: '', username: '', password: '' });
const rules = {
  tenantId: [{ required: true, message: '请输入俱乐部 ID', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function submit() {
  await formRef.value.validate();
  loading.value = true;
  try {
    const data = await request.post('/login', {
      tenantId: parseInt(form.tenantId, 10),
      username: form.username,
      password: form.password,
    });
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_tenantId', form.tenantId);
    localStorage.setItem('admin_username', data.admin.username);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
}
.login-card {
  width: 400px;
  padding: 40px 36px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.25);
}
.brand { text-align: center; margin-bottom: 28px; }
.brand-icon {
  width: 56px; height: 56px;
  margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  background: #2d6a9f; color: #fff;
  border-radius: 14px;
}
.brand-icon svg { width: 28px; height: 28px; }
.brand h1 { font-size: 20px; color: #1f2d3d; }
.brand p { font-size: 13px; color: #909399; margin-top: 6px; }
.submit-btn { width: 100%; }
</style>
