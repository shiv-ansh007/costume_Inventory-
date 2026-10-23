const prisma = require('../config/prisma');
const { cloudinary } = require('../config/cloudinary');
const { validationResult } = require('express-validator');

/**
 * GET /api/products
 * Public: List all active products with optional filters
 */
const getProducts = async (req, res, next) => {
  try {
    const { type, category, search, page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (type) where.type = type;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 * Public: Get single product by ID
 */
const getProductById = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id/availability
 * Public: Check available stock for a given date range
 */
const checkAvailability = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const productId = parseInt(req.params.id);

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'endDate must be after startDate' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Sum quantities of PENDING orders that overlap with the requested date range
    // Note: APPROVED orders have already decremented product.totalStock
    const overlappingOrders = await prisma.rentalOrder.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        status: 'PENDING',
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    const bookedQty = overlappingOrders._sum.quantity || 0;
    const availableQty = Math.max(0, product.totalStock - bookedQty);

    // Calculate rental days and price estimate
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const priceEstimate = product.rentalPrice
      ? parseFloat(product.rentalPrice) * days
      : null;

    res.json({
      success: true,
      data: {
        productId,
        totalStock: product.totalStock,
        bookedQuantity: bookedQty,
        availableQuantity: availableQty,
        isAvailable: availableQty > 0,
        rentalDays: days,
        priceEstimate,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/products
 * Admin: Create a new product (with optional image upload)
 */
const createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, description, type, rentalPrice, salePrice, totalStock, category, imageUrl: bodyImageUrl } = req.body;

    let imageUrl = bodyImageUrl || null;
    let imagePublicId = null;
    if (req.file) {
      imageUrl = req.file.path;
      imagePublicId = req.file.filename;
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        type: type || 'RENT',
        rentalPrice: rentalPrice ? parseFloat(rentalPrice) : null,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        totalStock: parseInt(totalStock) || 1,
        category,
        imageUrl,
        imagePublicId,
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/products/:id
 * Admin: Update a product
 */
const updateProduct = async (req, res, next) => {
  try {
    const { name, description, type, rentalPrice, salePrice, totalStock, category, isActive } = req.body;
    const productId = parseInt(req.params.id);

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let imageUrl = existing.imageUrl;
    let imagePublicId = existing.imagePublicId;

    if (req.file) {
      // Delete old image from Cloudinary
      if (existing.imagePublicId) {
        await cloudinary.uploader.destroy(existing.imagePublicId);
      }
      imageUrl = req.file.path;
      imagePublicId = req.file.filename;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(rentalPrice !== undefined && { rentalPrice: rentalPrice ? parseFloat(rentalPrice) : null }),
        ...(salePrice !== undefined && { salePrice: salePrice ? parseFloat(salePrice) : null }),
        ...(totalStock !== undefined && { totalStock: parseInt(totalStock) }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
        imageUrl,
        imagePublicId,
      },
    });

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/products/:id
 * Admin: Soft-delete a product (set isActive = false)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Product deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/products
 * Admin: Get all products including inactive
 */
const getAllProductsAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({ skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.product.count(),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProductById,
  checkAvailability,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProductsAdmin,
};
