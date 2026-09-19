<template>
  <div class="image-input">
    <div v-if="modelValue" class="preview">
      <el-image :src="modelValue" fit="cover" style="width: 100%; height: 100%" :preview-src-list="[modelValue]" />
      <div class="overlay">
        <el-button link type="danger" size="small" @click="$emit('update:modelValue', '')">
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
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload, Trash2 } from 'lucide-vue-next';
import request from '@/utils/request';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);

const fileInput = ref();
const urlValue = ref('');
const uploading = ref(false);

let timer = null;
watch(urlValue, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => emit('update:modelValue', v), 400);
});

async function onFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const data = await request.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    emit('update:modelValue', data.path);
    ElMessage.success('上传成功');
  } catch (err) {
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
