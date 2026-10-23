const express = require('express');
const { body } = require('express-validator');
const { protect, adminOnly } = require('../middleware/auth');
const {
  createRentalRequest,
  getMyOrders,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updateDeliveryStatus,
  getDashboardStats,
} = require('../controllers/rentalController');

const router = express.Router();

// ─── Client Routes ────────────────────────────────────────────────────────────
// POST /api/rentals/request
router.post(
  '/request',
  protect,
  [
    body('productId').isInt({ min: 1 }).withMessage('Valid product ID is required'),
    body('startDate').isISO8601().withMessage('Valid start date required (YYYY-MM-DD)'),
    body('endDate').isISO8601().withMessage('Valid end date required (YYYY-MM-DD)'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  ],
  createRentalRequest
);

// GET /api/rentals/my-orders
router.get('/my-orders', protect, getMyOrders);

// DELETE /api/rentals/:id
router.delete('/:id', protect, cancelOrder);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// GET /api/rentals/admin/dashboard
router.get('/admin/dashboard', protect, adminOnly, getDashboardStats);

// GET /api/rentals/admin/orders
router.get('/admin/orders', protect, adminOnly, getAllOrders);

// PATCH /api/rentals/admin/orders/:id/status
router.patch('/admin/orders/:id/status', protect, adminOnly, updateOrderStatus);

// PATCH /api/rentals/admin/orders/:id/delivery-status
router.patch('/admin/orders/:id/delivery-status', protect, adminOnly, updateDeliveryStatus);

module.exports = router;
