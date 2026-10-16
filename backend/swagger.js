/**
 * Swagger / OpenAPI 在线接口文档（P3-3）
 * - 接入 swagger-jsdoc：扫描 routes/*.js 中的 @openapi JSDoc 注解生成规范
 * - 由 server.js 挂载：/api-docs（UI）与 /api-docs.json（原始规范）
 * - 生产环境如需关闭，设置环境变量 ENABLE_API_DOCS=false
 *
 * 统一返回结构：
 *   成功 { code: 0, data: ..., message?: '...' }
 *   失败 { code: 1, message: '...' }（HTTP 200 或对应错误状态码；401 未登录 / 429 频率限制 / 500 服务器错误）
 */
const path = require('path');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const pkg = require('./package.json');

// Windows 下 swagger-jsdoc 的 glob 通配符不可靠，改为显式列出 routes 目录下的全部路由文件
const ROUTES_DIR = path.join(__dirname, 'routes');
const apiFiles = fs
  .readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => path.join(ROUTES_DIR, f).replace(/\\/g, '/'));

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: '服装店商家管理系统 API',
      version: pkg.version,
      description: [
        '微信小程序（收银开单 / 商品 / 订单 / 会员）与管理后台共用的 REST API。',
        '',
        '**鉴权**：除 `/api/auth/register`、`/api/auth/login`、`/api/health` 外，所有接口都需要',
        '`Authorization: Bearer <token>` 请求头（登录/注册接口返回的 token）。',
        '',
        '**多租户**：业务数据按登录账号绑定的店铺（store_id）隔离。'
      ].join('\n')
    },
    servers: [
      { url: '/', description: '当前服务' },
      { url: 'http://127.0.0.1:3000', description: '本地开发（backend 目录 npm run start:dev）' },
      { url: 'https://express-3how-324239-10-1501349049.sh.run.tcloudbase.com', description: '微信云托管' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        /** 统一成功响应 */
        ApiResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 0, description: '0=成功，1=业务失败' },
            message: { type: 'string', example: 'ok' },
            data: { type: 'object', nullable: true, description: '业务数据（各接口不同，见接口说明）' }
          }
        },
        /** 统一失败响应 */
        ApiError: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 1 },
            message: { type: 'string', example: '服务器内部错误' }
          }
        },
        Sku: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            color: { type: 'string', example: '黑色' },
            size: { type: 'string', example: 'M' },
            stock: { type: 'integer', example: 10 }
          }
        },
        Goods: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: '纯棉圆领T恤' },
            goods_no: { type: 'string', example: 'T2026001' },
            image: { type: 'string', description: '图片地址，多张用英文逗号分隔' },
            price: { type: 'number', example: 129.0 },
            original_price: { type: 'number', example: 199.0 },
            colors: { type: 'string', example: '白色,黑色' },
            sizes: { type: 'string', example: 'S,M,L' },
            stock: { type: 'integer', example: 30, description: '总库存（各 SKU 之和）' },
            category_id: { type: 'integer', nullable: true },
            category_name: { type: 'string', nullable: true },
            description: { type: 'string' },
            on_sale: { type: 'integer', example: 1, description: '1=上架 0=下架' },
            is_deleted: { type: 'integer', example: 0 },
            created_at: { type: 'string', example: '2026-10-16 10:00:00' },
            updated_at: { type: 'string', example: '2026-10-16 10:00:00' },
            skus: { type: 'array', items: { $ref: '#/components/schemas/Sku' } }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            order_no: { type: 'string', example: 'SO20261016123456' },
            total_amount: { type: 'number', example: 258.0 },
            pay_method: { type: 'string', example: 'offline' },
            status: { type: 'string', enum: ['pending', 'paid', 'done', 'cancelled', 'refunded'], example: 'pending' },
            customer_phone: { type: 'string', example: '13800138000' },
            customer_id: { type: 'integer', example: 0 },
            customer_name: { type: 'string', example: '赵女士' },
            remark: { type: 'string' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: '认证', description: '注册 / 登录（带频率限制）' },
      { name: '店铺', description: '店铺创建 / 绑定 / 切换 / 成员管理' },
      { name: '商品', description: '商品与 SKU 库存' },
      { name: '分类', description: '商品分类' },
      { name: '订单', description: '开单 / 订单管理与库存回滚' },
      { name: '统计', description: '首页数据面板' },
      { name: '上传', description: '商品图片上传' },
      { name: '平台', description: '平台管理员：开单白名单 / 店铺改名' },
      { name: '会员', description: '客户 / 会员管理' },
      { name: '系统', description: '健康检查等' }
    ]
  },
  apis: apiFiles
};

module.exports = swaggerJsdoc(options);
