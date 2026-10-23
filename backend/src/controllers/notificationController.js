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

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
