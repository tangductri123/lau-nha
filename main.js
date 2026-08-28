document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('orderForm');
  const stove = document.getElementById('addonStove');
  const modal = document.getElementById('orderModal');
  if (form) form.noValidate = true;

  const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const money = value => `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('vi-VN')}đ`;
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[char]));
  const inputs = () => [...document.querySelectorAll('.item-qty')];

  function summary() {
    const items = inputs().map(input => ({
      name: input.dataset.name || 'Món',
      qty: Math.max(0, parseInt(input.value, 10) || 0),
      price: Math.max(0, parseInt(input.dataset.price, 10) || 0)
    })).filter(item => item.qty);
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const discount = subtotal ? 50000 : 0;
    const stoveFee = stove?.checked && subtotal < 399000 ? 50000 : 0;
    const total = Math.max(0, subtotal + stoveFee - discount);
    const list = document.getElementById('summaryItemList');
    if (list) {
      list.style.fontFamily = FONT;
      list.innerHTML = items.length ? items.map(item => `<div class="summary-line summary-item" style="font-family:${FONT}"><span style="font-family:${FONT}">${esc(item.name)} × ${item.qty}<small style="font-family:${FONT}">${money(item.price)} / món</small></span><strong style="font-family:${FONT}">${money(item.qty * item.price)}</strong></div>`).join('') : '<p class="summary-empty" style="font-family:inherit">Chưa có món nào được chọn.</p>';
    }
    const subtotalElement = document.getElementById('summarySubtotal');
    if (subtotalElement) subtotalElement.textContent = money(subtotal);
    const discountElement = document.getElementById('summaryDiscount');
    if (discountElement) discountElement.textContent = discount ? `-${money(discount)}` : '0đ';
    const feeElement = document.getElementById('summaryStoveFee');
    if (feeElement) feeElement.textContent = stove?.checked ? (stoveFee ? money(stoveFee) : '0đ (miễn phí)') : 'Không mượn bếp';
    const totalElement = document.getElementById('totalPrice');
    if (totalElement) totalElement.textContent = money(total);
    return { items, subtotal, discount, stoveFee, total };
  }

  function setQty(input, quantity) {
    input.value = Math.max(0, quantity);
    const badge = document.getElementById(`badge-${input.id}`);
    if (badge) { badge.textContent = input.value; badge.classList.toggle('has-count', quantity > 0); }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.btn-minus, .btn-plus');
    if (button) {
      event.preventDefault();
      const input = document.getElementById(button.dataset.target);
      if (input) { setQty(input, (parseInt(input.value, 10) || 0) + (button.classList.contains('btn-plus') ? 1 : -1)); summary(); }
      return;
    }
    const card = event.target.closest('.set-card');
    if (card && !event.target.closest('button,input,a')) {
      const input = card.querySelector('.item-qty');
      if (input) { inputs().forEach(other => { if (other !== input) setQty(other, 0); }); setQty(input, 1); summary(); }
    }
  });
  document.addEventListener('change', event => { if (event.target.matches('.item-qty, #addonStove')) summary(); });
  const close = () => modal?.classList.remove('active');
  document.getElementById('closeModal')?.addEventListener('click', close);
  modal?.addEventListener('click', event => { if (event.target === modal) close(); });
  summary();
  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = id => (document.getElementById(id)?.value || '').trim();
    const name = value('custName'), phone = value('custPhone'), email = value('custEmail'), address = value('custAddress'), order = summary();
    if (!name || !phone || !address) return alert('Vui lòng điền họ tên, số điện thoại và địa chỉ.');
    if (!order.items.length) return alert('Vui lòng chọn ít nhất một món hoặc một set.');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const orderCode = `LN-${Math.floor(1000 + Math.random() * 9000)}`;
      const response = await fetch(new URL('/api/send-order', document.baseURI), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cust_name: name, cust_phone: phone, cust_email: email, cust_address: address, order_code: orderCode, items: order.items, stove_included: stove ? stove.checked === true : false }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw Error(result.error || `HTTP ${response.status}`);
      document.getElementById('modalName').textContent = name;
      document.getElementById('modalAddress').textContent = address;
      const codeElement = document.getElementById('modalOrderCode') || document.getElementById('orderCodeDisplay') || document.getElementById('orderCode');
      if (codeElement) codeElement.textContent = `Mã đơn hàng: ${result.order_code || result.orderId || orderCode}`;
      modal?.classList.add('active');
    } catch (error) { console.error('Send order error:', error); alert('Xin lỗi, đơn hàng chưa được gửi. Vui lòng kiểm tra kết nối và thử lại sau.'); }
    finally { if (submit) submit.disabled = false; }
  });
});
