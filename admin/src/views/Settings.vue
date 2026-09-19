<template>
  <div>
    <el-card shadow="never" class="mb">
      <template #header><span>微信支付配置</span></template>
      <el-form :model="form" label-width="140px" style="max-width: 640px">
        <el-form-item label="AppID">
          <el-input v-model="form.wechat_appid" placeholder="小程序 AppID" />
        </el-form-item>
        <el-form-item label="AppSecret">
          <el-input v-model="form.wechat_secret" type="password" show-password placeholder="小程序 AppSecret" />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="form.wechat_mchid" placeholder="微信支付商户号" />
        </el-form-item>
        <el-form-item label="API 密钥">
          <el-input v-model="form.wechat_api_key" type="password" show-password placeholder="商户 API v2 密钥" />
        </el-form-item>
        <el-form-item label="支付回调地址">
          <el-input v-model="form.wechat_notify_url" placeholder="https://api.club-saas.com/api/payment/notify" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>手机号登录 / 短信</span></template>
      <el-form :model="form" label-width="140px" style="max-width: 640px">
        <el-form-item label="手机号登录接口">
          <el-input v-model="form.phone_login_url" placeholder="外部验证接口 URL（留空=开发模式）" />
        </el-form-item>
        <el-form-item label="短信接口">
          <el-input v-model="form.phone_sms_url" placeholder="短信发送接口 URL（留空=开发模式）" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>订阅消息模板</span></template>
      <el-form :model="form" label-width="140px" style="max-width: 640px">
        <el-form-item label="订单已接单模板 ID">
          <el-input v-model="form.subscribe_tpl_accepted" placeholder="subscribe_tpl_accepted" />
        </el-form-item>
        <el-form-item label="订单已完成模板 ID">
          <el-input v-model="form.subscribe_tpl_completed" placeholder="subscribe_tpl_completed" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>自动派单</span></template>
      <el-form label-width="140px" style="max-width: 640px">
        <el-form-item label="启用自动派单">
          <el-switch v-model="form.auto_dispatch_enabled_bool" />
        </el-form-item>
        <el-form-item label="超时秒数">
          <el-input-number v-model="form.auto_dispatch_timeout_seconds" :min="30" :max="3600" :step="30" />
          <div class="tip">支付成功 N 秒后无人抢单则自动随机派给在线打手</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>结算设置</span></template>
      <el-form label-width="140px" style="max-width: 640px">
        <el-form-item label="冷却时长（小时）">
          <el-input-number v-model="form.settle_cooldown_hours" :min="1" :max="720" :step="1" />
          <div class="tip">结单审核通过后 N 小时后才可提现（默认 72）</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>收货资料表头列名</span></template>
      <el-form :model="form" label-width="140px" style="max-width: 640px">
        <el-form-item label="启用地址列">
          <el-switch v-model="form.profile_col_enabled_bool" />
        </el-form-item>
        <el-form-item label="平台列名">
          <el-input v-model="form.profile_col_platform" />
        </el-form-item>
        <el-form-item label="账号列名">
          <el-input v-model="form.profile_col_identifier" />
        </el-form-item>
        <el-form-item label="地址列名">
          <el-input v-model="form.profile_col_address" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>联系客服</span></template>
      <el-form :model="form" label-width="140px" style="max-width: 640px">
        <el-form-item label="客服链接">
          <el-input v-model="form.customer_service_link" placeholder="如：https://work.weixin.qq.com/kfid/xxxx 或 https://q.url.cn/xxxx" />
          <div class="tip">小程序「我的」页将展示「联系客服」按钮，点击跳转此链接；留空则按钮隐藏</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>修改登录密码</span></template>
      <el-form :model="pwdForm" label-width="140px" style="max-width: 640px">
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

    <el-button type="primary" :loading="saving" @click="save">保存全部配置</el-button>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';

const saving = ref(false);
const pwdSaving = ref(false);
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const form = reactive({
  wechat_appid: '', wechat_secret: '', wechat_mchid: '', wechat_api_key: '', wechat_notify_url: '',
  phone_login_url: '', phone_sms_url: '',
  subscribe_tpl_accepted: '', subscribe_tpl_completed: '',
  auto_dispatch_enabled_bool: false, auto_dispatch_timeout_seconds: 120,
  settle_cooldown_hours: 72,
  profile_col_enabled_bool: true, profile_col_platform: '平台', profile_col_identifier: '账号', profile_col_address: '地址',
  customer_service_link: '',
});

async function load() {
  const data = await request.get('/club/config');
  Object.assign(form, {
    wechat_appid: data.wechat_appid || '', wechat_secret: data.wechat_secret || '',
    wechat_mchid: data.wechat_mchid || '', wechat_api_key: data.wechat_api_key || '',
    wechat_notify_url: data.wechat_notify_url || '',
    phone_login_url: data.phone_login_url || '', phone_sms_url: data.phone_sms_url || '',
    subscribe_tpl_accepted: data.subscribe_tpl_accepted || '', subscribe_tpl_completed: data.subscribe_tpl_completed || '',
    auto_dispatch_enabled_bool: data.auto_dispatch_enabled === '1',
    auto_dispatch_timeout_seconds: parseInt(data.auto_dispatch_timeout_seconds || '120', 10),
    settle_cooldown_hours: parseInt(data.settle_cooldown_hours || '72', 10),
    profile_col_enabled_bool: data.profile_col_enabled !== '0',
    profile_col_platform: data.profile_col_platform || '平台',
    profile_col_identifier: data.profile_col_identifier || '账号',
    profile_col_address: data.profile_col_address || '地址',
    customer_service_link: data.customer_service_link || '',
  });
}

async function save() {
  saving.value = true;
  try {
    await request.put('/club/config', {
      wechat_appid: form.wechat_appid, wechat_secret: form.wechat_secret,
      wechat_mchid: form.wechat_mchid, wechat_api_key: form.wechat_api_key,
      wechat_notify_url: form.wechat_notify_url,
      phone_login_url: form.phone_login_url, phone_sms_url: form.phone_sms_url,
      subscribe_tpl_accepted: form.subscribe_tpl_accepted, subscribe_tpl_completed: form.subscribe_tpl_completed,
      auto_dispatch_enabled: form.auto_dispatch_enabled_bool ? '1' : '0',
      auto_dispatch_timeout_seconds: String(form.auto_dispatch_timeout_seconds),
      settle_cooldown_hours: String(form.settle_cooldown_hours),
      profile_col_enabled: form.profile_col_enabled_bool ? '1' : '0',
      profile_col_platform: form.profile_col_platform,
      profile_col_identifier: form.profile_col_identifier,
      profile_col_address: form.profile_col_address,
      customer_service_link: form.customer_service_link,
    });
    ElMessage.success('配置已保存');
  } finally {
    saving.value = false;
  }
}

/** 修改管理员登录密码 */
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

onMounted(load);
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.tip { font-size: 12px; color: #909399; margin-left: 8px; }
</style>
