const prisma = require('../config/prisma');

/**
 * GET /api/notifications
 * Get user's notifications (including role-based notifications for ADMIN)
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const where = {
      OR: [
        { userId: userId },
        ...(role === 'ADMIN' ? [{ role: 'ADMIN' }] : []),
      ],
    };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        isRead: false,
      },
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const count = await prisma.notification.count({
      where: {
        OR: [
          { userId: userId },
          ...(role === 'ADMIN' ? [{ role: 'ADMIN' }] : []),
        ],
        isRead: false,
      },
    });

    res.json({ success: true, unreadCount: count });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark single notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

const { sendReminderEmail } = require('../services/emailService');

/**
 * PATCH /api/notifications/read-all
 * Mark all user's notifications as read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    await prisma.notification.updateMany({
      where: {
        OR: [
          { userId: userId },
          ...(role === 'ADMIN' ? [{ role: 'ADMIN' }] : []),
        ],
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

/**
 * ============================================================================
 * POST /api/notifications/reminders/send
 * Trigger an external email reminder via Gmail SMTP (Nodemailer)
 * ============================================================================
 * Supports triggering reminders either:
 *  1) By orderId (automatically fetches customer email, name, costume dates, creates in-app notification)
 *  2) By direct parameters (recipientEmail, recipientName, message, dueDate)
 * 
 * Includes proper try/catch blocks so SMTP errors are gracefully caught,
 * logged to the system logs, and returned with a failure state without crashing.
 */
const triggerEmailReminder = async (req, res, next) => {
  try {
    const {
      orderId,
      recipientEmail,
      recipientName,
      subject,
      reminderType = 'RETURN_REMINDER',
      customMessage,
      dueDate,
    } = req.body;

    let targetEmail = recipientEmail;
    let targetName = recipientName;
    let orderDetails = null;
    let notificationRecord = null;
    let finalDueDate = dueDate;

    // ── 1. If orderId is provided, pull customer and order info from database ──
    if (orderId) {
      const order = await prisma.rentalOrder.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true } },
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: `Rental order #${orderId} not found` });
      }

      targetEmail = order.user.email;
      targetName = order.user.name;
      finalDueDate = order.endDate ? new Date(order.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : dueDate;

      orderDetails = {
        id: order.id,
        productName: order.product.name,
        quantity: order.quantity,
        startDate: new Date(order.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        endDate: finalDueDate,
        deliveryOption: order.deliveryOption,
      };

      // ── 2. Create in-app notification record in existing Notification system ──
      try {
        notificationRecord = await prisma.notification.create({
          data: {
            userId: order.user.id,
            title: `Costume Return Reminder (Order #${order.id})`,
            message: customMessage || `Friendly reminder: Your rental for "${order.product.name}" is due for return by ${finalDueDate}.`,
            type: 'RETURN_REMINDER',
            orderId: order.id,
          },
        });
      } catch (dbErr) {
        console.warn(`[Notification Warning] Could not persist in-app notification: ${dbErr.message}`);
      }
    }

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email is required (or provide a valid orderId).',
      });
    }

    // ── 3. Dispatch external email reminder via Nodemailer / Gmail SMTP ──
    const emailResult = await sendReminderEmail({
      to: targetEmail,
      recipientName: targetName,
      subject,
      reminderType,
      message: customMessage,
      dueDate: finalDueDate,
      orderDetails,
    });

    if (!emailResult.success) {
      // SMTP delivery encountered an issue (e.g. invalid credentials or network issue)
      console.error(`[SMTP Log: FAILED] Reminder dispatch failed for ${targetEmail}: ${emailResult.error}`);

      return res.status(502).json({
        success: false,
        message: 'Failed to dispatch external email reminder via Gmail SMTP. In-app notification was recorded if applicable.',
        error: emailResult.error,
        notificationId: notificationRecord ? notificationRecord.id : null,
      });
    }

    // ── 4. Success response ──
    console.log(`[SMTP Log: SUCCESS] Reminder delivered to ${targetEmail} (MessageId: ${emailResult.messageId})`);

    return res.status(200).json({
      success: true,
      message: `Email reminder dispatched successfully to ${targetEmail}`,
      messageId: emailResult.messageId,
      notificationId: notificationRecord ? notificationRecord.id : null,
      orderDetails,
    });
  } catch (err) {
    console.error('[Notification Controller] Unexpected error in triggerEmailReminder:', err);
    next(err);
  }
};

/**
 * ============================================================================
 * BATCH REMINDER PROCESSOR (For Schedulers / Cron Jobs)
 * ============================================================================
 * Finds all active rental orders due within the next 24-48 hours
 * and dispatches email return reminders to each customer.
 */
const sendDueRemindersBatch = async (req, res, next) => {
  try {
    const now = new Date();
    const inTwoDays = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Find orders that are APPROVED and ending in the next 48 hours
    const dueOrders = await prisma.rentalOrder.findMany({
      where: {
        status: 'APPROVED',
        endDate: {
          gte: now,
          lte: inTwoDays,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { name: true } },
      },
    });

    const results = [];

    for (const order of dueOrders) {
      const formattedDue = new Date(order.endDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const emailResult = await sendReminderEmail({
        to: order.user.email,
        recipientName: order.user.name,
        reminderType: 'RETURN_REMINDER',
        dueDate: formattedDue,
        orderDetails: {
          id: order.id,
          productName: order.product.name,
          quantity: order.quantity,
          endDate: formattedDue,
          deliveryOption: order.deliveryOption,
        },
        message: `Friendly reminder that your rental for "${order.product.name}" is scheduled for return on ${formattedDue}. Please ensure the item is packaged and ready for return or pickup.`,
      });

      results.push({
        orderId: order.id,
        recipient: order.user.email,
        success: emailResult.success,
        error: emailResult.error || null,
      });
    }

    res.json({
      success: true,
      processedCount: dueOrders.length,
      results,
    });
  } catch (err) {
    console.error('[Notification Controller] Error in sendDueRemindersBatch:', err);
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  triggerEmailReminder,
  sendDueRemindersBatch,
};

