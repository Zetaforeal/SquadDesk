<template>
  <div class="image-input">
    <div v-if="displayUrl" class="preview">
      <el-image :src="displayUrl" fit="cover" style="width: 100%; height: 100%" :preview-src-list="[displayUrl]" />
      <div class="overlay">
        <el-button link type="danger" size="small" @click="clear">
          <Trash2 :size="14" />
        </el-button>
      </div>
    </div>
    <div v-else class="empty" @click="fileInput.click()">
      <Upload :size="20" />
      <span>{{ uploading ? '上传中...' : '点击上传' }}</span>
    </div>
    <el-input v-model="urlValue" placeholder="或直接粘贴图片链接 (https://...)" clearable class="url-input" />
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload, Trash2 } from 'lucide-vue-next';
import request from '@/utils/request';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);

const fileInput = ref();
const urlValue = ref('');
const uploading = ref(false);
const previewUrl = ref(''); // 本地 blob 预览（仅内部显示，绝不写入 modelValue）

// 显示优先级：本地预览 > 已保存的真实路径
const displayUrl = computed(() => previewUrl.value || props.modelValue || '');

// URL 输入防抖写回（用户手输完整 URL 时用）
let timer = null;
watch(urlValue, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => emit('update:modelValue', v), 400);
});

function clear() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  emit('update:modelValue', '');
}

/** 前端压缩图片（宽最大 1600，转 JPEG/WebP，大幅减小上传体积） */
function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      if (scale >= 1 && file.size < 500 * 1024) return resolve(file); // 小图不处理
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

async function onFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 1. 仅本地预览（不写回 modelValue，避免 blob 被提交存库）
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = URL.createObjectURL(file);

  // 2. 前端压缩后上传
  uploading.value = true;
  try {
    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.append('file', compressed);
    const data = await request.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    // 3. 上传成功：真实路径写回 modelValue，清掉本地预览
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
    emit('update:modelValue', data.path);
    ElMessage.success('上传成功');
  } catch (err) {
    // 上传失败：仅清预览，保留原值
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
    ElMessage.error(err.message || '上传失败');
  } finally {
    uploading.value = false;
  }
  e.target.value = '';
}
</script>

<style scoped>
.image-input { display: flex; flex-direction: column; gap: 8px; }
.preview { position: relative; width: 120px; height: 120px; border-radius: 8px; overflow: hidden; border: 1px solid #e4e7ed; }
.overlay { position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); border-radius: 0 0 0 8px; }
.empty {
  width: 120px; height: 120px; border: 1px dashed #c0c4cc; border-radius: 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  color: #909399; cursor: pointer; background: #fafafa;
}
.empty:hover { border-color: #409eff; color: #409eff; }
.url-input { max-width: 360px; }
.hidden { display: none; }
</style>
