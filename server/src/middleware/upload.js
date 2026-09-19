/**
 * 文件上传中间件（multer，统一 uploads 目录）
 * 保留原文件名后缀，随机文件名，限制大小（env.UPLOAD_MAX_SIZE_MB）
 * 上传后自动压缩（sharp → 原格式，宽最大 1600px，质量 80），兼容小程序真机（iOS WKWebView 对 WebP 支持不稳定）
 */
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const { env } = require('../config');

const UPLOAD_ROOT = path.join(__dirname, '../../', env.UPLOAD_DIR);

if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_ROOT);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('仅支持 jpg/jpeg/png/gif/webp 图片'));
    }
    // 纵深防御：校验 MIME 类型（拦截伪造扩展名的恶意内容）
    const mime = (file.mimetype || '').toLowerCase();
    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_MIME.includes(mime)) {
      return cb(new Error('仅支持 jpg/jpeg/png/gif/webp 图片'));
    }
    cb(null, true);
  },
});

/** 原格式对应的 sharp 输出编码 */
const ENCODER = {
  '.jpg': { fn: 'jpeg', opts: { quality: 80 } },
  '.jpeg': { fn: 'jpeg', opts: { quality: 80 } },
  '.png': { fn: 'png', opts: { compressionLevel: 8 } },
  '.webp': { fn: 'webp', opts: { quality: 80 } },
};

/**
 * 压缩图片（上传完成后调用）：
 *  - 非 GIF：按原格式压缩（jpg/jpeg → jpeg, png → png, webp → webp），宽最大 MAX_WIDTH
 *  - GIF：动图无法压缩，跳过
 * 返回最终相对路径 /uploads/xxx.原格式（或原 gif）
 * 说明：不强制转 WebP——WebP 在 iOS 微信真机（WKWebView 老内核）存在兼容问题导致白图
 */
async function compressImage(filePath, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const meta = await sharp(filePath, { animated: ext === '.gif' }).metadata();
  const expectedFormats = ext === '.jpg' || ext === '.jpeg' ? ['jpeg'] : [ext.slice(1)];
  if (!meta.format || !expectedFormats.includes(meta.format)) {
    throw new Error('图片实际格式与文件扩展名不一致');
  }
  if (ext === '.gif') return `/uploads/${path.basename(filePath)}`;

  const enc = ENCODER[ext] || ENCODER['.jpg'];
  const maxWidth = 1600;
  const resizeOpts = { withoutEnlargement: true };
  if (meta.width && meta.width > maxWidth) resizeOpts.width = maxWidth;

  const newName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const newPath = path.join(UPLOAD_ROOT, newName);
  let pipeline = sharp(filePath).resize(resizeOpts);
  if (enc.fn === 'jpeg') pipeline = pipeline.jpeg(enc.opts);
  else if (enc.fn === 'png') pipeline = pipeline.png(enc.opts);
  else pipeline = pipeline.webp(enc.opts);
  await pipeline.toFile(newPath);

  // 删除原始大图
  fs.rmSync(filePath, { force: true });
  return `/uploads/${newName}`;
}

/** 统一处理上传结果：压缩 + 注入 req.imagePath */
function processUpload(req, res, next) {
  if (!req.file) {
    return res.json({ code: 400, message: '未收到文件', data: null });
  }
  compressImage(req.file.path, req.file.originalname)
    .then((relPath) => {
      req.imagePath = relPath;
      next();
    })
    .catch((e) => {
      fs.rmSync(req.file.path, { force: true });
      return res.status(500).json({ code: 500, message: '图片处理失败', data: null });
    });
}

// 单图上传（返回 /uploads/xxx 相对路径，自动压缩）
function singleImage(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err) {
        return res.json({ code: 400, message: '上传失败: ' + err.message, data: null });
      }
      processUpload(req, res, next);
    });
  };
}

/**
 * 可选单图上传（图片双通道：有文件则用文件并压缩，无文件则透传给 controller 读 URL 字段）
 * 配合 controller 内 `req.imagePath || req.body.xxxUrl` 逻辑
 */
function optionalSingleImage(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err) {
        return res.json({ code: 400, message: '上传失败: ' + err.message, data: null });
      }
      if (req.file) {
        processUpload(req, res, next);
      } else {
        next();
      }
    });
  };
}

module.exports = { upload, singleImage, optionalSingleImage, UPLOAD_ROOT };
