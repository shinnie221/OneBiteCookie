import nodemailer from 'nodemailer';

/**
 * Sends an email notification to a new or existing customer.
 * Uses Gmail SMTP if credentials (GMAIL_USER and GMAIL_APP_PASSWORD or SMTP_USER/SMTP_PASS) are provided.
 * Falls back to logging gracefully if credentials are not yet configured in .env.local.
 */
export async function sendOrderNotificationEmail({ to, customerName, orderId, orderTotal, items, isNewCustomer = false }) {
  if (!to || !to.includes('@')) {
    console.log(`[Email] Skipping email - invalid address: ${to}`);
    return { success: false, reason: 'Invalid email' };
  }

  const user = process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS;

  const itemsListHtml = items && items.length > 0
    ? items.map(item => `<li style="margin-bottom: 6px;"><strong>${item.quantity}x</strong> ${item.product_name} — RM${(Number(item.price) * item.quantity).toFixed(2)}</li>`).join('')
    : '<li>Custom Cookie Order</li>';

  const welcomeBanner = isNewCustomer
    ? `<div style="background: #fdfaf6; border-left: 4px solid #a0714f; padding: 14px 18px; margin-bottom: 20px; border-radius: 6px;">
        <h3 style="margin: 0 0 6px 0; color: #a0714f; font-size: 16px;">Welcome to One Bite Cookie! 🎉</h3>
        <p style="margin: 0; color: #555; font-size: 14px;">A customer account has been automatically created for you. You can sign in anytime using your Google account with this email address (<strong>${to}</strong>) to view your full order history.</p>
       </div>`
    : '';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
      <div style="background: #a0714f; padding: 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">🍪 One Bite Cookie</h1>
        <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Your order has been recorded!</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 16px;">Hi <strong>${customerName || 'Cookie Lover'}</strong>,</p>
        <p>Thank you for choosing One Bite! Your order has been placed successfully by our team.</p>

        ${welcomeBanner}

        <div style="background: #f9f9f9; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #777;">Order Reference:</p>
          <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; font-family: monospace; color: #a0714f;">#${orderId}</p>

          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #444;">Items Ordered:</p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #555; font-size: 14px;">
            ${itemsListHtml}
          </ul>

          <div style="border-top: 1px dashed #ddd; padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #222;">
            <span>Total Amount:</span>
            <span style="color: #a0714f;">RM${Number(orderTotal).toFixed(2)}</span>
          </div>
        </div>

        <p style="font-size: 14px; color: #666;">
          If you have any questions or need to make changes, please contact us on WhatsApp at <strong>011-10897061</strong>.
        </p>
      </div>

      <div style="background: #f4f4f4; padding: 16px; text-align: center; font-size: 12px; color: #888;">
        © One Bite Cookie Shop. Freshly baked every day.
      </div>
    </div>
  `;

  if (user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from: `"One Bite Cookie" <${user}>`,
        to,
        subject: `🍪 Order Confirmation #${orderId} - One Bite Cookie`,
        html: htmlContent
      });

      console.log(`[Email] Successfully sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] Error sending email via SMTP:', err);
      return { success: false, error: err.message };
    }
  } else {
    // If SMTP credentials not provided in .env yet, log the receipt gracefully
    console.log(`[Email Notice] GMAIL_USER / GMAIL_APP_PASSWORD not set in .env.local. Simulated email to: ${to} for order #${orderId}`);
    return { success: true, simulated: true };
  }
}
