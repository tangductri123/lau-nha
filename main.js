document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('orderForm');
  const inputs = document.querySelectorAll('.item-qty');
  const stove = document.getElementById('addonStove');
  document.addEventListener('click', e => {
    const button = e.target.closest('.btn-minus, .btn-plus');
    if (!button) return;
    e.preventDefault();
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const value = Math.max(0, (parseInt(input.value, 10) || 0) + (button.classList.contains('btn-plus') ? 1 : -1));
    input.value = value;
    const badge = document.getElementById('badge-' + input.id);
    if (badge) { badge.textContent = value; badge.classList.toggle('has-count', value > 0); }
  });
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const value = id => (document.getElementById(id)?.value || '').trim();
    const name = value('custName'), phone = value('custPhone'), email = value('custEmail'), address = value('custAddress');
    if (!name || !phone || !address) { alert('Vui lòng điền họ tên, số điện thoại và địa chỉ.'); return; }
    const items = [...inputs].map(input => ({ name: input.dataset.name || 'Món', qty: parseInt(input.value, 10) || 0, price: parseInt(input.dataset.price, 10) || 0 })).filter(item => item.qty > 0);
    if (!items.length) { alert('Vui lòng chọn ít nhất một món.'); return; }
    const orderCode = Math.floor(1000 + Math.random() * 9000);
    try {
      const response = await fetch('/api/send-order', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cust_name:name, cust_phone:phone, cust_email:email, cust_address:address, order_code:orderCode, items, stove_included:!!stove?.checked }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || 'Order submission failed');
      document.getElementById('modalName').textContent = name;
      document.getElementById('modalAddress').textContent = address;
      document.getElementById('modalOrderCode').textContent = result.order_code || orderCode;
      document.getElementById('orderModal')?.classList.add('active');
    } catch (error) { console.error('Send order error:', error); alert('Xin lỗi, đơn hàng chưa được gửi. Vui lòng thử lại sau hoặc liên hệ Lẩu Nhà qua số 081 994 3904.'); }
  });
});
