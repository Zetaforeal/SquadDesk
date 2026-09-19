/**
 * 商品目录服务：分类 / 商品 / 首页布局（管理端 + 用户端共用）
 * 用户端：published=1 浏览；管理端：全量 CRUD（含 commission_rate）
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { validateImageField } = require('../utils/image');
const { safeText } = require('../utils/sanitize');
const { parsePagination, paginated } = require('../utils/pagination');

// ---------- 分类 ----------

async function listCategories({ tenantId, onlyEnabled = false }) {
  return prisma.category.findMany({
    where: { tenantId, ...(onlyEnabled ? { enabled: true } : {}) },
    orderBy: { sortOrder: 'asc' },
  });
}

async function createCategory({ tenantId, name, icon, sortOrder, enabled }) {
  if (!name) throw new BizError(Code.VALIDATE_ERROR, '分类名称必填');
  const cleanName = safeText(name, 100);
  if (!cleanName) throw new BizError(Code.VALIDATE_ERROR, '分类名称不能为空');
  const img = validateImageField(icon);
  if (!img.ok) throw new BizError(Code.VALIDATE_ERROR, img.error);
  return prisma.category.create({
    data: { tenantId, name: cleanName, icon: icon || null, sortOrder: sortOrder || 0, enabled: enabled !== false },
  });
}

async function updateCategory({ tenantId, categoryId, data }) {
  const exists = await prisma.category.findFirst({ where: { tenantId, id: categoryId } });
  if (!exists) throw new BizError(Code.NOT_FOUND, '分类不存在');
  const updateData = {};
  if (data.name !== undefined) updateData.name = safeText(data.name, 50);
  if (data.icon !== undefined) {
    const img = validateImageField(data.icon);
    if (!img.ok) throw new BizError(Code.VALIDATE_ERROR, img.error);
    updateData.icon = data.icon || null;
  }
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.enabled !== undefined) updateData.enabled = !!data.enabled;
  return prisma.category.update({ where: { id: categoryId }, data: updateData });
}

async function deleteCategory({ tenantId, categoryId }) {
  const used = await prisma.product.count({ where: { tenantId, categoryId } });
  if (used > 0) throw new BizError(Code.VALIDATE_ERROR, '该分类下存在商品，无法删除');
  return prisma.category.delete({ where: { id: categoryId } });
}

// ---------- 商品 ----------

async function listProducts({ tenantId, categoryId, onlyPublished = false, page, pageSize, keyword }) {
  const where = { tenantId, ...(onlyPublished ? { published: true } : {}) };
  if (categoryId) where.categoryId = parseInt(categoryId, 10);
  if (keyword) where.name = { contains: keyword };
  const [total, list] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { name: true } }, images: { orderBy: { sortOrder: 'asc' } } },
    }),
  ]);
  return paginated(
    list.map((p) => ({
      ...p,
      price: p.price.toNumber(),
      commissionRate: p.commissionRate.toNumber(),
    })),
    total,
    page,
    pageSize
  );
}

async function getProduct({ tenantId, productId, onlyPublished = false }) {
  const p = await prisma.product.findFirst({
    where: { tenantId, id: productId, ...(onlyPublished ? { published: true } : {}) },
    include: { category: { select: { name: true } }, images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!p) throw new BizError(Code.NOT_FOUND, '商品不存在');
  return { ...p, price: p.price.toNumber(), commissionRate: p.commissionRate.toNumber() };
}

async function createProduct({ tenantId, data, images }) {
  const { name, price, categoryId } = data;
  if (!name || price === undefined || price === null || !categoryId) {
    throw new BizError(Code.VALIDATE_ERROR, '商品名称、价格、分类必填');
  }
  const cleanName = safeText(name, 100);
  const priceNum = parseFloat(price);
  if (Number.isNaN(priceNum) || priceNum < 0) throw new BizError(Code.VALIDATE_ERROR, '价格不合法');
  const rateNum = data.commissionRate !== undefined ? parseFloat(data.commissionRate) : 0;
  if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 1) {
    throw new BizError(Code.VALIDATE_ERROR, '佣金比例须在 0~1 之间');
  }
  const cover = validateImageField(data.coverUrl);
  if (!cover.ok) throw new BizError(Code.VALIDATE_ERROR, cover.error);

  const cat = await prisma.category.findFirst({ where: { tenantId, id: parseInt(categoryId, 10) } });
  if (!cat) throw new BizError(Code.VALIDATE_ERROR, '分类不存在');

  const imgList = (images || []).map((url, i) => ({ url, sortOrder: i }));
  for (const im of imgList) {
    const r = validateImageField(im.url);
    if (!r.ok) throw new BizError(Code.VALIDATE_ERROR, `详情图 ${i + 1}：${r.error}`);
  }

  return prisma.product.create({
    data: {
      tenantId,
      categoryId: parseInt(categoryId, 10),
      name: cleanName,
      price: priceNum,
      description: data.description ? safeText(data.description, 500) : null,
      coverUrl: data.coverUrl || null,
      published: data.published !== false,
      sortOrder: data.sortOrder || 0,
      commissionRate: rateNum,
      images: imgList.length ? { create: imgList.map((im) => ({ tenantId, ...im })) } : undefined,
    },
    include: { images: true },
  });
}

async function updateProduct({ tenantId, productId, data, images }) {
  const exists = await prisma.product.findFirst({ where: { tenantId, id: productId } });
  if (!exists) throw new BizError(Code.NOT_FOUND, '商品不存在');

  const updateData = {};
  if (data.name !== undefined) updateData.name = safeText(data.name, 100);
  if (data.categoryId !== undefined) {
    const cat = await prisma.category.findFirst({ where: { tenantId, id: parseInt(data.categoryId, 10) } });
    if (!cat) throw new BizError(Code.VALIDATE_ERROR, '分类不存在');
    updateData.categoryId = parseInt(data.categoryId, 10);
  }
  if (data.price !== undefined) {
    const n = parseFloat(data.price);
    if (Number.isNaN(n) || n < 0) throw new BizError(Code.VALIDATE_ERROR, '价格不合法');
    updateData.price = n;
  }
  if (data.commissionRate !== undefined) {
    const n = parseFloat(data.commissionRate);
    if (Number.isNaN(n) || n < 0 || n > 1) throw new BizError(Code.VALIDATE_ERROR, '佣金比例须在 0~1 之间');
    updateData.commissionRate = n;
  }
  if (data.description !== undefined) updateData.description = safeText(data.description, 500);
  if (data.coverUrl !== undefined) {
    const r = validateImageField(data.coverUrl);
    if (!r.ok) throw new BizError(Code.VALIDATE_ERROR, r.error);
    updateData.coverUrl = data.coverUrl || null;
  }
  if (data.published !== undefined) updateData.published = !!data.published;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id: productId }, data: updateData });
    if (images) {
      const imgList = images.map((url, i) => ({ url, sortOrder: i }));
      for (const im of imgList) {
        const r = validateImageField(im.url);
        if (!r.ok) throw new BizError(Code.VALIDATE_ERROR, `详情图：${r.error}`);
      }
      await tx.productImage.deleteMany({ where: { tenantId, productId } });
      if (imgList.length) {
        await tx.productImage.createMany({
          data: imgList.map((im) => ({ tenantId, productId, ...im })),
        });
      }
    }
    return tx.product.findUnique({ where: { id: productId }, include: { images: true } });
  });
}

async function deleteProduct({ tenantId, productId }) {
  const exists = await prisma.product.findFirst({ where: { tenantId, id: productId } });
  if (!exists) throw new BizError(Code.NOT_FOUND, '商品不存在');
  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { tenantId, productId } }),
    prisma.homeProductModule.deleteMany({ where: { tenantId, productId } }),
    prisma.orderItem.updateMany({ where: { tenantId, productId }, data: { productId: null } }),
    prisma.product.delete({ where: { id: productId } }),
  ]);
  return { success: true };
}

// ---------- 首页布局 ----------

// 注意：首页布局不做内存缓存——mall-api 是 PM2 cluster 双进程，内存缓存会导致
// 保存布局后另一进程仍返回旧数据（小程序端「不生效」）。布局查询本身毫秒级，DB 直查最可靠。

async function getActiveLayout({ tenantId }) {
  const layout = await prisma.homeLayout.findFirst({
    where: { tenantId, isActive: true },
    include: {
      modules: {
        orderBy: { sortOrder: 'asc' },
        include: {
          products: {
            orderBy: { sortOrder: 'asc' },
            include: { product: { select: { id: true, name: true, price: true, coverUrl: true } } },
          },
        },
      },
    },
  });
  if (!layout) return null;
  return {
    id: layout.id,
    name: layout.name,
    modules: layout.modules.map((m) => ({
      id: m.id,
      type: m.type,
      sortOrder: m.sortOrder,
      config: m.config,
      products: m.products.map((pm) => ({
        ...pm.product,
        price: pm.product.price.toNumber(),
      })),
    })),
  };
}

async function saveLayout({ tenantId, modules }) {
  if (!Array.isArray(modules) || modules.length > 50) {
    throw new BizError(Code.VALIDATE_ERROR, '首页模块格式不合法或超过 50 个');
  }
  const allowedTypes = new Set(['BANNER', 'SECTION_TITLE', 'ACTIVITY', 'PRODUCT_LIST']);
  const productIds = [...new Set(modules.flatMap((m) => Array.isArray(m.productIds) ? m.productIds : []).map(Number))];
  if (modules.some((m) => !allowedTypes.has(m.type)) || productIds.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new BizError(Code.VALIDATE_ERROR, '首页模块参数不合法');
  }
  if (productIds.length > 100) throw new BizError(Code.VALIDATE_ERROR, '首页商品最多 100 个');
  if (productIds.length) {
    const ownedCount = await prisma.product.count({ where: { tenantId, id: { in: productIds } } });
    if (ownedCount !== productIds.length) throw new BizError(Code.FORBIDDEN, '首页包含非本俱乐部商品');
  }
  // 简单实现：启用一个默认布局并重建模块
  let layout = await prisma.homeLayout.findFirst({ where: { tenantId, isActive: true } });
  if (!layout) {
    layout = await prisma.homeLayout.create({ data: { tenantId, name: '默认布局', isActive: true } });
  }
  await prisma.$transaction(async (tx) => {
    // 先删模块关联商品（外键约束：homeProductModule.module_id → homeModule.id），再删模块
    const oldModules = await tx.homeModule.findMany({ where: { tenantId, layoutId: layout.id }, select: { id: true } });
    if (oldModules.length) {
      await tx.homeProductModule.deleteMany({ where: { moduleId: { in: oldModules.map((m) => m.id) } } });
    }
    await tx.homeModule.deleteMany({ where: { tenantId, layoutId: layout.id } });
    for (const [i, m] of (modules || []).entries()) {
      const created = await tx.homeModule.create({
        data: {
          tenantId,
          layoutId: layout.id,
          type: m.type,
          sortOrder: m.sortOrder ?? i,
          config: m.config || undefined,
        },
      });
      if (m.type === 'PRODUCT_LIST' && Array.isArray(m.productIds)) {
        await tx.homeProductModule.createMany({
          data: m.productIds.map((pid, j) => ({
            tenantId,
            moduleId: created.id,
            productId: pid,
            sortOrder: j,
          })),
        });
      }
    }
  });
  return getActiveLayout({ tenantId });
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getActiveLayout,
  saveLayout,
};
