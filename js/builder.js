/**
 * Lau Nha - Builder Module (js/builder.js)
 * Xử lý logic chọn món, định lượng set lẩu, nước cốt lẩu, mượn bếp cồn và tính giá tự động
 */

(function(window) {
  'use strict';

  const sans = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const money = v => `${Math.max(0, Math.round(Number(v) || 0)).toLocaleString('vi-VN')}đ`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  function getInputs() {
    return [...document.querySelectorAll('.item-qty')];
  }

  function setQty(inputEl, val) {
    if (!inputEl) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    inputEl.value = num;
    const badge = document.getElementById(`badge-${inputEl.id}`);
    if (badge) {
      badge.textContent = num;
      badge.classList.toggle('has-count', num > 0);
    }
  }

  function calculateSummary() {
    const stove = document.getElementById('addonStove');
    const items = getInputs()
      .map(i => ({
        name: i.dataset.name || 'Món',
        qty: Math.max(0, parseInt(i.value, 10) || 0),
        price: Math.max(0, parseInt(i.dataset.price, 10) || 0)
      }))
      .filter(i => i.qty > 0);

    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = subtotal ? 50000 : 0;
    const isStove = Boolean(stove?.checked);
    const stoveFee = isStove && subtotal < 399000 ? 50000 : 0;
    const stoveDeposit = isStove ? 200000 : 0;
    const orderValue = Math.max(0, subtotal + stoveFee - discount);
    const total = orderValue + stoveDeposit;

    // 1. Cập nhật danh sách món đã chọn trong Summary Card
    const list = document.getElementById('summaryItemList');
    if (list) {
      list.innerHTML = items.length
        ? items.map(i => `
            <div class="summary-line summary-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.24);gap:14px;width:100%;margin:0;">
              <div style="display:flex;flex-direction:column;min-width:0;line-height:1.4;">
                <span style="font-weight:800;font-size:14px;color:#fff;overflow-wrap:anywhere;">${esc(i.name)}</span>
                <span style="font-size:12px;color:#f0f0f0;margin-top:3px;">Đơn giá: ${money(i.price)} × ${i.qty}</span>
              </div>
              <span style="font-weight:900;font-size:15px;color:#fff;text-align:right;white-space:nowrap;margin-left:auto;flex-shrink:0;">${money(i.qty * i.price)}</span>
            </div>
          `).join('')
        : '<p class="summary-empty">Chưa có món nào được chọn.</p>';

      list.style.setProperty('font-family', sans, 'important');
      list.querySelectorAll(':not(i):not([class*="fa-"])').forEach(el => el.style.setProperty('font-family', sans, 'important'));
    }

    // 2. Cập nhật các dòng tổng tiền
    const sub = document.getElementById('summarySubtotal');
    if (sub) sub.textContent = money(subtotal);

    const d = document.getElementById('summaryDiscount');
    if (d) d.textContent = discount ? `-${money(discount)} Khai trương` : '0đ';

    const f = document.getElementById('summaryStoveFee');
    if (f) f.textContent = isStove ? (stoveFee ? money(stoveFee) : '0đ (miễn phí)') : 'Không mượn bếp';

    const dep = document.getElementById('summaryDeposit');
    if (dep) dep.textContent = isStove ? money(stoveDeposit) : '0đ';

    const depRow = document.getElementById('summaryDepositRow');
    if (depRow) depRow.style.display = isStove ? 'flex' : 'none';

    const shipping = document.getElementById('summaryShipping');
    if (shipping) shipping.textContent = 'Freeship';

    const t = document.getElementById('totalPrice');
    if (t) t.textContent = money(total);

    // 3. Cập nhật nhãn Accordion Bước 1 (Nước lẩu)
    const broths = getInputs().filter(i => i.id.includes('broth') && parseInt(i.value, 10) > 0);
    const brothCount = broths.reduce((s, i) => s + parseInt(i.value, 10), 0);
    const hint1 = document.getElementById('hintStep1');
    const count1 = document.getElementById('countStep1');
    if (hint1) hint1.textContent = brothCount ? 'Đang chọn: ' + broths.map(i => `${(i.dataset.name || '').replace(/\s*\(.*\)/, '')} (${i.value})`).join(', ') : 'Chưa chọn nước cốt lẩu';
    if (count1) { count1.textContent = `${brothCount} túi`; count1.classList.toggle('has-items', brothCount > 0); }

    // 4. Cập nhật nhãn Accordion Bước 2 (Set Topping)
    const sets = getInputs().filter(i => i.id.includes('set') && parseInt(i.value, 10) > 0);
    const setCount = sets.reduce((s, i) => s + parseInt(i.value, 10), 0);
    const hint2 = document.getElementById('hintStep2');
    const count2 = document.getElementById('countStep2');
    if (hint2) hint2.textContent = setCount ? 'Đang chọn: ' + sets.map(i => `${(i.dataset.name || '').replace(/\s*\(.*\)/, '')} (${i.value})`).join(', ') : 'Chưa chọn set topping';
    if (count2) { count2.textContent = `${setCount} set`; count2.classList.toggle('has-items', setCount > 0); }

    // 5. Cập nhật nhãn Accordion Bước 3 (Món thêm & Bếp cồn)
    const addons = getInputs().filter(i => i.id.includes('addon') && parseInt(i.value, 10) > 0);
    const addonCount = addons.reduce((s, i) => s + parseInt(i.value, 10), 0) + (isStove ? 1 : 0);
    const parts = [];
    if (isStove) parts.push('Mượn bếp cồn');
    addons.forEach(i => parts.push(`${(i.dataset.name || '').replace(/\s*\(.*\)/, '')} (${i.value})`));
    const hint3 = document.getElementById('hintStep3');
    const count3 = document.getElementById('countStep3');
    if (hint3) hint3.textContent = parts.length ? 'Đang chọn: ' + parts.join(', ') : 'Chưa chọn thêm';
    if (count3) { count3.textContent = `${addonCount} món`; count3.classList.toggle('has-items', addonCount > 0); }

    return { items, subtotal, discount, isStove, stoveFee, stoveDeposit, orderValue, total };
  }

  function initBuilderEvents() {
    const summaryCard = document.querySelector('.summary-card');
    if (summaryCard) {
      summaryCard.style.setProperty('font-family', sans, 'important');
      summaryCard.querySelectorAll(':not(i):not([class*="fa-"])').forEach(el => el.style.setProperty('font-family', sans, 'important'));
    }

    // Sự kiện nút Tăng/Giảm (+/-) và chọn nhanh set card
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn-minus, .btn-plus');
      if (btn) {
        e.preventDefault();
        const input = document.getElementById(btn.dataset.target);
        if (input) {
          const delta = btn.classList.contains('btn-plus') ? 1 : -1;
          setQty(input, (parseInt(input.value, 10) || 0) + delta);
          calculateSummary();
        }
        return;
      }

      // Nút mũi tên lướt ngang sản phẩm (Slider Prev/Next)
      const arrowBtn = e.target.closest('.btn-slider-arrow');
      if (arrowBtn) {
        e.preventDefault();
        const targetId = arrowBtn.dataset.target;
        const grid = document.getElementById(targetId);
        if (grid) {
          const cardWidth = targetId === 'setGrid' ? 280 : 250;
          const dir = arrowBtn.classList.contains('next') ? 1 : -1;
          grid.scrollBy({ left: dir * cardWidth, behavior: 'smooth' });
        }
        return;
      }

      const card = e.target.closest('.set-card');
      if (card && !e.target.closest('button, input, a, .qty-control')) {
        const input = card.querySelector('.item-qty');
        if (input) {
          getInputs().forEach(x => { if (x !== input && x.id.includes('set')) setQty(x, 0); });
          setQty(input, 1);
          calculateSummary();
        }
      }
    });

    // Bắt sự kiện thay đổi input hoặc checkbox mượn bếp
    document.addEventListener('change', e => {
      if (e.target.matches('.item-qty, #addonStove')) {
        calculateSummary();
      }
    });

    // Chạy tính toán khởi tạo
    calculateSummary();

    // Đồng bộ giá sản phẩm mới nhất từ Database trong nền (Non-blocking / Zero SEO penalty)
    syncProductsFromDB();
  }

  async function syncProductsFromDB() {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) return;
      const products = await res.json();
      if (!Array.isArray(products) || products.length === 0) return;

      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');

      const inputs = getInputs();
      let hasChanges = false;

      inputs.forEach(input => {
        const inputName = norm(input.dataset.name || '');
        const inputId = (input.id || '').toLowerCase();

        const matched = products.find(p => {
          const pName = norm(p.name || '');
          if (!pName) return false;
          if (inputName.includes(pName) || pName.includes(inputName)) return true;
          if (inputId.includes('tomyum') && (pName.includes('thai') || pName.includes('tomyum'))) return true;
          if (inputId.includes('sichuan') && (pName.includes('tuxuyen') || pName.includes('tieute'))) return true;
          if (inputId.includes('mushroom') && (pName.includes('nam') || pName.includes('thuonghang'))) return true;
          if (inputId.includes('crab') && (pName.includes('rieu') || pName.includes('cua'))) return true;
          if (inputId.includes('couple') && (pName.includes('doilua') || pName.includes('doi'))) return true;
          if (inputId.includes('family') && (pName.includes('giadinh') || pName.includes('dinh'))) return true;
          if (inputId.includes('party') && (pName.includes('daitiec') || pName.includes('tiec'))) return true;
          if (inputId.includes('con') && pName.includes('con')) return true;
          if (inputId.includes('batdua') && (pName.includes('bat') || pName.includes('dua'))) return true;
          if (inputId.includes('bomy') && (pName.includes('bo') && pName.includes('my'))) return true;
          if (inputId.includes('vien') && pName.includes('vien')) return true;
          return false;
        });

        if (matched && matched.price !== undefined && matched.price !== null) {
          const newPrice = Number(matched.price);
          if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== Number(input.dataset.price)) {
            input.dataset.price = newPrice;
            hasChanges = true;

            const card = input.closest('.broth-card, .set-card, .addon-card');
            if (card) {
              const priceEl = card.querySelector('.broth-price, .set-price, .addon-price');
              if (priceEl && !priceEl.id.includes('stove')) {
                if (priceEl.classList.contains('broth-price')) {
                  priceEl.textContent = `${money(newPrice)} / túi`;
                } else {
                  priceEl.textContent = money(newPrice);
                }
              }
            }
          }
        }
      });

      if (hasChanges) {
        calculateSummary();
      }
    } catch (e) {
      console.warn('[Product Dynamic Sync Info]:', e);
    }
  }

  window.LauNhaBuilder = {
    money,
    esc,
    getInputs,
    setQty,
    calculateSummary,
    syncProductsFromDB,
    init: initBuilderEvents
  };
})(window);
