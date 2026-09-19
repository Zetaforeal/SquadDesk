<template>
  <div v-if="profile">
    <el-card shadow="never" class="mb">
      <template #header><span>基本信息</span></template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户名">{{ profile.username }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ profile.nickname }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="profile.status === 'active' ? 'success' : 'danger'" size="small">
            {{ profile.status === 'active' ? '启用' : '禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="在线状态">
          <el-switch v-model="profile.online" @change="toggleOnline" />
        </el-descriptions-item>
        <el-descriptions-item label="累计佣金">{{ profile.totalCommission }} 元</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ fmt(profile.createdAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>收款二维码（用于结算付款）</span></template>
      <div class="qrcode-area">
        <el-image v-if="profile.qrcodePath" :src="profile.qrcodePath" fit="contain" style="width: 180px; height: 180px; border: 1px solid #e4e7ed; border-radius: 8px" :preview-src-list="[profile.qrcodePath]" />
        <div v-else class="no-qrcode">
          <QrCode :size="40" />
          <p>未上传收款二维码，上传后才能抢单</p>
        </div>
        <div class="qrcode-actions">
          <image-input v-model="qrcode" />
          <div class="btns">
            <el-button type="primary" :loading="saving" @click="saveQrcode">保存二维码</el-button>
            <el-button v-if="profile.qrcodePath" type="danger" plain @click="removeQrcode">移除</el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { QrCode } from 'lucide-vue-next';
import request from '@/utils/request';
import ImageInput from '@/components/ImageInput.vue';

const profile = ref(null);
const qrcode = ref('');
const saving = ref(false);

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }

async function load() {
  profile.value = await request.get('/profile');
  qrcode.value = profile.value.qrcodePath || '';
}

async function toggleOnline(val) {
  await request.put('/online', { online: val });
  ElMessage.success(val ? '已上线' : '已下线');
}

async function saveQrcode() {
  if (!qrcode.value) return ElMessage.warning('请上传二维码或填写链接');
  saving.value = true;
  try {
    await request.put('/qrcode', { qrcodeUrl: qrcode.value });
    ElMessage.success('收款码已保存');
    load();
  } finally {
    saving.value = false;
  }
}

async function removeQrcode() {
  await request.delete('/qrcode');
  ElMessage.success('已移除');
  load();
}

onMounted(load);
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.qrcode-area { display: flex; gap: 24px; align-items: flex-start; }
.no-qrcode {
  width: 180px; height: 180px; border: 1px dashed #c0c4cc; border-radius: 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #909399; gap: 8px; text-align: center; font-size: 12px; padding: 8px;
}
.qrcode-actions { display: flex; flex-direction: column; gap: 8px; }
.btns { display: flex; gap: 8px; }
</style>
