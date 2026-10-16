/**
 * 图片上传接口（商品图片）
 * POST /api/upload  multipart/form-data，字段名 file
 * - 配置了 COS 环境变量时：上传到腾讯云对象存储（持久化，返回完整 https URL）
 * - 未配置 COS 时：保存到容器本地磁盘，返回相对路径 /uploads/xxx（仅本地开发用）
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

// 仅允许的图片类型：MIME 类型 -> 落盘扩展名（P0-4：不接受其它类型，防止伪装脚本上传）
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// 内存存储：文件先读入内存，再按配置写入 COS 或本地磁盘
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.UPLOAD_MAX_BYTES }, // 单张最大 5MB（可通过 UPLOAD_MAX_BYTES 调整）
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return cb(new Error('只能上传 JPG/PNG/WebP 格式的图片'));
    }
    // 原文件名若带扩展名，则扩展名也必须在白名单内（双重校验，拒绝 .php/.js 等伪装文件名）
    if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('图片扩展名不合法，仅支持 jpg/jpeg/png/webp'));
    }
    cb(null, true);
  }
});

/** 是否启用腾讯云 COS 持久化 */
const useCos = !!(config.COS.BUCKET && config.COS.REGION);
let cos = null;
if (useCos) {
  const COS = require('cos-nodejs-sdk-v5');

  // 云托管集成对象存储使用内部临时授权（http://api.weixin.qq.com/_/cos/getauth），
  // 不需要配置固定 SecretId/SecretKey；若配置了固定密钥则优先用固定密钥。
  const cosOptions =
    config.COS.SECRET_ID && config.COS.SECRET_KEY
      ? { SecretId: config.COS.SECRET_ID, SecretKey: config.COS.SECRET_KEY }
      : {
          getAuthorization(options, callback) {
            const http = require('http');
            http
              .get('http://api.weixin.qq.com/_/cos/getauth', (res) => {
                let body = '';
                res.on('data', (chunk) => {
                  body += chunk;
                });
                res.on('end', () => {
                  try {
                    const data = JSON.parse(body);
                    callback({
                      TmpSecretId: data.TmpSecretId,
                      TmpSecretKey: data.TmpSecretKey,
                      SecurityToken: data.Token,
                      ExpiredTime: data.ExpiredTime
                    });
                  } catch (e) {
                    callback({ error: e });
                  }
                });
              })
              .on('error', (err) => callback({ error: err }));
          }
        };
  cos = new COS(cosOptions);
}

/** 生成文件名：时间戳 + 加密随机串 + 白名单扩展名（P0-4：文件名不可预测，杜绝路径遍历/覆盖） */
function genFilename(mimetype) {
  const ext = ALLOWED_IMAGE_TYPES[mimetype] || '.jpg';
  return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
}

/** multer 中间件包装：把上传错误（大小超限/类型不符）转成统一的 JSON 返回 */
function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `图片大小不能超过 ${Math.round(config.UPLOAD_MAX_BYTES / 1024 / 1024)}MB`
        : err.message || '图片上传失败';
    logger.warn({ err, ip: req.ip }, 'upload rejected');
    res.status(400).json({ code: 1, message });
  });
}

/**
 * @openapi
 * /api/upload:
 *   post:
 *     tags: [上传]
 *     summary: 上传商品图片（multipart/form-data，字段名 file）
 *     description: 仅允许 JPG/PNG/WebP，单张最大 5MB；配置 COS 时返回 https 完整地址，否则返回 /uploads/xxx 相对路径（文件名随机不可预测）
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: 'data = { url }' }
 *       400: { description: '文件类型不合法或超过大小限制' }
 */
router.post('/', auth, requireStore, uploadSingle, async (req, res) => {
  if (!req.file) return res.json({ code: 1, message: '未收到图片文件' });
  const filename = genFilename(req.file.mimetype);
  try {
    if (useCos) {
      // 上传到 COS（持久化）：Key 形如 uploads/1730000000-abc123.jpg
      const Key = `uploads/${filename}`;
      await new Promise((resolve, reject) => {
        cos.putObject(
          {
            Bucket: config.COS.BUCKET,
            Region: config.COS.REGION,
            Key,
            Body: req.file.buffer
          },
          (err, data) => (err ? reject(err) : resolve(data))
        );
      });
      return res.json({
        code: 0,
        data: { url: `https://${config.COS.BUCKET}.cos.${config.COS.REGION}.myqcloud.com/${Key}` }
      });
    }
    // 本地磁盘（仅开发用）
    fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(config.UPLOAD_DIR, filename), req.file.buffer);
    res.json({ code: 0, data: { url: `/uploads/${filename}` } });
  } catch (e) {
    // 完整错误（含 COS 返回信息）仅写日志，前端返回脱敏提示（P0-5）
    logger.error({ err: e }, 'upload failed');
    res.status(500).json({ code: 1, message: '图片上传失败，请稍后重试' });
  }
});

module.exports = router;
