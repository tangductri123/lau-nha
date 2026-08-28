// Lẩu Nhà order summary behavior.
(function () {
  'use strict';
  const money = (value) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
  const byId = (ids) => ids.map((id) => document.getElementById(id)).find(Boolean);
  const itemInputs = () => Array.from(document.querySelectorAll('input.item-qty'));
  function setText(ids, value) { const el = byId(ids); if (el) el.textContent = value; }
  function renderSummary() {
    const items = itemInputs().map((input) => ({ input, name: input.dataset.name || input.name || input.id, price: Number(input.dataset.price || 0), qty: Math.max(0, Number.parseInt(input.value, 10) || 0) })).filter((item) => item.qty > 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = subtotal >= 399000 ? 50000 : 0;
    const stoveFee = subtotal >= 399000 ? 0 : (subtotal > 0 ? 50000 : 0);
    const total = Math.max(0, subtotal - discount + stoveFee);
    const list = byId(['summaryItemList', 'summaryItems', 'orderItems', 'billItems', 'orderSummaryItems']);
    if (list) list.innerHTML = items.length ? items.map((item) => '<div class="summary-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #e8dfd8;"><div style="flex: 1; min-width: 0; padding-right: 12px;"><div style="font-weight: 600; color: #ffffff; font-size: 0.95rem; line-height: 1.35;">' + item.name + '</div><div style="font-size: 0.85rem; color: #e0d8cf; margin-top: 2px; line-height: 1.35;">' + money(item.price) + ' × ' + item.qty + '</div></div><div style="font-weight: 600; color: #ffffff; font-size: 0.95rem; line-height: 1.35; white-space: nowrap; text-align: right;">' + money(item.price * item.qty) + '</div></div>').join('') : '<div class="summary-empty">Chưa có sản phẩm</div>';
    const extra = document.querySelector('.summary-extra');
    if (extra && !byId(['summarySubtotal', 'subtotal', 'billSubtotal'])) { const line = document.createElement('div'); line.className = 'summary-line'; line.innerHTML = '<span>Tạm tính:</span><strong id="summarySubtotal"></strong>'; extra.insertBefore(line, extra.firstChild); }
    setText(['summarySubtotal', 'subtotal', 'billSubtotal'], money(subtotal));
    setText(['summaryDiscount', 'discount', 'billDiscount'], discount ? '-' + money(discount) : money(0));
    setText(['summaryStoveFee', 'stoveFee', 'billStoveFee', 'rentalFee'], money(stoveFee));
    setText(['totalPrice', 'total', 'summaryTotal', 'billTotal'], money(total));
    document.querySelectorAll('[data-summary="subtotal"]').forEach((el) => { el.textContent = money(subtotal); });
    document.querySelectorAll('[data-summary="discount"]').forEach((el) => { el.textContent = '-' + money(discount); });
    document.querySelectorAll('[data-summary="stoveFee"]').forEach((el) => { el.textContent = money(stoveFee); });
    document.querySelectorAll('[data-summary="total"]').forEach((el) => { el.textContent = money(total); });
  }
  function updateQuantity(button) {
    const input = button.dataset.target && document.getElementById(button.dataset.target); if (!input) return;
    const current = Math.max(0, Number.parseInt(input.value, 10) || 0);
    const next = button.classList.contains('btn-minus') ? Math.max(0, current - 1) : current + 1;
    input.value = String(next);
    const badge = document.getElementById('badge-' + button.dataset.target); if (badge) { badge.textContent = String(next); badge.classList.toggle('has-count', next > 0); }
    const card = button.closest('.broth-card, .set-card, .addon-card, .service-card'); if (card) card.classList.toggle('selected', next > 0);
    renderSummary();
  }
  document.addEventListener('click', (event) => { const button = event.target.closest('button.btn-qty'); if (button) { event.preventDefault(); updateQuantity(button); } });
  document.addEventListener('DOMContentLoaded', renderSummary);
  if (document.readyState !== 'loading') renderSummary();
  window.renderSummary = renderSummary;
})();

// Submit orders through the API without a native form reload.
(function () {
  'use strict';
  function showOrderMessage(message, isError) {
    const toast = document.querySelector('#toast, .toast, [role="alert"]');
    if (toast) { toast.textContent = message; toast.classList.add('show', 'visible'); setTimeout(() => toast.classList.remove('show', 'visible'), 5000); }
    else window.alert(message);
    if (isError) console.error(message);
  }
  function attachOrderSubmit() {
    const form = document.getElementById('orderForm');
    if (!form || form.dataset.orderSubmitAttached === 'true') return;
    form.dataset.orderSubmitAttached = 'true';
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      const originalLabel = submitButton ? submitButton.textContent : '';
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Đang xử lý đặt hàng...'; }
      try {
        const payload = {
          name: document.getElementById('custName')?.value.trim() || '',
          phone: document.getElementById('custPhone')?.value.trim() || '',
          email: document.getElementById('custEmail')?.value.trim() || '',
          address: document.getElementById('custAddress')?.value.trim() || '',
          notes: document.getElementById('custNotes')?.value.trim() || document.getElementById('orderNotes')?.value.trim() || '',
          stove_included: document.getElementById('addonStove')?.checked === true,
          items: Array.from(document.querySelectorAll('input.item-qty')).map((input) => ({ name: input.dataset.name || input.name || input.id, price: Number(input.dataset.price || 0), qty: Math.max(0, Number.parseInt(input.value, 10) || 0) })).filter((item) => item.qty > 0)
        };
        if (!payload.name || !payload.phone || !payload.address || !payload.items.length) throw new Error('Vui lòng điền đủ thông tin và chọn sản phẩm.');
        const response = await fetch('/api/send-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Có lỗi xảy ra, vui lòng thử lại hoặc gọi hotline');
        showOrderMessage('Đặt hàng thành công!');
        form.reset();
        if (typeof window.renderSummary === 'function') window.renderSummary();
      } catch (error) { showOrderMessage(error.message || 'Có lỗi xảy ra, vui lòng thử lại hoặc gọi hotline', true); }
      finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalLabel; } }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachOrderSubmit); else attachOrderSubmit();
})();
