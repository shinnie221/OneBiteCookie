import nodemailer from 'nodemailer';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Returns a configured nodemailer transporter or null if SMTP credentials are missing.
 */
function getTransporter() {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;

  if (!user || !pass) return null;

  if (host) {
    return {
      transporter: nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: { user, pass }
      }),
      user
    };
  }

  return {
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    }),
    user
  };
}

/**
 * Gathers staff & admin recipient emails for new order alerts.
 * Priority order:
 * 1. Environment variables (STAFF_NOTIFICATION_EMAILS / STAFF_EMAIL / ADMIN_EMAIL)
 * 2. Settings document (settings/store_settings -> staff_notification_email, shop_email)
 * 3. Firestore users with role 'admin' or 'staff'
 * 4. Fallback admin emails
 */
export async function getStaffNotificationRecipients(db) {
  const recipients = new Set();

  // 1. Environment variable overrides
  const envEmails = process.env.STAFF_NOTIFICATION_EMAILS || process.env.STAFF_EMAIL || process.env.ADMIN_EMAIL;
  if (envEmails) {
    envEmails.split(',').forEach(e => {
      const trimmed = e.trim().toLowerCase();
      if (trimmed.includes('@')) recipients.add(trimmed);
    });
  }

  // 2. Settings in Firestore (store_settings)
  if (db) {
    try {
      const docRef = doc(db, 'settings', 'store_settings');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.staff_notification_email) {
          data.staff_notification_email.split(',').forEach(e => {
            const trimmed = e.trim().toLowerCase();
            if (trimmed.includes('@')) recipients.add(trimmed);
          });
        }
        if (data.shop_email && data.shop_email.includes('@')) {
          recipients.add(data.shop_email.trim().toLowerCase());
        }
      }
    } catch (err) {
      console.warn('[Email] Could not load staff emails from store_settings:', err.message);
    }
  }

  // 3. Firestore registered admins/staff
  if (db) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', 'in', ['admin', 'staff']));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const u = d.data();
        if (u.email && u.email.includes('@')) {
          recipients.add(u.email.trim().toLowerCase());
        }
      });
    } catch (err) {
      console.warn('[Email] Could not load admin/staff users from Firestore:', err.message);
    }
  }

  // 4. Default fallback admin emails
  if (recipients.size === 0) {
    ['shinniecheng221@gmail.com', 'yunxuanhuang60@gmail.com'].forEach(e => recipients.add(e));
  }

  return Array.from(recipients);
}

/**
 * Sends an email notification to a customer when their order is placed.
 */
export async function sendOrderNotificationEmail({ to, customerName, orderId, orderTotal, items, isNewCustomer = false }) {
  if (!to || !to.includes('@')) {
    console.log(`[Email] Skipping customer email - invalid address: ${to}`);
    return { success: false, reason: 'Invalid email' };
  }

  const transportData = getTransporter();

  const itemsListHtml = items && items.length > 0
    ? items.map(item => `<li style="margin-bottom: 6px;"><strong>${item.quantity}x</strong> ${item.product_name || item.name} — RM${(Number(item.price || 0) * item.quantity).toFixed(2)}</li>`).join('')
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

  if (transportData) {
    try {
      const info = await transportData.transporter.sendMail({
        from: `"One Bite Cookie" <${transportData.user}>`,
        to,
        subject: `🍪 Order Confirmation #${orderId} - One Bite Cookie`,
        html: htmlContent
      });

      console.log(`[Email] Customer order email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] Error sending customer email via SMTP:', err);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Email Notice] GMAIL_USER / GMAIL_APP_PASSWORD not set in .env.local. Simulated customer email to: ${to} for order #${orderId}`);
    return { success: true, simulated: true };
  }
}

/**
 * Sends a notification email to staff members when a new order comes in.
 */
export async function sendStaffOrderNotificationEmail({ order, recipients = null, db = null, appUrl = null }) {
  if (!order || !order.order_id) {
    console.warn('[Staff Email] No order data provided');
    return { success: false, reason: 'No order data' };
  }

  // Resolve staff recipients
  let targetRecipients = Array.isArray(recipients) && recipients.length > 0 ? recipients : null;
  if (!targetRecipients) {
    targetRecipients = await getStaffNotificationRecipients(db);
  }

  if (!targetRecipients || targetRecipients.length === 0) {
    console.log('[Staff Email] No staff recipients configured or found.');
    return { success: false, reason: 'No recipients' };
  }

  const {
    order_id,
    customer_name = '匿名顾客',
    phone = '-',
    email = '',
    order_type = 'pickup',
    address = '',
    pickup_time = '',
    delivery_state = '',
    delivery_method = '',
    subtotal = 0,
    discount = 0,
    delivery_fee = 0,
    total = 0,
    voucher_code = '',
    items = [],
    payment_method = 'qr_transfer',
    payment_status = 'pending',
    payment_screenshot = null,
    staff_note = '',
    is_manual_order = false,
    created_at = new Date().toISOString()
  } = order;

  // Formatting date/time in Malaysia timezone
  let formattedTime = created_at;
  try {
    formattedTime = new Date(created_at).toLocaleString('zh-CN', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    // fallback
  }

  // Base URL for staff portal link
  const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'https://onebitecookie.com';
  const staffOrderUrl = `${baseUrl.replace(/\/$/, '')}/staff/orders`;

  // Clean phone number for WhatsApp link
  const rawDigits = phone.replace(/[^0-9]/g, '');
  let whatsappNumber = rawDigits;
  if (rawDigits.startsWith('0')) {
    whatsappNumber = '60' + rawDigits.slice(1);
  } else if (!rawDigits.startsWith('60') && rawDigits.length > 8) {
    whatsappNumber = '60' + rawDigits;
  }
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;

  // Build items rows
  const itemsHtml = items && items.length > 0
    ? items.map(item => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-weight: 600; color: #1e293b;">
          ${item.product_name || item.name || '曲奇品项'}
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 700; color: #0f172a;">
          x${item.quantity || 1}
        </td>
        <td style="padding: 10px 8px; text-align: right; color: #64748b;">
          RM${Number(item.price || 0).toFixed(2)}
        </td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #a0714f;">
          RM${(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">暂无具体明细</td></tr>`;

  // Badges
  const channelBadge = is_manual_order
    ? `<span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">📝 后台手工录单</span>`
    : `<span style="background: #ecfdf5; color: #047857; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">🛒 官网在线新订单</span>`;

  const typeBadge = order_type === 'delivery'
    ? `<span style="background: #eff6ff; color: #1d4ed8; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">🚗 送货上门 (${delivery_method || '标准配送'})</span>`
    : `<span style="background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">🏬 店内自取 (Pickup)</span>`;

  const paymentStatusBadge = payment_status === 'verified'
    ? `<span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">✅ 已完成付款</span>`
    : `<span style="background: #fef9c3; color: #a16207; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">⏳ 待核对款项 (Pending)</span>`;

  // Screenshot section
  const screenshotSection = payment_screenshot
    ? `<div style="margin-top: 18px; padding: 14px; background: #fffbeb; border: 1px dashed #f59e0b; border-radius: 8px; text-align: center;">
         <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #b45309;">📷 顾客已上传付款转账截图：</p>
         <a href="${payment_screenshot}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #d97706; color: #ffffff; text-decoration: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;">
           查看原图凭证 ↗
         </a>
       </div>`
    : '';

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; line-height: 1.5;">
      
      <!-- Brand Header -->
      <div style="background: linear-gradient(135deg, #a0714f 0%, #784c28 100%); padding: 24px 28px; color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.9; font-weight: 600;">🔔 新订单提醒 (Staff Order Alert)</span>
          <span style="font-size: 12px; opacity: 0.85;">${formattedTime}</span>
        </div>
        <h1 style="margin: 4px 0 8px; font-size: 22px; font-weight: 700; color: #ffffff;">
          收到新订单 #${order_id}
        </h1>
        <div style="font-size: 15px; opacity: 0.95;">
          订单金额: <strong style="color: #fef08a; font-size: 18px;">RM${Number(total).toFixed(2)}</strong> &nbsp;|&nbsp; 顾客: <strong>${customer_name}</strong>
        </div>
      </div>

      <div style="padding: 24px 28px;">
        <!-- Tag badges row -->
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
          ${channelBadge}
          ${typeBadge}
          ${paymentStatusBadge}
        </div>

        <!-- Customer & Delivery Information Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 22px;">
          <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
            👤 顾客与配送详情
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 5px 0; color: #64748b; width: 90px; vertical-align: top;">顾客姓名:</td>
              <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${customer_name}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">联系电话:</td>
              <td style="padding: 5px 0;">
                <a href="tel:${phone}" style="color: #2563eb; font-weight: 600; text-decoration: none;">${phone}</a>
                ${whatsappUrl ? `
                  <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" style="margin-left: 10px; background: #25d366; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-decoration: none; font-weight: 600;">
                    💬 WhatsApp 联系
                  </a>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">顾客邮箱:</td>
              <td style="padding: 5px 0; color: #334155;">${email || '未提供'}</td>
            </tr>
            ${order_type === 'delivery' ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">配送地址:</td>
              <td style="padding: 5px 0; font-weight: 500; color: #0f172a;">
                ${address || '未填写地址'} ${delivery_state ? `<span style="color: #64748b;">(${delivery_state})</span>` : ''}
              </td>
            </tr>
            ` : `
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">取件时间:</td>
              <td style="padding: 5px 0; font-weight: 600; color: #a0714f;">${pickup_time || '标准营业时间自取'}</td>
            </tr>
            `}
            ${staff_note ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">订单备注:</td>
              <td style="padding: 5px 0; color: #b45309; font-style: italic;">${staff_note}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Items Ordered Table -->
        <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #0f172a;">
          🍪 订购商品明细
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 12px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 13px;">
              <th style="padding: 8px 8px; text-align: left;">商品品项</th>
              <th style="padding: 8px 8px; text-align: center;">数量</th>
              <th style="padding: 8px 8px; text-align: right;">单价</th>
              <th style="padding: 8px 8px; text-align: right;">小计</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Amount Summary -->
        <div style="background: #fdfaf6; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 6px;">
            <span>商品小计 (Subtotal):</span>
            <span>RM${Number(subtotal).toFixed(2)}</span>
          </div>
          ${Number(discount) > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-bottom: 6px;">
            <span>折扣减免 ${voucher_code ? `(${voucher_code})` : ''}:</span>
            <span>-RM${Number(discount).toFixed(2)}</span>
          </div>
          ` : ''}
          ${Number(delivery_fee) > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 6px;">
            <span>运费 (Delivery Fee):</span>
            <span>+RM${Number(delivery_fee).toFixed(2)}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #1e293b; border-top: 1px dashed #d6d3d1; padding-top: 8px; margin-top: 4px;">
            <span>应收总额 (Total):</span>
            <span style="color: #a0714f; font-size: 18px;">RM${Number(total).toFixed(2)}</span>
          </div>
        </div>

        ${screenshotSection}

        <!-- Call to Action Button -->
        <div style="text-align: center; margin: 28px 0 14px;">
          <a href="${staffOrderUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #a0714f; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(160, 113, 79, 0.3);">
            👉 点击进入员工后台处理订单 ↗
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f1f5f9; padding: 14px 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        One Bite Cookie 门店系统自动发送 · 接收人: ${targetRecipients.join(', ')}
      </div>
    </div>
  `;

  const transportData = getTransporter();

  if (transportData) {
    try {
      const info = await transportData.transporter.sendMail({
        from: `"One Bite Cookie 系统通知" <${transportData.user}>`,
        to: targetRecipients.join(', '),
        subject: `🔔 [新订单提醒] #${order_id} (RM${Number(total).toFixed(2)}) - ${customer_name}`,
        html: htmlContent
      });

      console.log(`[Staff Email] Sent staff new order alert to ${targetRecipients.join(', ')}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, recipients: targetRecipients };
    } catch (err) {
      console.error('[Staff Email] Error sending staff alert via SMTP:', err);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Staff Email Notice] GMAIL_USER / GMAIL_APP_PASSWORD not set in .env.local. Simulated staff alert to: ${targetRecipients.join(', ')} for order #${order_id}`);
    return { success: true, simulated: true, recipients: targetRecipients };
  }
}
