const prisma = require('../config/prisma');
const { validationResult } = require('express-validator');

/**
 * POST /api/rentals/request
 * Client: Submit a new rental request
 */
const createRentalRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { productId, startDate, endDate, quantity = 1, notes } = req.body;
    const userId = req.user.id;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'endDate must be after startDate' });
    }

    if (start < new Date()) {
      return res.status(400).json({ success: false, message: 'startDate cannot be in the past' });
    }

    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    if (product.type === 'SALE') {
      return res.status(400).json({ success: false, message: 'This item is for sale only, not rental' });
    }

    if (!product.rentalPrice) {
      return res.status(400).json({ success: false, message: 'Product has no rental price set' });
    }

    // Check availability against current stock and overlapping PENDING requests
    const overlappingPending = await prisma.rentalOrder.aggregate({
      _sum: { quantity: true },
      where: {
        productId: parseInt(productId),
        status: 'PENDING',
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    const pendingQty = overlappingPending._sum.quantity || 0;
    const availableQty = Math.max(0, product.totalStock - pendingQty);

    if (product.totalStock < parseInt(quantity) || availableQty < parseInt(quantity)) {
      return res.status(409).json({
        success: false,
        message: `Only ${availableQty} unit(s) available for the selected dates`,
        availableQuantity: availableQty,
      });
    }

    // Calculate price
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalPrice = parseFloat(product.rentalPrice) * days * parseInt(quantity);

    const order = await prisma.rentalOrder.create({
      data: {
        userId,
        productId: parseInt(productId),
        startDate: start,
        endDate: end,
        quantity: parseInt(quantity),
        totalPrice,
        notes,
        status: 'PENDING',
      },
      include: {
        product: { select: { name: true, imageUrl: true } },
        user: { select: { name: true, email: true } },
      },
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rentals/my-orders
 * Client: Get current user's rental orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await prisma.rentalOrder.findMany({
      where: { userId: req.user.id },
      include: {
        product: { select: { id: true, name: true, imageUrl: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/rentals/:id
 * Client or Admin: Cancel a rental order (restores stock if was approved)
 */
const cancelOrder = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await prisma.rentalOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.status === 'CANCELLED' || order.status === 'RETURNED' || order.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: `Order is already ${order.status.toLowerCase()}` });
    }

    await prisma.$transaction(async (tx) => {
      // If order was approved, restore the product's available stock
      if (order.status === 'APPROVED') {
        await tx.product.update({
          where: { id: order.productId },
          data: { totalStock: { increment: order.quantity } },
        });
      }

      await tx.rentalOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
    });

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Admin Controllers ────────────────────────────────────────────────────────

/**
 * GET /api/admin/orders
 * Admin: Get all rental orders with filters
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rentalOrder.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/orders/:id/status
 * Admin: Approve, reject, or mark order as returned
 * Automatically decrements product stock when approved, and restores stock when returned/rejected.
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['APPROVED', 'REJECTED', 'RETURNED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const orderId = parseInt(req.params.id);
    const currentOrder = await prisma.rentalOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If status is not changing, return current order
    if (currentOrder.status === status) {
      return res.json({ success: true, data: currentOrder });
    }

    const previousStatus = currentOrder.status;

    // Execute status transition and stock update inside an atomic transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Transitioning TO 'APPROVED': deduct stock
      if (status === 'APPROVED' && previousStatus !== 'APPROVED') {
        const freshProduct = await tx.product.findUnique({
          where: { id: currentOrder.productId },
        });

        if (!freshProduct || freshProduct.totalStock < currentOrder.quantity) {
          throw new Error(
            `Insufficient stock to approve order: only ${freshProduct ? freshProduct.totalStock : 0} in stock, but order requested ${currentOrder.quantity}`
          );
        }

        await tx.product.update({
          where: { id: currentOrder.productId },
          data: { totalStock: { decrement: currentOrder.quantity } },
        });
      }

      // 2. Transitioning FROM 'APPROVED' to 'RETURNED' or 'REJECTED': restore stock
      if (previousStatus === 'APPROVED' && (status === 'RETURNED' || status === 'REJECTED')) {
        await tx.product.update({
          where: { id: currentOrder.productId },
          data: { totalStock: { increment: currentOrder.quantity } },
        });
      }

      // Update the rental order status
      return await tx.rentalOrder.update({
        where: { id: orderId },
        data: { status },
        include: {
          product: { select: { id: true, name: true, totalStock: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    if (err.message && err.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/admin/dashboard
 * Admin: Get summary statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalProducts, totalOrders, pendingOrders, totalUsers, revenueResult] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.rentalOrder.count(),
      prisma.rentalOrder.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.rentalOrder.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'APPROVED' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        totalOrders,
        pendingOrders,
        totalUsers,
        totalRevenue: revenueResult._sum.totalPrice || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRentalRequest,
  getMyOrders,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getDashboardStats,
};
