const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  triggerEmailReminder,
  sendDueRemindersBatch,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

// ─── External Email Reminders (Nodemailer Gmail SMTP) ─────────────────────────
// POST /api/notifications/reminders/send - Trigger an external email reminder for an order or user
router.post('/reminders/send', triggerEmailReminder);

// POST /api/notifications/reminders/batch-due - Batch process upcoming rental returns (Admins / Schedulers)
router.post('/reminders/batch-due', adminOnly, sendDueRemindersBatch);

module.exports = router;
