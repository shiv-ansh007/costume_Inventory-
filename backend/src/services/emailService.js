/**
 * ============================================================================
 * EMAIL SERVICE - GMAIL SMTP NOTIFICATION & REMINDER DISPATCHER
 * ============================================================================
 * Handles compiling clean text and responsive HTML email templates,
 * interfacing with existing notification and order data, and safely sending
 * reminders via Gmail SMTP without crashing server or scheduler processes.
 */

const { transporter, getDefaultFrom, DEFAULT_SENDER_EMAIL } = require('../config/mailer');

/**
 * Generate a responsive HTML template for costume rental reminders
 */
const generateReminderHtml = ({ recipientName, reminderType, message, orderDetails, dueDate }) => {
  const brandColor = '#4f46e5'; // Indigo
  const currentYear = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rental Reminder</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .wrapper { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background-color: ${brandColor}; padding: 24px 30px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
        .body-text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .card { background-color: #f1f5f9; border-left: 4px solid ${brandColor}; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
        .card-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .card-row:last-child { margin-bottom: 0; }
        .card-label { color: #64748b; font-weight: 500; }
        .card-value { color: #0f172a; font-weight: 600; }
        .due-badge { display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid #fde68a; margin-top: 8px; }
        .cta-btn { display: inline-block; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-align: center; }
        .footer { padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>🎭 Costume Rental Notification</h1>
        </div>
        <div class="content">
          <div class="greeting">Hello ${recipientName || 'Valued Customer'},</div>
          <div class="body-text">
            ${message || 'This is a friendly reminder regarding your costume rental order.'}
          </div>

          ${orderDetails
      ? `
              <div class="card">
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: #1e293b;">
                  📦 Order #${orderDetails.id || 'N/A'} Details
                </div>
                ${orderDetails.productName ? `<div class="card-row"><span class="card-label">Item:</span> <span class="card-value">${orderDetails.productName}</span></div>` : ''}
                ${orderDetails.quantity ? `<div class="card-row"><span class="card-label">Quantity:</span> <span class="card-value">${orderDetails.quantity}</span></div>` : ''}
                ${orderDetails.startDate ? `<div class="card-row"><span class="card-label">Start Date:</span> <span class="card-value">${orderDetails.startDate}</span></div>` : ''}
                ${orderDetails.endDate ? `<div class="card-row"><span class="card-label">Return Date:</span> <span class="card-value">${orderDetails.endDate}</span></div>` : ''}
                ${orderDetails.deliveryOption ? `<div class="card-row"><span class="card-label">Method:</span> <span class="card-value">${orderDetails.deliveryOption === 'HOME_DELIVERY' ? '🚚 Home Delivery' : '🏪 Store Pickup'}</span></div>` : ''}
                ${dueDate ? `<div style="margin-top: 10px;"><span class="due-badge">⚠️ Action Due: ${dueDate}</span></div>` : ''}
              </div>
            `
      : ''
    }

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-orders" class="cta-btn">View My Orders</a>
          </div>

          <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
            If you have any questions or need to extend your rental, please contact our support team.
          </div>
        </div>

        <div class="footer">
          &copy; ${currentYear} Costume Rental Store. Sent via Gmail SMTP Service.<br/>
          From: ${process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL}
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send an email reminder via Gmail SMTP
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.recipientName - Recipient full name
 * @param {string} [options.subject] - Email subject
 * @param {string} [options.reminderType] - 'RETURN_REMINDER' | 'ORDER_UPDATE' | 'DELIVERY_UPDATE'
 * @param {string} [options.message] - Custom reminder body text
 * @param {string} [options.dueDate] - Formatted due date string
 * @param {Object} [options.orderDetails] - Object containing order details (id, productName, etc.)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendReminderEmail = async ({
  to,
  recipientName,
  subject,
  reminderType = 'RETURN_REMINDER',
  message,
  dueDate,
  orderDetails,
}) => {
  // Validate recipient email
  if (!to || !to.includes('@')) {
    const errorMsg = `[EmailService] Invalid recipient email address: "${to}"`;
    console.warn(errorMsg);
    return { success: false, error: errorMsg };
  }

  // Construct dynamic subject line
  const emailSubject =
    subject ||
    (reminderType === 'RETURN_REMINDER'
      ? `⏰ Reminder: Costume Return Due ${dueDate ? 'on ' + dueDate : 'Soon'}`
      : reminderType === 'DELIVERY_UPDATE'
        ? `🚚 Update on Your Costume Delivery #${orderDetails?.id || ''}`
        : `🎭 Costume Rental Update: Order #${orderDetails?.id || ''}`);

  // Build plain text fallback
  const textContent = `
Hello ${recipientName || 'Customer'},

${message || 'This is a friendly reminder regarding your costume rental.'}

${orderDetails
      ? `Order Details:
- Order ID: #${orderDetails.id || 'N/A'}
- Item: ${orderDetails.productName || 'Costume'}
- Quantity: ${orderDetails.quantity || 1}
- Rental Period: ${orderDetails.startDate || ''} to ${orderDetails.endDate || ''}
${dueDate ? `- Return Due: ${dueDate}` : ''}
`
      : ''
    }

You can view your order at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-orders

Best regards,
Costume Rental Team
Sender: ${process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL}
  `.trim();

  // Build responsive HTML template
  const htmlContent = generateReminderHtml({
    recipientName,
    reminderType,
    message,
    orderDetails,
    dueDate,
  });

  // Safe dispatch with comprehensive error handling to protect the server
  try {
    const mailOptions = {
      from: getDefaultFrom(),
      to,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Reminder email successfully dispatched to ${to} (MessageId: ${info.messageId})`);

    return {
      success: true,
      messageId: info.messageId,
      recipient: to,
    };
  } catch (smtpError) {
    // Graceful error capture: Log details without crashing the node process
    console.error(`[EmailService Error] Failed to send email reminder via Gmail SMTP to ${to}:`, smtpError.message);

    return {
      success: false,
      error: smtpError.message,
      recipient: to,
    };
  }
};

/**
 * ============================================================================
 * SEND ORDER APPROVAL EMAIL
 * ============================================================================
 * Triggered automatically when an Admin approves an order.
 * Sends booking confirmation, rental dates, delivery method, and total amount.
 */
const sendOrderApprovalEmail = async (order) => {
  if (!order || !order.user || !order.user.email) {
    console.warn('[EmailService] Cannot send approval email: Missing order user email');
    return { success: false, error: 'Missing user email' };
  }

  const to = order.user.email;
  const recipientName = order.user.name || 'Valued Customer';
  const isHomeDelivery = order.deliveryOption === 'HOME_DELIVERY';
  const fmtStart = new Date(order.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtEnd = new Date(order.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const subject = `🎉 Order Approved! #${order.id} - ${order.product.name}`;

  const message = isHomeDelivery
    ? `Great news! Your costume rental request has been approved by the store manager. Home delivery has been approved and is being prepared for dispatch to your address.`
    : `Great news! Your costume rental request has been approved by the store manager. Your costume is reserved and will be ready for pickup on ${fmtStart} at our store.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Order Approved</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .wrapper { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 26px 30px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .badge { display: inline-block; background-color: rgba(255,255,255,0.25); color: #ffffff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-top: 6px; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
        .body-text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 22px; }
        .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; padding: 18px; border-radius: 8px; margin-bottom: 24px; }
        .card-title { font-weight: 700; font-size: 15px; color: #0f172a; margin-bottom: 12px; }
        .row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
        .row:last-child { border-bottom: none; }
        .label { color: #64748b; font-weight: 500; }
        .val { color: #0f172a; font-weight: 600; }
        .cta-btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; }
        .footer { padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>✅ Order Approved!</h1>
          <div class="badge">Booking Confirmed · Order #${order.id}</div>
        </div>
        <div class="content">
          <div class="greeting">Hi ${recipientName},</div>
          <div class="body-text">${message}</div>

          <div class="card">
            <div class="card-title">📦 Order Summary</div>
            <div class="row"><span class="label">Item:</span> <span class="val">${order.product.name}</span></div>
            <div class="row"><span class="label">Quantity:</span> <span class="val">${order.quantity} unit(s)</span></div>
            <div class="row"><span class="label">Rental Duration:</span> <span class="val">${fmtStart} → ${fmtEnd}</span></div>
            <div class="row"><span class="label">Delivery Option:</span> <span class="val">${isHomeDelivery ? '🚚 Home Delivery (+₹50)' : '🏪 Store Pickup'}</span></div>
            ${order.deliveryAddress ? `<div class="row"><span class="label">Address:</span> <span class="val">${order.deliveryAddress}</span></div>` : ''}
            <div class="row"><span class="label">Total Amount:</span> <span class="val" style="color:#059669; font-size:14px;">₹${Number(order.totalPrice).toFixed(0)}</span></div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-orders" class="cta-btn">View My Orders</a>
          </div>

          <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
            Thank you for booking with us! Please reach out if you have any questions before pickup or delivery.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Costume Rental Store<br/>
          From: ${process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL}
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${recipientName},

${message}

Order Summary:
- Order ID: #${order.id}
- Item: ${order.product.name}
- Quantity: ${order.quantity}
- Rental Period: ${fmtStart} to ${fmtEnd}
- Delivery Option: ${isHomeDelivery ? 'Home Delivery' : 'Store Pickup'}
${order.deliveryAddress ? `- Address: ${order.deliveryAddress}` : ''}
- Total Price: ₹${Number(order.totalPrice).toFixed(0)}

View your order: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-orders

Best regards,
Costume Rental Team
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: getDefaultFrom(),
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[EmailService] ✅ Order approval email sent to ${to} (MessageId: ${info.messageId})`);
    if (previewUrl) {
      console.log(`[EmailService] 🔗 View Approval Email Online: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null,
      recipient: to,
    };
  } catch (err) {
    console.error(`[EmailService Error] Failed to send approval email to ${to}:`, err.message);
    return {
      success: false,
      error: err.message,
      recipient: to,
    };
  }
};

module.exports = {
  sendReminderEmail,
  sendOrderApprovalEmail,
  generateReminderHtml,
};
