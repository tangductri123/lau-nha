document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('orderForm');
  const stove = document.getElementById('addonStove');
  const itemInputs = () => [...document.querySelectorAll('.item-qty')];
  const money = value => `${Math.max(0, Math.round(value)).toLocaleString('vi-VN')}đ`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function readItems() {
    return itemInputs().map(input => ({
      name: input.dataset.name || 'Món',
      qty: Math.max(0, parseInt(input.value, 10) || 0),
      price: Math.max(0, parseInt(input.dataset.price, 10) || 0)
    })).filter(item => item.qty > 0);
  }

  function renderSummary() {
    const items = readItems();
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = subtotal > 0 ? 50000 : 0;
    const stoveFee = stove?.checked ? 0 : 0;
    const total = Math.max(0, subtotal + stoveFee - discount);
    const list = document.getElementById('summaryItemList');
    if (list) {
      list.innerHTML = items.length ? items.map(item => `<div class="summary-line summary-item"><span>${escapeHtml(item.name)} × ${item.qty}<small>${money(item.price)} / món</small></span><strong>${money(item.price * item.qty)}</strong></div>`).join('') : '<p class="summary-empty">Chưa có món nào được chọn.</p>';
    }
    const discountNode = document.getElementById('summaryDiscount');
    if (discountNode) discountNode.textContent = `-${money(discount)}`;
    const totalNode = document.getElementById('totalPrice');
    if (totalNode) totalNode.textContent = money(total);
    const feeNode = document.getElementById('summaryStoveFee');
    if (feeNode) feeNode.textContent = stove?.checked ? '0đ (Free mượn bếp)' : '0đ';
    return { items, subtotal, discount, stoveFee, total };
  }

  function setQty(input, qty) {
    const nextQty = Math.max(0, qty);
    input.value = String(nextQty);
    const badge = document.getElementById(`badge-${input.id}`);
    if (badge) { badge.textContent = input.value; badge.classList.toggle('has-count', nextQty > 0); }
  }

  const modal = document.getElementById('orderModal');
  const closeModal = () => modal?.classList.remove('active');
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

  document.addEventListener('click', event => {
    const button = event.target.closest('.btn-minus, .btn-plus');
    if (button) {
      event.preventDefault();
      const input = document.getElementById(button.dataset.target);
      if (input) setQty(input, (parseInt(input.value, 10) || 0) + (button.classList.contains('btn-plus') ? 1 : -1));
      renderSummary();
      return;
    }
    const card = event.target.closest('.set-card');
    if (card && !event.target.closest('button, input, a')) {
      const input = card.querySelector('.item-qty');
      if (input) {
        document.querySelectorAll('.set-card .item-qty').forEach(other => { if (other !== input) setQty(other, 0); });
        setQty(input, 1);
        renderSummary();
      }
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('.item-qty, #addonStove')) renderSummary();
  });
  renderSummary();

  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = id => (document.getElementById(id)?.value || '').trim();
    const name = value('custName'), phone = value('custPhone'), email = value('custEmail'), address = value('custAddress');
    const summary = renderSummary();
    if (!name || !phone || !address) { alert('Vui lòng điền họ tên, số điện thoại và địa chỉ.'); return; }
    if (!summary.items.length) { alert('Vui lòng chọn ít nhất một món hoặc một set.'); return; }
    const orderCode = Math.floor(1000 + Math.random() * 9000);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const response = await fetch('/api/send-order', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cust_name:name, cust_phone:phone, cust_email:email, cust_address:address, order_code:orderCode, items:summary.items, stove_included:!!stove?.checked }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || `HTTP ${response.status}`);
      document.getElementById('modalName').textContent = name;
      document.getElementById('modalAddress').textContent = address;
      document.getElementById('modalOrderCode').textContent = result.order_code || orderCode;
      const zaloButton = document.getElementById('modalZaloButton');
      if (zaloButton) zaloButton.remove();
      const closeButton = document.getElementById('closeModal');
      if (closeButton) {
        const link = document.createElement('a');
        link.id = 'modalZaloButton';
        link.href = 'https://zalo.me/0819943904';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Nhắn tin qua Zalo';
        link.style.cssText = 'display:block;margin:0 auto 12px;background:#0068ff;color:#fff;padding:14px 24px;border-radius:50px;font-weight:700;text-align:center;text-decoration:none;box-shadow:0 8px 20px rgba(0,104,255,.25);';
        closeButton.parentNode.insertBefore(link, closeButton);
      }
      modal?.classList.add('active');
    } catch (error) {
      console.error('Send order error:', error);
      alert(`Xin lỗi, đơn hàng chưa được gửi. ${error?.message || 'Vui lòng thử lại sau.'}`);
    } finally { if (submit) submit.disabled = false; }
  });
});
