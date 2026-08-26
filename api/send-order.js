'use strict';

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const FREE_THRESHOLD = 399000;
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbySw5rlJ_JjIKahh6XFjSLn8-WhEzpbXZBnuMvpfbPBWSckmVzBVbaztiHrieIdfakm/exec';
const json = (res, status, body) => res.status(status).json(body);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const vnd = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + 'đ';
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms))]);
const timestamp = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Saigon', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {}); return `${p.hour}:${p.minute}:${p.second} ${p.day}/${p.month}/${p.year}`; };
function calc(raw, stove) { const items = Array.isArray(raw) ? raw : []; if (!items.length) throw Error('Items are required'); let subtotal = 0; const normalized = items.slice(0, 50).map(i => { const name = str(i?.name, 120), qty = Number(i?.qty), price = Number(i?.price); if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item'); subtotal += qty * price; return { name, qty, price }; }); const stoveFee = stove && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0; return { items: normalized, subtotal, stoveFee, total: Math.max(0, subtotal + stoveFee - DISCOUNT) }; }
function sheetPayload(o) {
  const formattedCode = o.orderCode.startsWith('#') ? o.orderCode : `#LN-${o.orderCode.replace(/^LN-/, '')}`;
  const items = o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; ');
  const stoveText = o.stoveFee > 0 ? 'Có mượn bếp' : 'Không mượn bếp';
  const total = vnd(o.total);
  const row = [o.createdAt, formattedCode, o.name, o.phone, o.email, o.address, items, stoveText, total, 'Chờ xác nhận'];
  return {
    row, rowData: row, values: row, data: row,
    timestamp: o.createdAt, time: o.createdAt, thoi_gian: o.createdAt, date: o.createdAt,
    order_code: formattedCode, orderId: formattedCode, order_id: formattedCode, ma_don_hang: formattedCode, code: formattedCode,
    name: o.name, customer_name: o.name, cust_name: o.name, ten_khach_hang: o.name, customerName: o.name,
    phone: o.phone, customer_phone: o.phone, cust_phone: o.phone, so_dien_thoai: o.phone, customerPhone: o.phone,
    email: o.email, customer_email: o.email, cust_email: o.email, customerEmail: o.email,
    address: o.address, customer_address: o.address, cust_address: o.address, dia_chi: o.address, customerAddress: o.address,
    items, chi_tiet_mon: items, item_details: items, items_text: items, orderDetails: items,
    stove: stoveText, stove_rental: stoveText, muon_bep: stoveText, stove_included: stoveText, dat_muon_bep_con: stoveText,
    total, total_price: total, tong_tien: total, amount: total,
    status: 'Chờ xác nhận', trang_thai: 'Chờ xác nhận'
  };
}
async function notifySheet(o) { const r = await withTimeout(fetch(GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' }, body: JSON.stringify(sheetPayload(o)), redirect: 'follow' }), 15000); if (!r.ok) throw Error(`Google Sheets HTTP ${r.status}`); }
module.exports = async (req, res) => { res.setHeader('Access-Control-Allow-Origin', '*'); if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' }); try { const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); const o = { ...calc(b.items, b.stove_included === true || b.stove === true), name: str(b.name || b.customer_name || b.cust_name || b.ten_khach_hang || b.customerName, 100), phone: str(b.phone || b.customer_phone || b.cust_phone || b.so_dien_thoai || b.customerPhone, 30), email: str(b.email || b.customer_email || b.cust_email || b.customerEmail, 254), address: str(b.address || b.customer_address || b.cust_address || b.dia_chi || b.customerAddress, 300), orderCode: str(b.order_code || b.orderId || b.order_id || b.ma_don_hang || b.code, 30) || String(Date.now()).slice(-4) }; if (!o.name || !o.phone || !o.address) throw Error('Customer information is required'); o.createdAt = timestamp(); void notifySheet(o).catch(e => console.error('Google Sheets notification failed:', e.message)); return json(res, 200, { success: true, orderId: o.orderCode, order_code: o.orderCode }); } catch (e) { return json(res, 400, { success: false, error: e.message }); } };
