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

    const {
      productId,
      startDate,
      endDate,
      quantity = 1,
      notes,
      deliveryOption = 'PICKUP',
      deliveryAddress,
      contactPhone,
    } = req.body;
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
    const rentalSubtotal = parseFloat(product.rentalPrice) * days * parseInt(quantity);
    const deliveryFee = deliveryOption === 'HOME_DELIVERY' ? 50.00 : 0.00;
    const totalPrice = rentalSubtotal + deliveryFee;

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
        deliveryOption: deliveryOption === 'HOME_DELIVERY' ? 'HOME_DELIVERY' : 'PICKUP',
        deliveryAddress: deliveryOption === 'HOME_DELIVERY' ? deliveryAddress : null,
        contactPhone: contactPhone || null,
        deliveryStatus: 'PENDING_APPROVAL',
        deliveryFee,
      },
      include: {
        product: { select: { name: true, imageUrl: true } },
        user: { select: { name: true, email: true } },
      },
    });

    // 🔔 Notify Customer
    await prisma.notification.create({
      data: {
        userId,
        title: `Order #${order.id} Placed Successfully`,
        message: `Your rental order for "${product.name}" has been submitted (${order.deliveryOption === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}). Awaiting approval.`,
        type: 'ORDER_PLACED',
        orderId: order.id,
      },
    });

    // 🔔 Notify Admins
    await prisma.notification.create({
      data: {
        role: 'ADMIN',
        title: `New Order #${order.id} Received`,
        message: `${order.user.name} placed order #${order.id} for "${product.name}" (Qty: ${order.quantity}, Total: ₹${order.totalPrice}). ${order.deliveryOption === 'HOME_DELIVERY' ? 'Home Delivery to: ' + (deliveryAddress || 'Address on file') : 'Store Pickup'}.`,
        type: 'ORDER_PLACED',
        orderId: order.id,
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
        data: {
          status,
          ...(status === 'APPROVED' && currentOrder.deliveryOption === 'HOME_DELIVERY' && currentOrder.deliveryStatus === 'PENDING_APPROVAL' ? { deliveryStatus: 'DELIVERY_APPROVED' } : {}),
        },
        include: {
          product: { select: { id: true, name: true, totalStock: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    // 🔔 Notify Customer about Status Change
    try {
      let clientTitle = `Order #${orderId} ${status}`;
      let clientMessage = `Your order for "${currentOrder.product.name}" is now ${status.toLowerCase()}.`;

      if (status === 'APPROVED') {
        clientTitle = `Order #${orderId} Approved!`;
        clientMessage = currentOrder.deliveryOption === 'HOME_DELIVERY'
          ? `Great news! Your order for "${currentOrder.product.name}" is approved. Home delivery is approved and being scheduled for dispatch.`
          : `Great news! Your order for "${currentOrder.product.name}" is approved and ready for pickup at our store.`;
      } else if (status === 'REJECTED') {
        clientTitle = `Order #${orderId} Declined`;
        clientMessage = `Your order for "${currentOrder.product.name}" could not be approved at this time.`;
      } else if (status === 'RETURNED') {
        clientTitle = `Order #${orderId} Completed`;
        clientMessage = `Your costume rental for "${currentOrder.product.name}" has been marked as returned. Thank you!`;
      }

      await prisma.notification.create({
        data: {
          userId: currentOrder.userId,
          title: clientTitle,
          message: clientMessage,
          type: 'ORDER_UPDATE',
          orderId,
        },
      });
    } catch (notifErr) {
      console.warn('Notification create warning:', notifErr.message);
    }

    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    if (err.message && err.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * PATCH /api/admin/orders/:id/delivery-status
 * Admin: Update delivery tracking status (DELIVERY_APPROVED, OUT_FOR_DELIVERY, DELIVERED)
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { deliveryStatus } = req.body;
    const validDeliveryStatuses = ['PENDING_APPROVAL', 'DELIVERY_APPROVED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

    if (!validDeliveryStatuses.includes(deliveryStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery status' });
    }

    const orderId = parseInt(req.params.id);
    const order = await prisma.rentalOrder.update({
      where: { id: orderId },
      data: { deliveryStatus },
      include: {
        product: { select: { id: true, name: true, totalStock: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const labels = {
      DELIVERY_APPROVED: 'Home Delivery Approved',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED: 'Delivered to Address',
      PENDING_APPROVAL: 'Delivery Pending Approval',
    };

    // 🔔 Notify Customer
    try {
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: `Delivery: ${labels[deliveryStatus]} (#${order.id})`,
          message: `Your costume order for "${order.product.name}" is now: ${labels[deliveryStatus]}.${order.deliveryAddress ? ' Address: ' + order.deliveryAddress : ''}`,
          type: 'DELIVERY_UPDATE',
          orderId: order.id,
        },
      });
    } catch (notifErr) {
      console.warn('Notification create warning:', notifErr.message);
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/dashboard
 * Admin: Get summary statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalProducts, totalOrders, pendingOrders, pendingDeliveries, totalUsers, revenueResult] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.rentalOrder.count(),
      prisma.rentalOrder.count({ where: { status: 'PENDING' } }),
      prisma.rentalOrder.count({ where: { deliveryOption: 'HOME_DELIVERY', deliveryStatus: 'PENDING_APPROVAL' } }),
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
        pendingDeliveries,
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
  updateDeliveryStatus,
  getDashboardStats,
};
