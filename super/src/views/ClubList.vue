<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-button type="success" @click="dialogVisible = true">新增俱乐部</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="俱乐部名称" min-width="140" />
        <el-table-column prop="code" label="编码" width="110" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="170">
          <template #default="{ row }">
            <span :class="{ expired: row.expiresAt && new Date(row.expiresAt) < new Date() }">{{ fmt(row.expiresAt) || '永久' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订单" width="80" />
        <el-table-column prop="userCount" label="用户" width="80" />
        <el-table-column prop="playerCount" label="打手" width="80" />
        <el-table-column label="交易额" width="110">
          <template #default="{ row }">{{ row.paidAmount }}</template>
        </el-table-column>
        <el-table-column label="操作" width="400" fixed="right">
          <template #default="{ row }">
            <el-button link type="success" @click="showBackend(row)">后台入口</el-button>
            <el-button link type="primary" @click="$router.push(`/clubs/${row.id}`)">详情</el-button>
            <el-button link type="warning" @click="editExpiry(row)">到期设置</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
            <el-button v-if="row.maxPlayers || row.maxOrders" link type="warning" @click="resetDemo(row)">清除记录</el-button>
            <el-button link type="success" :loading="row._building" @click="downloadMiniprogram(row)">生成小程序</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增俱乐部 -->
    <el-dialog v-model="dialogVisible" title="新增俱乐部" width="560px" destroy-on-close>
      <el-form :model="form" label-width="120px">
        <el-form-item label="俱乐部名称" required>
          <el-input v-model="form.name" placeholder="如：XX俱乐部" />
        </el-form-item>
        <el-form-item label="租户编码" required>
          <el-input v-model="form.code" placeholder="如 club002，将用于订单号前缀" />
        </el-form-item>
        <el-form-item label="管理员用户名" required>
          <el-input v-model="form.adminUsername" placeholder="默认 admin" />
        </el-form-item>
        <el-form-item label="管理员密码" required>
          <el-input v-model="form.adminPassword" type="password" show-password placeholder="至少 12 位" />
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker v-model="form.expiresAt" type="datetime" placeholder="留空=永久" style="width: 100%" value-format="YYYY-MM-DDTHH:mm:ss" />
        </el-form-item>
        <el-form-item label="演示版限制">
          <div style="width: 100%">
            <el-switch v-model="form.demoMode" active-text="启用（限制打手与订单数）" />
            <div v-if="form.demoMode" style="margin-top: 10px; display: flex; gap: 12px;">
              <el-input-number v-model="form.maxPlayers" :min="1" :max="100" placeholder="打手上限" />
              <span style="line-height: 32px; color: #909399; font-size: 13px;">打手上限</span>
              <el-input-number v-model="form.maxOrders" :min="1" :max="100" placeholder="订单上限" />
              <span style="line-height: 32px; color: #909399; font-size: 13px;">订单上限</span>
            </div>
            <div class="tip" style="margin-top: 6px;">演示版到达上限后需超管清除记录方可继续使用</div>
          </div>
        </el-form-item>
        <el-form-item label="小程序 AppID">
          <el-input v-model="form.wechat.appid" placeholder="可稍后在俱乐部后台填写" />
        </el-form-item>
        <el-form-item label="AppSecret">
          <el-input v-model="form.wechat.secret" placeholder="可稍后在俱乐部后台填写" />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="form.wechat.mchid" placeholder="可稍后在俱乐部后台填写" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">创建</el-button>
      </template>
    </el-dialog>

    <!-- 到期设置 -->
    <el-dialog v-model="expiryDialog" title="到期设置" width="420px">
      <el-form label-width="90px">
        <el-form-item label="到期时间">
          <el-date-picker v-model="expiryValue" type="datetime" placeholder="留空=永久" style="width: 100%" value-format="YYYY-MM-DDTHH:mm:ss" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="expiryStatus" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <div class="tip">到期后只禁新交易：可浏览、在途订单可完成、管理员可登录</div>
      </el-form>
      <template #footer>
        <el-button @click="expiryDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveExpiry">保存</el-button>
      </template>
    </el-dialog>

    <!-- 后台入口信息 -->
    <el-dialog v-model="backendDialog" :title="`「${currentClub?.name || ''}」访问入口`" width="560px">
      <el-alert type="info" :closable="false" title="把下面信息发给俱乐部管理员即可" class="mb12" />
      <div class="entry-block">
        <div class="entry-label">俱乐部管理后台（管理员）</div>
        <div class="entry-value">
          <div>地址：<a :href="backendUrl" target="_blank">{{ backendUrl }}</a></div>
          <div>俱乐部 ID（租户）：<b>{{ currentClub?.id }}</b></div>
          <div>管理员账号：<b>admin</b>（密码在俱乐部后台自行修改）</div>
          <el-button type="primary" size="small" @click="openUrl(backendUrl)">打开后台</el-button>
        </div>
      </div>
      <div class="entry-block">
        <div class="entry-label">打手端（打手登录）</div>
        <div class="entry-value">
          <div>地址：<a :href="playerUrl" target="_blank">{{ playerUrl }}</a></div>
          <div>打手登录需填：俱乐部 ID = <b>{{ currentClub?.id }}</b> + 打手账号（管理员在后台创建）</div>
          <el-button type="primary" size="small" @click="openUrl(playerUrl)">打开打手端</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const rows = ref([]);
const dialogVisible = ref(false);
const expiryDialog = ref(false);
const backendDialog = ref(false);
const saving = ref(false);
const currentClub = ref(null);
const expiryValue = ref(null);
const expiryStatus = ref(true);

// 前端入口地址（与 Nginx 部署路径一致）
const backendUrl = window.location.origin + '/admin/';
const playerUrl = window.location.origin + '/player/';

function showBackend(row) {
  currentClub.value = row;
  backendDialog.value = true;
}

function openUrl(url) {
  window.open(url, '_blank');
}

const form = reactive({
  name: '', code: '', adminUsername: 'admin', adminPassword: '',
  expiresAt: null, wechat: { appid: '', secret: '', mchid: '' },
  demoMode: false, maxPlayers: 2, maxOrders: 2,
});

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : ''; }

async function load() {
  loading.value = true;
  try {
    rows.value = await request.get('/clubs');
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.name || !form.code) return ElMessage.warning('请填写名称与编码');
  if (!form.adminPassword || form.adminPassword.length < 12) return ElMessage.warning('管理员密码至少 12 位');
  saving.value = true;
  try {
    await request.post('/clubs', {
      ...form,
      maxPlayers: form.demoMode ? form.maxPlayers : null,
      maxOrders: form.demoMode ? form.maxOrders : null,
    });
    ElMessage.success('俱乐部已创建');
    dialogVisible.value = false;
    Object.assign(form, { name: '', code: '', adminUsername: 'admin', adminPassword: '', expiresAt: null, wechat: { appid: '', secret: '', mchid: '' }, demoMode: false, maxPlayers: 2, maxOrders: 2 });
    load();
  } finally {
    saving.value = false;
  }
}

function editExpiry(row) {
  currentClub.value = row;
  expiryValue.value = row.expiresAt || null;
  expiryStatus.value = row.status === 1;
  expiryDialog.value = true;
}

async function saveExpiry() {
  saving.value = true;
  try {
    await request.put(`/clubs/${currentClub.value.id}`, {
      expiresAt: expiryValue.value || null,
      status: expiryStatus.value ? 1 : 0,
    });
    ElMessage.success('已保存');
    expiryDialog.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除俱乐部「${row.name}」？删除前需无有效订单。`, '警告', { type: 'warning' });
  await request.delete(`/clubs/${row.id}`);
  ElMessage.success('已删除');
  load();
}

/** 清除演示版记录（重置打手/订单，保留商品与管理员） */
async function resetDemo(row) {
  await ElMessageBox.confirm(`确定清除「${row.name}」的全部演示记录？将删除所有打手、订单与佣金数据，商品与首页配置保留。`, '清除演示记录', { type: 'warning' });
  await request.post(`/clubs/${row.id}/reset-demo`);
  ElMessage.success('演示记录已清除，可重新添加打手与订单');
  load();
}

/** 一键生成小程序源码包（zip 下载） */
async function downloadMiniprogram(row) {
  row._building = true;
  try {
    const token = localStorage.getItem('super_token');
    // 直接走 fetch 拿 blob（request 封装会解包 data，不适合文件流）
    const resp = await fetch(`${window.location.origin}/api/super/miniprogram/build/${row.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || '生成失败');
    }
    const blob = await resp.blob();
    const filename = (resp.headers.get('content-disposition') || '').match(/filename="?([^";]+)/)?.[1] || `${row.code}-miniprogram.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    ElMessage.success(`已生成 ${filename}，包含租户 ${row.id} / AppID 配置`);
  } catch (e) {
    ElMessage.error(e.message || '生成失败，请确认俱乐部已配置小程序 AppID');
  } finally {
    row._building = false;
  }
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.expired { color: #f56c6c; font-weight: 600; }
.tip { font-size: 12px; color: #909399; padding: 0 8px; }
.mb12 { margin-bottom: 12px; }
.entry-block {
  border: 1px solid #e4e7ed; border-radius: 8px;
  padding: 12px 16px; margin-bottom: 12px;
}
.entry-label { font-size: 13px; color: #606266; margin-bottom: 8px; font-weight: 600; }
.entry-value { font-size: 13px; line-height: 2; }
.entry-value a { color: #409eff; }
.entry-value b { color: #e6a23c; }
</style>
