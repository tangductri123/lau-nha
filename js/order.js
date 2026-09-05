/**
 * Lau Nha - Order Module (js/order.js)
 * Xử lý form đặt hàng, validate dữ liệu, chống gửi trùng đơn (Idempotency Key & Double Submit),
 * hiển thị modal VietQR và tự động đối soát SePay.
 */

(function(window) {
  'use strict';

  const SEPAY_CONFIG = {
    bank: 'TPBank',
    acc: '22678555999',
    token: 'YAKFPXJ5EXEI6PHHJK3DBNO6ZQ9GWTEXT9Z2AMKWFIVLU0C7G10SVBWP5QAK3QPT'
  };

  let sepayPollTimer = null;
  let isSubmittingOrder = false;

  function generateIdempotencyKey() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 9);
    return `req_${ts}_${rand}`;
  }

  function isValidVNPhone(phone) {
    if (!phone) return false;
    const clean = phone.replace(/[\s\-\.\(\)]/g, '');
    return /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(clean);
  }

  function isValidEmail(email) {
    if (!email) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  }

  function closeModal() {
    if (sepayPollTimer) {
      clearInterval(sepayPollTimer);
      sepayPollTimer = null;
    }
    const modal = document.getElementById('orderModal');
    modal?.classList.remove('active');
  }

  function showSuccessView(title, detail) {
    if (sepayPollTimer) {
      clearInterval(sepayPollTimer);
      sepayPollTimer = null;
    }
    const pState = document.getElementById('modalPaymentState');
    const sState = document.getElementById('modalSuccessState');
    if (pState) pState.style.display = 'none';
    if (sState) sState.style.display = 'block';
    if (title && document.getElementById('modalSuccessTitle')) {
      document.getElementById('modalSuccessTitle').textContent = title;
    }
    if (detail && document.getElementById('modalSuccessDetail')) {
      document.getElementById('modalSuccessDetail').innerHTML = detail;
    }
  }

  function startSepayPolling(orderCodeClean, totalAmount, onPaid) {
    if (sepayPollTimer) clearInterval(sepayPollTimer);
    const codeUpper = String(orderCodeClean || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    sepayPollTimer = setInterval(async () => {
      try {
        let paid = false;

        // 1. Kiểm tra qua endpoint /api/check-payment
        try {
          const res = await fetch(`/api/check-payment?code=${encodeURIComponent(codeUpper)}&amount=${totalAmount}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.paid) paid = true;
          }
        } catch (_) {}

        if (paid) {
          clearInterval(sepayPollTimer);
          sepayPollTimer = null;

          try {
            fetch('/api/orders/mark-paid', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_code: codeUpper })
            }).catch(() => {});
          } catch (_) {}

          if (typeof onPaid === 'function') onPaid();
        }
      } catch (e) {
        console.warn('SePay polling check warning:', e);
      }
    }, 2000);
  }

  function initOrderEvents() {
    const form = document.getElementById('orderForm');
    const modal = document.getElementById('orderModal');
    if (form) form.noValidate = true;

    // Đóng Modal
    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('closeModalSuccess')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Nút thanh toán COD
    document.getElementById('btnPayCod')?.addEventListener('click', () => {
      const addr = document.getElementById('modalAddress')?.textContent || 'địa chỉ của bạn';
      const esc = window.LauNhaBuilder?.esc || (v => v);
      showSuccessView('ĐẶT HÀNG THÀNH CÔNG! (COD)', `Đơn hàng đã được lưu thành công. Bạn vui lòng thanh toán khi nhận hàng tại <strong>${esc(addr)}</strong>.`);
    });

    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();

      // 🛡️ BẢO VỆ CHỐNG TRÙNG ĐƠN (Double Submit Prevention)
      if (isSubmittingOrder) {
        console.warn('Đang xử lý đơn hàng, bỏ qua lượt nhấn lặp lại.');
        return;
      }

      const getValue = id => (document.getElementById(id)?.value || '').trim();
      const name = getValue('custName');
      const phone = getValue('custPhone');
      const email = getValue('custEmail');
      const address = getValue('custAddress');
      const note = getValue('custNote');

      const builder = window.LauNhaBuilder;
      const s = builder ? builder.calculateSummary() : { items: [], total: 0, subtotal: 0 };

      // 1. Validate Form
      if (!name || !phone || !address) {
        alert('Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng.');
        return;
      }

      if (!isValidVNPhone(phone)) {
        alert('Số điện thoại không hợp lệ! Vui lòng nhập đúng số điện thoại di động 10 số (ví dụ: 0912345678).');
        document.getElementById('custPhone')?.focus();
        return;
      }

      if (email && !isValidEmail(email)) {
        alert('Địa chỉ email không đúng định dạng! Vui lòng kiểm tra lại (ví dụ: hoten@gmail.com).');
        document.getElementById('custEmail')?.focus();
        return;
      }

      if (!s.items.length) {
        alert('Vui lòng chọn ít nhất một món hoặc một set.');
        return;
      }

      // 2. Khóa nút Submit và hiển thị Loading Spinner ngay lập tức
      isSubmittingOrder = true;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.75';
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG TẠO ĐƠN HÀNG...';
      }

      let success = false;
      const orderCodeNum = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `LN${orderCodeNum}`;
      let displayedCode = orderCode;
      const idempotencyKey = generateIdempotencyKey();

      try {
        const stove = document.getElementById('addonStove');
        const stoveIncluded = Boolean(stove?.checked);
        const stoveDeposit = stoveIncluded ? 200000 : 0;
        const discountAmt = s.subtotal ? 50000 : 0;
        const shippingFee = 0;
        const stoveFee = stoveIncluded && s.subtotal < 399000 ? 50000 : 0;
        const orderVal = Math.max(0, s.subtotal + stoveFee - discountAmt + shippingFee);
        const totalCollect = orderVal + stoveDeposit;

        const payloadData = {
          idempotency_key: idempotencyKey,
          cust_name: name,
          cust_phone: phone,
          cust_email: email,
          cust_address: address,
          cust_note: note,
          note: note,
          order_code: orderCode,
          items: s.items,
          stove_included: stoveIncluded,
          shipping_fee: shippingFee,
          voucher_code: 'LAUNHA50K',
          discount_code: 'LAUNHA50K',
          discount_amount: discountAmt,
          deposit_amount: stoveDeposit,
          stove_deposit: stoveDeposit,
          stove_fee: stoveFee,
          order_value: orderVal,
          total_collection: totalCollect,
          total: totalCollect
        };

        // 3. Gửi tới API chính
        let endpoint = '/api/send-order';
        if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          endpoint = window.location.port === '8080' ? '/api/send-order' : 'http://localhost:8080/api/send-order';
        }

        try {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadData)
          });
          const result = await r.json().catch(() => ({}));
          if (r.ok && result.success) {
            success = true;
            displayedCode = result.order_code || result.orderId || orderCode;
          }
        } catch (netErr) {
          console.warn('Primary API endpoint failed, trying cloud endpoint...', netErr);
        }

        // Dự phòng Cloud API nếu chạy local port khác
        if (!success && (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          try {
            const rCloud = await fetch('https://laumangdi.com/api/send-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadData)
            });
            const resCloud = await rCloud.json().catch(() => ({}));
            if (rCloud.ok && resCloud.success) {
              success = true;
              displayedCode = resCloud.order_code || orderCode;
            }
          } catch (cloudErr) {
            console.warn('Cloud API fallback failed:', cloudErr);
          }
        }

        // Dự phòng Google Sheets
        if (!success) {
          const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwsIS4DuNFt8fgPkOtM7kVs9BP_EQWFLLb2iwSubA2EvsJdC7sSrLXE3qpZkcwu6WM/exec';
          const stoveText = stoveIncluded ? 'Có mượn bếp' : 'Không mượn bếp';
          const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const detail = s.items.map(i => `${i.qty}x ${i.name} (${builder.money(i.price * i.qty)})`).join('; ');
          const row = [time, orderCode, name, phone, email || '', address, detail, stoveText, builder.money(s.total), 'Chờ xác nhận'];
          const sheetPayload = {
            idempotency_key: idempotencyKey,
            row, rowData: row, values: row, timestamp: time, order_code: orderCode,
            name, phone, email: email || '', address, items: detail, items_detail: detail,
            muon_bep: stoveIncluded ? 'có' : false, stove: stoveIncluded ? 'có' : '',
            stove_included: stoveIncluded, stove_text: stoveText,
            total: s.total, total_price: s.total, total_num: s.total, status: 'Chờ xác nhận'
          };

          try {
            await fetch(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(sheetPayload),
              mode: 'no-cors'
            });
            success = true;
          } catch (sheetErr) {
            console.error('Sheet fallback error:', sheetErr);
            if (window.location.protocol === 'file:') success = true;
          }
        }

        // 4. Xử lý thành công & Hiển thị Modal VietQR SePay
        if (success) {
          const cleanCode = String(displayedCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          document.getElementById('modalName').textContent = name;
          document.getElementById('modalAddress').textContent = address;
          const phoneEl = document.getElementById('modalPhone');
          if (phoneEl) phoneEl.textContent = phone;
          const codeElement = document.getElementById('modalOrderCode');
          if (codeElement) codeElement.textContent = cleanCode;

          const pState = document.getElementById('modalPaymentState');
          const sState = document.getElementById('modalSuccessState');
          if (pState) pState.style.display = 'block';
          if (sState) sState.style.display = 'none';

          const amountEl = document.getElementById('sepayAmount');
          if (amountEl) amountEl.textContent = builder.money(s.total);
          const contentEl = document.getElementById('sepayContent');
          if (contentEl) contentEl.textContent = cleanCode;

          // Copy helpers
          const copyAmountBtn = document.getElementById('btnCopyAmount');
          if (copyAmountBtn) copyAmountBtn.onclick = () => { navigator.clipboard.writeText(String(s.total)); alert('Đã sao chép số tiền!'); };
          const copyContentBtn = document.getElementById('btnCopyContent');
          if (copyContentBtn) copyContentBtn.onclick = () => { navigator.clipboard.writeText(cleanCode); alert('Đã sao chép nội dung chuyển khoản!'); };

          // Sinh ảnh VietQR SePay
          const qrImg = document.getElementById('sepayQrImg');
          const qrLoading = document.getElementById('sepayQrLoading');
          if (qrImg) {
            if (qrLoading) qrLoading.style.display = 'flex';
            const qrUrl = `https://qr.sepay.vn/img?acc=${SEPAY_CONFIG.acc}&bank=${SEPAY_CONFIG.bank}&amount=${s.total}&des=${encodeURIComponent(cleanCode)}&template=compact`;
            qrImg.onload = () => { if (qrLoading) qrLoading.style.display = 'none'; };
            qrImg.onerror = () => { if (qrLoading) qrLoading.innerHTML = '<span style="color:#ef4444;">Không thể tải QR</span>'; };
            qrImg.src = qrUrl;
          }

          modal?.classList.add('active');
          form.reset();
          builder.calculateSummary();

          // Kích hoạt đối soát tự động
          startSepayPolling(cleanCode, s.total, () => {
            showSuccessView('ĐÃ NHẬN THANH TOÁN THÀNH CÔNG! 🎉');
          });

        } else {
          throw new Error('Không thể gửi đơn hàng.');
        }
      } catch (err) {
        console.error('Send order error:', err);
        alert('Xin lỗi, đơn hàng chưa được gửi. Vui lòng kiểm tra kết nối và thử lại sau.');
      } finally {
        isSubmittingOrder = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  window.LauNhaOrder = {
    init: initOrderEvents,
    closeModal,
    showSuccessView,
    generateIdempotencyKey
  };
})(window);
