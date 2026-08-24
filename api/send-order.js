// server.js - Express backend for order email
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');




// Serve static files (frontend) from this directory


// SMTP configuration (Gmail App Password)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'tangductri15@gmail.com',
    pass: 'zvno rqja wpoy pufw'
  }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { cust_name, cust_phone, cust_email, cust_address, order_code, items, total_price, stove_included } = req.body;
  if (!cust_name || !cust_phone || !cust_email || !cust_address || !order_code) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Generate item table rows
  let itemsHtml = '';
  if (items && items.length > 0) {
    itemsHtml = items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 8px;"><strong>${item.qty}x</strong> ${item.name}</td>
        <td style="padding: 10px 8px; text-align: right; color: #D85A2A; font-weight: bold;">${new Intl.NumberFormat('vi-VN').format(item.price * item.qty)}đ</td>
      </tr>
    `).join('');
  } else {
    itemsHtml = `<tr><td colspan="2" style="padding: 10px; color: #888;">(Chưa có món chi tiết)</td></tr>`;
  }

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
      <div style="background: #2B150C; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="color: #FBBF24; margin: 0 0 8px 0; font-size: 24px;">LẨU NHÀ - ĂN LẨU TẠI NHÀ</h1>
        <p style="margin: 0; font-size: 15px; color: #E6D8CE;">Xác Nhận Đơn Hàng Thành Công</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 16px; color: #333;">Xin chào <strong>${cust_name}</strong>,</p>
        <p style="color: #555; line-height: 1.6;">Cảm ơn bạn đã lựa chọn <strong>Lẩu Nhà</strong>! Đơn hàng của bạn đã được tiếp nhận và nhân viên sẽ liên hệ xác nhận trong vòng 3-5 phút.</p>

        <div style="background: #FDF8F5; border: 1px dashed #D85A2A; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #D85A2A; font-size: 17px;">MÃ ĐƠN HÀNG: #LN-${order_code}</h3>
          <p style="margin: 4px 0; color: #444;"><strong>Người nhận:</strong> ${cust_name}</p>
          <p style="margin: 4px 0; color: #444;"><strong>Số điện thoại:</strong> ${cust_phone}</p>
          <p style="margin: 4px 0; color: #444;"><strong>Địa chỉ giao:</strong> ${cust_address}</p>
          <p style="margin: 4px 0; color: #444;"><strong>Dịch vụ mượn bếp cồn:</strong> ${stove_included ? 'Có mượn bếp' : 'Không'}</p>
        </div>

        <h3 style="color: #2B150C; border-bottom: 2px solid #2B150C; padding-bottom: 8px; margin-top: 24px;">CHI TIẾT SET LẨU</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px;">
          ${itemsHtml}
        </table>

        <div style="text-align: right; margin-top: 20px; padding-top: 12px; border-top: 2px solid #eee;">
          <span style="font-size: 16px; font-weight: bold; color: #333;">Tổng thanh toán (sau ưu đãi): </span>
          <span style="font-size: 22px; font-weight: bold; color: #D85A2A;">${total_price || 'Liên hệ'}</span>
        </div>

        <div style="background: #E8F5E9; color: #2E7D32; padding: 12px 16px; border-radius: 8px; margin-top: 20px; font-size: 14px; text-align: center;">
          Miễn phí đổi trả 100% nếu thực phẩm không đảm bảo độ tươi ngon khi nhận hàng.
        </div>
      </div>

      <div style="background: #F5F5F5; padding: 16px; text-align: center; font-size: 13px; color: #777;">
        <p style="margin: 0;">Hotline hỗ trợ 24/7: <strong>0819 943 904</strong></p>
        <p style="margin: 4px 0 0 0;">Cảm ơn quý khách đã tin tưởng dịch vụ tiệc lẩu tại nhà của Lẩu Nhà!</p>
      </div>
    </div>
  `;

  const mailOptionsCustomer = {
    from: '"Lẩu Nhà" <tangductri15@gmail.com>',
    to: cust_email,
    subject: `[Lẩu Nhà] Xác nhận đơn hàng #${order_code} - ${cust_name}`,
    html: emailHtml
  };

  const mailOptionsManager = {
    from: '"Hệ Thống Đặt Hàng" <tangductri15@gmail.com>',
    to: 'tangductri15@gmail.com',
    subject: `[ĐƠN HÀNG MỚI] #${order_code} - ${cust_name} (${total_price})`,
    html: emailHtml
  };

  try {
    await transporter.sendMail(mailOptionsCustomer);
    await transporter.sendMail(mailOptionsManager);

    // Save order data to Google Sheet
    const googleSheetUrl = process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbxc8prDraj037l1-9f7fy7fJkIpT9DJntFKlHAwcR-aEYTk7ps3zmBJMLe2xn9PAdbK/exec';
    if (googleSheetUrl) {
      const itemsText = (items && items.length > 0)
        ? items.map(i => `${i.qty}x ${i.name} (${new Intl.NumberFormat('vi-VN').format(i.price * i.qty)}đ)`).join('; ')
        : 'Không có chi tiết';

      const sheetPayload = {
        timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        order_code: `#LN-${order_code}`,
        cust_name: cust_name,
        cust_phone: cust_phone,
        cust_email: cust_email,
        cust_address: cust_address,
        items: itemsText,
        stove_included: stove_included ? 'Có mượn bếp' : 'Không mượn bếp',
        total_price: total_price || '0đ',
        status: 'Chờ xác nhận'
      };

      try {
        await fetch(googleSheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetPayload)
        });
      } catch (sheetErr) {
        console.error('Google Sheet Error:', sheetErr.message);
      }
    }

    return res.status(200).json({ success: true, order_code });
  } catch (err) {
    console.error('Mail send error:', err);
    return res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
};

