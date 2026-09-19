<template>
  <div class="super-settings">
    <el-card shadow="never" class="mb">
      <template #header><span>修改登录密码</span></template>
      <el-form :model="pwdForm" label-width="110px" style="max-width: 520px">
        <el-form-item label="原密码" required>
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="当前登录密码" />
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 12 位" />
        </el-form-item>
        <el-form-item label="确认新密码" required>
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="pwdSaving" @click="changePassword">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>后台登录入口（安全加固）</span></template>
      <el-form label-width="110px" style="max-width: 520px">
        <el-form-item label="入口路径">
          <el-input v-model="entryPath" placeholder="如 ssuuppeerr">
            <template #prepend>/</template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="entrySaving" @click="saveEntry">保存入口配置</el-button>
          <el-tag type="warning" size="small" class="ml">保存后需重新构建部署才生效</el-tag>
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" title="设置自定义入口路径后，超管后台将同时支持 /super/ 与 /新路径/ 访问（当前保留 /super/ 不变）。路径需为 3-32 位字母数字。" />
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';

const pwdSaving = ref(false);
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const entryPath = ref('');
const entrySaving = ref(false);

/** 修改超管密码 */
async function changePassword() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) return ElMessage.warning('请填写原密码与新密码');
  if (pwdForm.newPassword.length < 12) return ElMessage.warning('新密码至少 12 位');
  if (pwdForm.newPassword !== pwdForm.confirmPassword) return ElMessage.warning('两次输入的新密码不一致');
  pwdSaving.value = true;
  try {
    await request.put('/me/password', { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
    ElMessage.success('密码已修改，下次登录请使用新密码');
    Object.assign(pwdForm, { oldPassword: '', newPassword: '', confirmPassword: '' });
  } catch (e) {
    ElMessage.error(e.message || '修改失败');
  } finally {
    pwdSaving.value = false;
  }
}

/** 读取入口配置 */
async function loadEntry() {
  try {
    const data = await request.get('/system/config');
    entryPath.value = data.super_entry_path || 'super';
  } catch (e) {
    entryPath.value = 'super';
  }
}

/** 保存入口配置 */
async function saveEntry() {
  const p = (entryPath.value || '').trim().replace(/^\/+|\/+$/g, '');
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(p)) return ElMessage.warning('路径需为 3-32 位字母数字（如 ssuuppeerr）');
  entrySaving.value = true;
  try {
    await request.put('/system/config', { super_entry_path: p });
    ElMessage.success('入口配置已保存');
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    entrySaving.value = false;
  }
}

onMounted(loadEntry);
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.ml { margin-left: 12px; }
</style>
