'use strict';
const fs = require('fs');
const path = require('path');

// Load .env if running locally
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...vParts] = trimmed.split('=');
        const kTrim = k.trim();
        const vTrim = vParts.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (kTrim && !process.env[kTrim]) process.env[kTrim] = vTrim;
      }
    }
  }
} catch {}

const SEPAY_API_TOKEN = process.env.SEPAY_API_TOKEN || '';
const ACCOUNT_NUMBER = process.env.SEPAY_ACCOUNT_NUMBER || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const code = String(req.query.code || req.query.order_code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const amount = parseFloat(req.query.amount || 0);

  if (!code) {
    return res.status(400).json({ success: false, error: 'Mã đơn hàng không hợp lệ' });
  }

  try {
    const response = await fetch(`https://my.sepay.vn/userapi/transactions/list?account_number=${ACCOUNT_NUMBER}&limit=20`, {
      headers: {
        'Authorization': `Bearer ${SEPAY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'Không thể kết nối SePay API' });
    }

    const data = await response.json();
    const transactions = data?.transactions || [];

    const matched = transactions.find(tx => {
      const content = String(tx.transaction_content || '').toUpperCase();
      const amountIn = parseFloat(tx.amount_in || 0);
      return content.includes(code) && (amount <= 0 || amountIn >= amount);
    });

    if (matched) {
      // Tự động chuyển trạng thái đơn hàng trong Admin DB sang 'paid'
      try {
        const RAILWAY_URL = process.env.RAILWAY_URL || 'https://lau-nha-production.up.railway.app';
        fetch(`${RAILWAY_URL}/api/orders/mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_code: code,
            transaction_id: String(matched.id || ''),
            amount_in: matched.amount_in
          })
        }).catch(err => console.warn('Sync paid status to Admin DB failed:', err.message));
      } catch (_) {}

      return res.status(200).json({
        success: true,
        paid: true,
        transaction: {
          id: matched.id,
          amount_in: matched.amount_in,
          transaction_date: matched.transaction_date,
          content: matched.transaction_content
        }
      });
    }

    return res.status(200).json({
      success: true,
      paid: false
    });
  } catch (err) {
    console.error('Check payment error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
