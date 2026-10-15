// 商品编辑页：新增 / 编辑商品（全字段表单 + 图片上传 + 颜色尺码标签录入）
const { request, uploadFile, BASE_URL } = require('../../utils/api');
const { resolveImg } = require('../../utils/util');
const { toast, loading: showLoading, hideLoading } = require('../../utils/dialog');

Page({
  data: {
    id: null,               // 商品ID（编辑时有值，新增为 null）
    isEdit: false,
    form: {
      name: '',
      goodsNo: '',          // 货号（选填）
      price: '',
      originalPrice: '',
      description: '',
      onSale: true,
      categoryId: null
    },
    skus: [{ color: '', size: '', stock: '' }], // 规格库存（无属性时仅一行空规格）
    hasSpec: false,         // 是否设置了颜色/尺码属性
    totalStock: 0,          // 各规格库存之和
    imagePaths: [],         // 已上传图片的相对路径（存数据库，逗号分隔）
    imageUrls: [],          // 用于展示的完整地址
    colors: [],             // 已选颜色数组（预设选中 + 自定义）
    customColors: [],       // 自定义颜色（输入框添加）
    colorOptions: [         // 最常见颜色预设选项（点选开关，hex 为色点颜色）
      { value: '黑色', hex: '#1f1b18', on: false },
      { value: '白色', hex: '#ffffff', on: false },
      { value: '灰色', hex: '#9ca3af', on: false },
      { value: '米色', hex: '#ead9b8', on: false },
      { value: '红色', hex: '#c7402e', on: false },
      { value: '蓝色', hex: '#3867c4', on: false }
    ],
    colorInput: '',         // 自定义颜色输入框
    sizes: [],              // 已选尺码数组
    sizeOptions: [          // 尺码预设选项（点选开关）
      { value: 'XS', on: false },
      { value: 'S', on: false },
      { value: 'M', on: false },
      { value: 'L', on: false },
      { value: 'XL', on: false },
      { value: 'XXL', on: false },
      { value: 'XXXL', on: false },
      { value: '均码', on: false }
    ],
    categories: [],         // 分类列表（来自数据库）
    categoryInput: '',      // 分类输入框（搜索 / 新增）
    showAddCategory: false, // 输入的分类不存在时显示"新增"按钮
    submitting: false
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    // 导航栏标题统一为「裁间」（各页 json 已配置），此处不再动态覆盖
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadGoods(options.id);
    }
    this.loadCategories();
  },

  /** 加载商品详情（编辑模式） */
  async loadGoods(id) {
    const g = await request({ url: `/api/goods/${id}` });
    const imagePaths = g.image ? g.image.split(',').filter(Boolean) : [];
    const colors = g.colors ? g.colors.split(',').filter(Boolean) : [];
    const sizes = g.sizes ? g.sizes.split(',').filter(Boolean) : [];
    // 颜色回显：命中预设的点亮选项，其余作为自定义颜色展示
    const colorOptions = this.data.colorOptions.map((o) => ({ ...o, on: colors.includes(o.value) }));
    const customColors = colors.filter((c) => !colorOptions.some((o) => o.value === c));
    // 尺码预设选项回显：历史数据中的自定义尺码追加到选项末尾
    const preset = this.data.sizeOptions.map((o) => ({ ...o, on: sizes.includes(o.value) }));
    const extra = sizes
      .filter((s) => !preset.some((o) => o.value === s))
      .map((s) => ({ value: s, on: true }));
    const sizeOptions = preset.concat(extra);
    // 规格库存：优先用后端返回的 skus；为空时生成默认行
    let skus;
    if (g.skus && g.skus.length) {
      skus = g.skus.map((s) => ({ color: s.color || '', size: s.size || '', stock: s.stock }));
    } else {
      skus = [{ color: '', size: '', stock: g.stock }];
    }
    this.setData({
      form: {
        name: g.name,
        goodsNo: g.goods_no || '',
        price: String(g.price),
        originalPrice: g.original_price ? String(g.original_price) : '',
        description: g.description || '',
        onSale: g.on_sale === 1,
        categoryId: g.category_id || null
      },
      imagePaths,
      imageUrls: imagePaths.map((p) => resolveImg(p, BASE_URL)),
      colors,
      colorOptions,
      customColors,
      sizes,
      sizeOptions,
      skus,
      hasSpec: colors.length > 0 || sizes.length > 0
    });
    this.calcTotalStock();
    this.syncCategoryView();
  },

  /** 加载商品分类（用于搜索选择/新增） */
  async loadCategories() {
    const list = await request({ url: '/api/category' });
    this.setData({ categories: list || [] });
    this.syncCategoryView();
  },

  /** 根据输入同步分类选中态；输入未存在的分类名时显示"新增"按钮 */
  syncCategoryByInput() {
    const kw = this.data.categoryInput.trim();
    const { categories } = this.data;
    const exact = kw ? categories.find((c) => c.name === kw) : null;
    this.setData({
      'form.categoryId': exact ? exact.id : null,
      showAddCategory: !!kw && !exact
    });
  },

  /** 编辑回显时同步分类输入框 */
  syncCategoryView() {
    const { form, categories } = this.data;
    const cat = categories.find((c) => c.id === form.categoryId);
    this.setData({ categoryInput: cat ? cat.name : '', showAddCategory: false });
  },

  // ============ 表单输入 ============
  onNameInput(e) { this.setData({ 'form.name': e.detail.value }); },
  onGoodsNoInput(e) { this.setData({ 'form.goodsNo': e.detail.value }); },
  onPriceInput(e) { this.setData({ 'form.price': e.detail.value }); },
  onOriginPriceInput(e) { this.setData({ 'form.originalPrice': e.detail.value }); },
  onDescInput(e) { this.setData({ 'form.description': e.detail.value }); },
  onCategoryInput(e) {
    this.setData({ categoryInput: e.detail.value });
    this.syncCategoryByInput();
  },

  /** 新增分类：创建成功后自动选中 */
  async addCategory() {
    const name = this.data.categoryInput.trim();
    if (!name) return;
    try {
      const created = await request({
        url: '/api/category',
        method: 'POST',
        data: { name, sort: 0 }
      });
      await this.loadCategories();
      const cat = this.data.categories.find((c) => c.id === (created && created.id)) ||
        this.data.categories.find((c) => c.name === name);
      if (cat) {
        this.setData({ 'form.categoryId': cat.id, categoryInput: cat.name });
        this.syncCategoryByInput();
      }
      toast('分类已创建', 'success');
    } catch (e) {
      // 错误提示由请求封装统一处理
    }
  },

  /** 规格库存输入（skus[index].stock） */
  onSkuStockInput(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`skus[${idx}].stock`]: e.detail.value });
    this.calcTotalStock();
  },

  /** 合计库存 */
  calcTotalStock() {
    const total = this.data.skus.reduce(
      (sum, s) => sum + (parseInt(s.stock, 10) || 0), 0
    );
    this.setData({ totalStock: total });
  },

  /**
   * 根据当前颜色/尺码重建规格组合（保留已填写过的库存值）
   * 颜色×尺码 全组合；只有颜色或只有尺码时另一维为空串
   */
  rebuildSkus() {
    const { colors, sizes, skus } = this.data;
    const hasSpec = colors.length > 0 || sizes.length > 0;
    const oldMap = {};
    skus.forEach((s) => { oldMap[`${s.color}|${s.size}`] = s.stock; });
    let newSkus;
    if (!hasSpec) {
      newSkus = [{ color: '', size: '', stock: oldMap['|'] !== undefined ? oldMap['|'] : '' }];
    } else {
      const colorList = colors.length ? colors : [''];
      const sizeList = sizes.length ? sizes : [''];
      newSkus = [];
      for (const c of colorList) {
        for (const s of sizeList) {
          const key = `${c}|${s}`;
          newSkus.push({ color: c, size: s, stock: oldMap[key] !== undefined ? oldMap[key] : '' });
        }
      }
    }
    this.setData({ skus: newSkus, hasSpec });
    this.calcTotalStock();
  },

  // ============ 图片上传（最多 3 张） ============
  async chooseImage() {
    if (this.data.imagePaths.length >= 3) {
      toast('最多上传 3 张图片', 'none');
      return;
    }
    wx.chooseMedia({
      count: 3 - this.data.imagePaths.length,
      mediaType: ['image'],
      success: async (res) => {
        showLoading('上传中...');
        try {
          for (const f of res.tempFiles) {
            const url = await uploadFile(f.tempFilePath);
            this.setData({
              imagePaths: this.data.imagePaths.concat(url),
              imageUrls: this.data.imageUrls.concat(resolveImg(url, BASE_URL))
            });
          }
        } finally {
          hideLoading();
        }
      }
    });
  },

  /** 删除某张图片 */
  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const imagePaths = this.data.imagePaths.slice();
    const imageUrls = this.data.imageUrls.slice();
    imagePaths.splice(idx, 1);
    imageUrls.splice(idx, 1);
    this.setData({ imagePaths, imageUrls });
  },

  // ============ 颜色 / 尺码选项 ============
  /** 常见颜色预设选项点选开关 */
  toggleColor(e) {
    const value = e.currentTarget.dataset.value;
    const colorOptions = this.data.colorOptions.map((o) => (
      o.value === value ? { ...o, on: !o.on } : o
    ));
    const colors = colorOptions.filter((o) => o.on).map((o) => o.value)
      .concat(this.data.customColors);
    this.setData({ colorOptions, colors });
    this.rebuildSkus();
  },

  /** 自定义颜色输入与添加 */
  onColorInput(e) { this.setData({ colorInput: e.detail.value }); },
  addColor() {
    const v = this.data.colorInput.trim();
    if (!v) return;
    const { colors, customColors, colorOptions } = this.data;
    if (colors.includes(v) || colorOptions.some((o) => o.value === v)) {
      this.setData({ colorInput: '' });
      return;
    }
    this.setData({
      customColors: customColors.concat(v),
      colors: colors.concat(v),
      colorInput: ''
    });
    this.rebuildSkus();
  },
  /** 移除自定义颜色 */
  removeColor(e) {
    const customColors = this.data.customColors.slice();
    const removed = customColors.splice(e.currentTarget.dataset.index, 1)[0];
    const colors = this.data.colors.filter((c) => c !== removed);
    this.setData({ customColors, colors });
    this.rebuildSkus();
  },

  /** 尺码预设选项点选开关 */
  toggleSize(e) {
    const value = e.currentTarget.dataset.value;
    const sizeOptions = this.data.sizeOptions.map((o) => (
      o.value === value ? { ...o, on: !o.on } : o
    ));
    const sizes = sizeOptions.filter((o) => o.on).map((o) => o.value);
    this.setData({ sizeOptions, sizes });
    this.rebuildSkus();
  },
  // ============ 提交 ============
  async handleSubmit() {
    const { form, imagePaths, colors, sizes, skus, id, submitting } = this.data;
    if (submitting) return;

    // 表单校验
    if (!form.name.trim()) { toast('请输入商品名称', 'none'); return; }
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) {
      toast('请输入正确的售价', 'none'); return;
    }
    if (form.originalPrice !== '' && (isNaN(Number(form.originalPrice)) || Number(form.originalPrice) < 0)) {
      toast('原价格式不正确', 'none'); return;
    }
    // 规格库存校验
    const skuList = skus.map((s) => ({
      color: s.color,
      size: s.size,
      stock: parseInt(s.stock, 10)
    }));
    for (const s of skuList) {
      if (isNaN(s.stock) || s.stock < 0) {
        const label = this.data.hasSpec
          ? `规格【${s.color || '默认色'} / ${s.size || '默认码'}】` : '';
        toast(`请输入${label}正确的库存`, 'none');
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      goodsNo: form.goodsNo.trim(),
      image: imagePaths.join(','),
      price: Number(form.price),
      originalPrice: form.originalPrice === '' ? 0 : Number(form.originalPrice),
      colors: colors.join(','),
      sizes: sizes.join(','),
      skus: skuList,
      categoryId: form.categoryId,
      description: form.description.trim(),
      // 新增商品点"立即上架"直接上架；编辑商品保持原上架状态（可在商品列表上下架）
      onSale: id ? form.onSale : true
    };

    this.setData({ submitting: true });
    try {
      if (id) {
        await request({ url: `/api/goods/${id}`, method: 'PUT', data: payload });
      } else {
        await request({ url: '/api/goods', method: 'POST', data: payload });
      }
      toast('保存成功', 'success');
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      // 错误提示由请求封装统一处理
    } finally {
      this.setData({ submitting: false });
    }
  }
});
