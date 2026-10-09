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
const config = require('../config');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

// 内存存储：文件先读入内存，再按配置写入 COS 或本地磁盘
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 单张最大 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('只能上传图片文件'));
  }
});

/** 是否启用腾讯云 COS 持久化 */
const useCos = !!(config.COS.BUCKET && config.COS.REGION);
let cos = null;
if (useCos) {
  const COS = require('cos-nodejs-sdk-v5');

  // 云托管集成对象存储使用内部临时授权（http://api.weixin.qq.com/_/cos/getauth），
  // 不需要配置固定 SecretId/SecretKey；若配置了固定密钥则优先用固定密钥。
  const cosOptions = config.COS.SECRET_ID && config.COS.SECRET_KEY
    ? { SecretId: config.COS.SECRET_ID, SecretKey: config.COS.SECRET_KEY }
    : {
        getAuthorization(options, callback) {
          const http = require('http');
          http.get('http://api.weixin.qq.com/_/cos/getauth', (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
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
          }).on('error', (err) => callback({ error: err }));
        }
      };
  cos = new COS(cosOptions);
}

/** 生成文件名：时间戳 + 随机串 + 原扩展名，避免重名覆盖 */
function genFilename(originalname) {
  const ext = (path.extname(originalname) || '.jpg').toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

router.post('/', auth, requireStore, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ code: 1, message: '未收到图片文件' });
  const filename = genFilename(req.file.originalname);
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
      return res.json({ code: 0, data: { url: `https://${config.COS.BUCKET}.cos.${config.COS.REGION}.myqcloud.com/${Key}` } });
    }
    // 本地磁盘（仅开发用）
    fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(config.UPLOAD_DIR, filename), req.file.buffer);
    res.json({ code: 0, data: { url: `/uploads/${filename}` } });
  } catch (e) {
    res.status(500).json({ code: 1, message: `图片上传失败：${e.message || '未知错误'}` });
  }
});

module.exports = router;
