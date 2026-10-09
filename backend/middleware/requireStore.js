/**
 * 店铺绑定守卫：商品/分类/订单/统计/上传等业务接口必须已绑定店铺
 * 未绑定返回 code=1001，前端统一引导到店铺绑定页
 */
module.exports = function requireStore(req, res, next) {
  if (!req.admin || !req.admin.storeId) {
    return res.status(403).json({ code: 1001, message: '请先创建店铺或使用店铺码加入店铺' });
  }
  next();
};
