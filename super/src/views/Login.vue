<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="brand-icon"><ShieldCheck /></div>
        <h1>超级管理后台</h1>
        <p>平台运营 · 俱乐部管理</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" size="large" @keyup.enter="submit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-button type="primary" size="large" class="submit-btn" :loading="loading" @click="submit">登 录</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ShieldCheck, User, Lock } from 'lucide-vue-next';
import request from '@/utils/request';

const router = useRouter();
const formRef = ref();
const loading = ref(false);
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function submit() {
  await formRef.value.validate();
  loading.value = true;
  try {
    const data = await request.post('/login', form);
    localStorage.setItem('super_token', data.token);
    ElMessage.success('登录成功');
    router.push('/clubs');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #141e30 0%, #243b55 100%);
}
.login-card {
  width: 400px; padding: 40px 36px; background: #fff; border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
}
.brand { text-align: center; margin-bottom: 28px; }
.brand-icon {
  width: 56px; height: 56px; margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  background: #243b55; color: #fff; border-radius: 14px;
}
.brand-icon svg { width: 28px; height: 28px; }
.brand h1 { font-size: 20px; color: #1f2d3d; }
.brand p { font-size: 13px; color: #909399; margin-top: 6px; }
.submit-btn { width: 100%; }
</style>
