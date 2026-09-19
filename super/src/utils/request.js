import axios from 'axios';
import { ElMessage } from 'element-plus';

const request = axios.create({ baseURL: '/api/super', timeout: 15000 });

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('super_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

request.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body.code === 0) return body.data;
    if (body.code === 401) {
      localStorage.removeItem('super_token');
      window.location.href = '/super/login';
    }
    ElMessage.error(body.message || '请求失败');
    return Promise.reject(body);
  },
  (err) => {
    ElMessage.error(err.message || '网络错误');
    return Promise.reject(err);
  }
);

export default request;
