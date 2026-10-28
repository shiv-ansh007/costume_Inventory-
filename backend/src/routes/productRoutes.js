const express = require('express');
const { body } = require('express-validator');
const { protect, adminOnly } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getProducts,
  getCategories,
  getProductById,
  checkAvailability,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getAllProductsAdmin,
} = require('../controllers/productController');

const router = express.Router();

const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('type').optional().isIn(['RENT', 'SALE', 'BOTH']).withMessage('Invalid product type'),
  body('rentalPrice').optional().isFloat({ min: 0 }).withMessage('Rental price must be a positive number'),
  body('salePrice').optional().isFloat({ min: 0 }).withMessage('Sale price must be a positive number'),
  body('totalStock').optional().isInt({ min: 1 }).withMessage('Total stock must be at least 1'),
];

// ─── Public Routes ────────────────────────────────────────────────────────────
// GET /api/products
router.get('/', getProducts);

// GET /api/products/categories
router.get('/categories', getCategories);

// GET /api/products/:id
router.get('/:id', getProductById);

// GET /api/products/:id/availability?startDate=&endDate=
router.get('/:id/availability', checkAvailability);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// GET /api/products/admin/all
router.get('/admin/all', protect, adminOnly, getAllProductsAdmin);

// POST /api/products/admin
router.post('/admin', protect, adminOnly, upload.single('image'), productValidation, createProduct);

// PUT /api/products/admin/:id
router.put('/admin/:id', protect, adminOnly, upload.single('image'), updateProduct);

// PATCH /api/products/admin/:id/status (and PUT)
router.patch('/admin/:id/status', protect, adminOnly, toggleProductStatus);
router.put('/admin/:id/status', protect, adminOnly, toggleProductStatus);

// DELETE /api/products/admin/:id
router.delete('/admin/:id', protect, adminOnly, deleteProduct);

module.exports = router;
