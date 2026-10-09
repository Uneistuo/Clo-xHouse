/**
 * 平台管理员守卫：仅小程序平台管理员（admin.is_platform = 1）可访问
 * 用于店铺开单白名单等平台级管理接口
 */
module.exports = function requirePlatform(req, res, next) {
  if (!req.admin || !req.admin.isPlatform) {
    return res.status(403).json({ code: 1, message: '无权限：仅平台管理员可操作' });
  }
  next();
};
