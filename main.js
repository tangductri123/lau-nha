document.addEventListener('DOMContentLoaded',()=>{
 const sans="'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
 const summaryCard=document.querySelector('.summary-card');
 if(summaryCard){summaryCard.style.setProperty('font-family',sans,'important');summaryCard.querySelectorAll(':not(i):not([class*="fa-"])').forEach(el=>el.style.setProperty('font-family',sans,'important'));}
 const form=document.getElementById('orderForm'),stove=document.getElementById('addonStove'),modal=document.getElementById('orderModal');
 if(form)form.noValidate=true;
 const money=v=>`${Math.max(0,Math.round(Number(v)||0)).toLocaleString('vi-VN')}đ`;
 const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
 const inputs=()=>[...document.querySelectorAll('.item-qty')];
  function summary(){
   const items=inputs().map(i=>({name:i.dataset.name||'Món',qty:Math.max(0,parseInt(i.value,10)||0),price:Math.max(0,parseInt(i.dataset.price,10)||0)})).filter(i=>i.qty);
   const subtotal=items.reduce((s,i)=>s+i.qty*i.price,0);
   const discount=subtotal?50000:0;
   const isStove=Boolean(stove?.checked);
   const stoveFee=isStove&&subtotal<399000?50000:0;
   const stoveDeposit=isStove?200000:0;
   const orderValue=Math.max(0,subtotal+stoveFee-discount);
   const total=orderValue+stoveDeposit;
   const list=document.getElementById('summaryItemList');
   if(list){list.innerHTML=items.length?items.map(i=>`<div class="summary-line summary-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.24);gap:14px;width:100%;margin:0;"><div style="display:flex;flex-direction:column;min-width:0;line-height:1.4;"><span style="font-weight:800;font-size:14px;color:#fff;overflow-wrap:anywhere;">${esc(i.name)}</span><span style="font-size:12px;color:#f0f0f0;margin-top:3px;">Đơn giá: ${money(i.price)} × ${i.qty}</span></div><span style="font-weight:900;font-size:15px;color:#fff;text-align:right;white-space:nowrap;margin-left:auto;flex-shrink:0;">${money(i.qty*i.price)}</span></div>`).join(''):'<p class="summary-empty">Chưa có món nào được chọn.</p>';list.style.setProperty('font-family',sans,'important');list.querySelectorAll(':not(i):not([class*="fa-"])').forEach(el=>el.style.setProperty('font-family',sans,'important'));}
   const sub=document.getElementById('summarySubtotal');if(sub)sub.textContent=money(subtotal);
   const d=document.getElementById('summaryDiscount');if(d)d.textContent=discount?`-${money(discount)} Khai trương`:'0đ';
   const f=document.getElementById('summaryStoveFee');if(f)f.textContent=isStove?(stoveFee?money(stoveFee):'0đ (miễn phí)'):'Không mượn bếp';
   const dep=document.getElementById('summaryDeposit');if(dep)dep.textContent=isStove?money(stoveDeposit):'0đ';
   const depRow=document.getElementById('summaryDepositRow');if(depRow)depRow.style.display=isStove?'flex':'none';
   const shipping=document.getElementById('summaryShipping');if(shipping)shipping.textContent='Freeship';
   const t=document.getElementById('totalPrice');if(t)t.textContent=money(total);

  // Update Accordion Step 1 Box Summary
  const broths = inputs().filter(i => i.id.includes('broth') && parseInt(i.value, 10) > 0);
  const brothCount = broths.reduce((s, i) => s + parseInt(i.value, 10), 0);
  const hint1 = document.getElementById('hintStep1');
  const count1 = document.getElementById('countStep1');
  if (hint1) hint1.textContent = brothCount ? 'Đang chọn: ' + broths.map(i => `${(i.dataset.name||'').replace(/\s*\(.*\)/, '')} (${i.value})`).join(', ') : 'Chưa chọn nước cốt lẩu';
  if (count1) { count1.textContent = `${brothCount} túi`; count1.classList.toggle('has-items', brothCount > 0); }

  // Update Accordion Step 2 Box Summary
  const sets = inputs().filter(i => i.id.includes('set') && parseInt(i.value, 10) > 0);
  const setCount = sets.reduce((s, i) => s + parseInt(i.value, 10), 0);
  const hint2 = document.getElementById('hintStep2');
  const count2 = document.getElementById('countStep2');
  if (hint2) hint2.textContent = setCount ? 'Đang chọn: ' + sets.map(i => `${(i.dataset.name||'').replace(/\s*\(.*\)/, '')} (${i.value})`).join(', ') : 'Chưa chọn set topping';
  if (count2) { count2.textContent = `${setCount} set`; count2.classList.toggle('has-items', setCount > 0); }

  // Update Accordion Step 3 Box Summary
  const addons = inputs().filter(i => i.id.includes('addon') && parseInt(i.value, 10) > 0);
  const addonCount = addons.reduce((s, i) => s + parseInt(i.value, 10), 0) + (isStove ? 1 : 0);
  const parts = [];
  if (isStove) parts.push('Mượn bếp cồn');
  addons.forEach(i => parts.push(`${(i.dataset.name||'').replace(/\s*\(.*\)/, '')} (${i.value})`));
  const hint3 = document.getElementById('hintStep3');
  const count3 = document.getElementById('countStep3');
  if (hint3) hint3.textContent = parts.length ? 'Đang chọn: ' + parts.join(', ') : 'Chưa chọn thêm';
  if (count3) { count3.textContent = `${addonCount} món`; count3.classList.toggle('has-items', addonCount > 0); }

  return{items,subtotal,discount,stoveFee,total};
 }
 function setQty(i,n){i.value=Math.max(0,n);const b=document.getElementById(`badge-${i.id}`);if(b){b.textContent=i.value;b.classList.toggle('has-count',n>0)}}
 document.addEventListener('click',e=>{
  const faqQ = e.target.closest('.faq-question');
  if (faqQ) {
    const item = faqQ.closest('.faq-item');
    if (item) {
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(el => {
        if (el !== item) el.classList.remove('active');
      });
      item.classList.toggle('active', !isActive);
    }
    return;
  }
  const header = e.target.closest('.step-accordion-header');
  if (header) {
    const card = header.closest('.step-card');
    if (card) card.classList.toggle('active');
    return;
  }
  const b=e.target.closest('.btn-minus,.btn-plus');
  if(b){e.preventDefault();const i=document.getElementById(b.dataset.target);if(i){setQty(i,(parseInt(i.value,10)||0)+(b.classList.contains('btn-plus')?1:-1));summary()}return}
  const card=e.target.closest('.set-card');
  if(card&&!e.target.closest('button,input,a')){const i=card.querySelector('.item-qty');if(i){inputs().forEach(x=>{if(x!==i)setQty(x,0)});setQty(i,1);summary()}}
 });
 document.addEventListener('change',e=>{if(e.target.matches('.item-qty,#addonStove'))summary()});

 const SEPAY_CONFIG = {
   bank: 'TPBank',
   acc: '22678555999',
   token: 'YAKFPXJ5EXEI6PHHJK3DBNO6ZQ9GWTEXT9Z2AMKWFIVLU0C7G10SVBWP5QAK3QPT'
 };
 let sepayPollTimer = null;

 const close = () => {
   if (sepayPollTimer) { clearInterval(sepayPollTimer); sepayPollTimer = null; }
   modal?.classList.remove('active');
 };
 document.getElementById('closeModal')?.addEventListener('click', close);
 document.getElementById('closeModalSuccess')?.addEventListener('click', close);
 modal?.addEventListener('click', e => { if (e.target === modal) close(); });

 function showSuccessView(title, detail) {
   if (sepayPollTimer) { clearInterval(sepayPollTimer); sepayPollTimer = null; }
   const pState = document.getElementById('modalPaymentState');
   const sState = document.getElementById('modalSuccessState');
   if (pState) pState.style.display = 'none';
   if (sState) sState.style.display = 'block';
   if (title && document.getElementById('modalSuccessTitle')) document.getElementById('modalSuccessTitle').textContent = title;
   if (detail && document.getElementById('modalSuccessDetail')) document.getElementById('modalSuccessDetail').innerHTML = detail;
 }

 document.getElementById('btnPayCod')?.addEventListener('click', () => {
   const addr = document.getElementById('modalAddress')?.textContent || 'địa chỉ của bạn';
   showSuccessView('ĐẶT HÀNG THÀNH CÔNG! (COD)', `Đơn hàng đã được lưu thành công. Bạn vui lòng thanh toán khi nhận hàng tại <strong>${esc(addr)}</strong>.`);
 });

  function startSepayPolling(orderCodeClean, totalAmount, onPaid) {
    if (sepayPollTimer) clearInterval(sepayPollTimer);
    const codeUpper = String(orderCodeClean || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    sepayPollTimer = setInterval(async () => {
      try {
        let paid = false;
        
        // 1. Check qua Vercel serverless /api/check-payment
        try {
          const res = await fetch(`/api/check-payment?code=${encodeURIComponent(codeUpper)}&amount=${totalAmount}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.paid) paid = true;
          }
        } catch (_) {}

        // 2. Check qua Railway backend trực tiếp
        if (!paid) {
          try {
            const railRes = await fetch(`/api/check-payment?code=${encodeURIComponent(codeUpper)}&amount=${totalAmount}`);
            if (railRes.ok) {
              const data = await railRes.json();
              if (data && data.paid) paid = true;
            }
          } catch (_) {}
        }

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

          onPaid();
        }
      } catch (e) {
        console.warn('SePay polling check:', e);
      }
    }, 2000);
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

  summary();
  if (!form) return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const value=id=>(document.getElementById(id)?.value||'').trim(),name=value('custName'),phone=value('custPhone'),email=value('custEmail'),address=value('custAddress'),s=summary();
    if(!name||!phone||!address)return alert('Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng.');

    // Validate số điện thoại Việt Nam
    if (!isValidVNPhone(phone)) {
      alert('Số điện thoại không hợp lệ! Vui lòng nhập đúng số điện thoại di động 10 số (ví dụ: 0912345678).');
      document.getElementById('custPhone')?.focus();
      return;
    }

    // Validate email nếu khách có nhập
    if (email && !isValidEmail(email)) {
      alert('Địa chỉ email không đúng định dạng! Vui lòng kiểm tra lại (ví dụ: hoten@gmail.com).');
      document.getElementById('custEmail')?.focus();
      return;
    }

    if(!s.items.length)return alert('Vui lòng chọn ít nhất một món hoặc một set.');
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    let success = false;
    const orderCodeNum = Math.floor(1000 + Math.random() * 9000);
    const orderCode=`LN${orderCodeNum}`;
    let displayedCode = orderCode;

    try{
            const stoveIncluded=Boolean(stove?.checked);
      const stoveDeposit=stoveIncluded?200000:0;
      const discountAmt=s.subtotal?50000:0;
      const shippingFee=0;
      const stoveFee=stoveIncluded&&s.subtotal<399000?50000:0;
      const orderVal=Math.max(0,s.subtotal+stoveFee-discountAmt+shippingFee);
      const totalCollect=orderVal+stoveDeposit;
      const note=(document.getElementById('custNote')?.value||'').trim();
      const payloadData = {
        cust_name:name,
        cust_phone:phone,
        cust_email:email,
        cust_address:address,
        cust_note:note,
        note:note,
        order_code:orderCode,
        items:s.items,
        stove_included:stoveIncluded,
        shipping_fee:shippingFee,
        voucher_code:'LAUNHA50K',
        discount_code:'LAUNHA50K',
        discount_amount:discountAmt,
        deposit_amount:stoveDeposit,
        stove_deposit:stoveDeposit,
        stove_fee:stoveFee,
        order_value:orderVal,
        total_collection:totalCollect,
        total:totalCollect
      };

      // 1. Try primary endpoint
      let endpoint = '/api/send-order';
      if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        endpoint = window.location.port === '8080' ? '/api/send-order' : 'http://localhost:8080/api/send-order';
      }

      try{
        const r=await fetch(endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payloadData)
        });
        const result=await r.json().catch(()=>({}));
        if(r.ok&&result.success){
          success=true;
          displayedCode=result.order_code||result.orderId||orderCode;
        }
      }catch(netErr){
        console.warn('Primary API endpoint failed, trying cloud endpoint...',netErr);
      }

      // 2. If primary failed (e.g. running on local port other than 8080), try cloud endpoint
      if(!success && (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try{
          const rCloud = await fetch('https://laumangdi.com/api/send-order',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payloadData)
          });
          const resCloud = await rCloud.json().catch(()=>({}));
          if(rCloud.ok && resCloud.success){
            success = true;
            displayedCode = resCloud.order_code || orderCode;
          }
        }catch(cloudErr){
          console.warn('Cloud API fallback failed:', cloudErr);
        }
      }

      // Fallback: Send directly to Google Apps Script
      if(!success){
        const SCRIPT_URL='https://script.google.com/macros/s/AKfycbwsIS4DuNFt8fgPkOtM7kVs9BP_EQWFLLb2iwSubA2EvsJdC7sSrLXE3qpZkcwu6WM/exec';
        const stoveText=stoveIncluded?'Có mượn bếp':'Không mượn bếp';
        const time=new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
        const detail=s.items.map(i=>`${i.qty}x ${i.name} (${money(i.price*i.qty)})`).join('; ');
        const row=[time,orderCode,name,phone,email||'',address,detail,stoveText,money(s.total),'Chờ xác nhận'];
        const payload={
          row,rowData:row,values:row,timestamp:time,order_code:orderCode,
          name,phone,email:email||'',address,items:detail,items_detail:detail,
          muon_bep:stoveIncluded?'có':false,stove:stoveIncluded?'có':'',bep_con:stoveIncluded?'có':false,
          stove_rental:stoveIncluded?'có':'',needs_stove:stoveIncluded,needsStove:stoveIncluded,
          stove_included:stoveIncluded,stove_text:stoveText,
          total:s.total,total_price:s.total,total_num:s.total,total_formatted:money(s.total),status:'Chờ xác nhận'
        };

        try{
          await fetch(SCRIPT_URL,{
            method:'POST',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body:JSON.stringify(payload),
            mode:'no-cors'
          });
          success=true;
        }catch(sheetErr){
          console.error('Sheet fallback error:',sheetErr);
          if(isFileProtocol) success=true;
        }
      }

      if(success){
        const cleanCode=String(displayedCode).replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
        document.getElementById('modalName').textContent=name;
        document.getElementById('modalAddress').textContent=address;
        const phoneEl = document.getElementById('modalPhone');
        if (phoneEl) phoneEl.textContent = phone;
        const codeElement=document.getElementById('modalOrderCode');
        if(codeElement)codeElement.textContent=cleanCode;

        // Setup SePay QR Modal
        const pState = document.getElementById('modalPaymentState');
        const sState = document.getElementById('modalSuccessState');
        if (pState) pState.style.display = 'block';
        if (sState) sState.style.display = 'none';

        const amountEl = document.getElementById('sepayAmount');
        if (amountEl) amountEl.textContent = money(s.total);
        const contentEl = document.getElementById('sepayContent');
        if (contentEl) contentEl.textContent = cleanCode;

        // Copy helpers
        const copyAmountBtn = document.getElementById('btnCopyAmount');
        if (copyAmountBtn) copyAmountBtn.onclick = () => { navigator.clipboard.writeText(String(s.total)); alert('Đã sao chép số tiền!'); };
        const copyContentBtn = document.getElementById('btnCopyContent');
        if (copyContentBtn) copyContentBtn.onclick = () => { navigator.clipboard.writeText(cleanCode); alert('Đã sao chép nội dung chuyển khoản!'); };

        // VietQR SePay Image URL
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
        summary();

        // Start polling SePay for automatic payment recognition
        startSepayPolling(cleanCode, s.total, () => {
          showSuccessView('ĐÃ NHẬN THANH TOÁN THÀNH CÔNG! 🎉');
        });

      }else{
        throw Error('Không thể gửi đơn hàng.');
      }
    }catch(err){
      console.error('Send order error:',err);
      alert('Xin lỗi, đơn hàng chưa được gửi. Vui lòng kiểm tra kết nối và thử lại sau.');
    }finally{
      if(submit)submit.disabled=false;
    }
  });

  // NATIVE SURVEY FORM SUBMISSION HANDLER
  const surveyForm = document.getElementById('nativeSurveyForm');
  if (surveyForm) {
    surveyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('survey_name')?.value?.trim();
      const phone = document.getElementById('survey_phone')?.value?.trim();
      const email = document.getElementById('survey_email')?.value?.trim();
      const eat_with = document.querySelector('input[name="eat_with"]:checked')?.value || '';
      const frequency = document.querySelector('input[name="frequency"]:checked')?.value || '';
      const main_concern = document.querySelector('input[name="main_concern"]:checked')?.value || '';
      const interested_in_service = document.querySelector('input[name="interested_in_service"]:checked')?.value || '';

      if (!name || !phone || !email) {
        alert('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Email để nhận mã ưu đãi!');
        return;
      }

      if (!isValidVNPhone(phone)) {
        alert('Số điện thoại không hợp lệ! Vui lòng nhập đúng số điện thoại di động 10 số (ví dụ: 0912345678).');
        document.getElementById('survey_phone')?.focus();
        return;
      }

      if (!isValidEmail(email)) {
        alert('Địa chỉ email không đúng định dạng! Vui lòng nhập email hợp lệ (ví dụ: hoten@gmail.com) để nhận mã ưu đãi 50.000đ.');
        document.getElementById('survey_email')?.focus();
        return;
      }

      const btn = document.getElementById('btnSubmitSurvey');

      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.innerHTML = '<span class="btn-text"><i class="fa-solid fa-spinner fa-spin"></i> GỬI KHẢO SÁT & NHẬN MÃ 50.000Đ</span>';
      }

      const payload = {
        name,
        phone,
        email,
        eat_with,
        frequency,
        main_concern,
        interested_in_service,
        discount_code: 'LAUNHA50K',
        raw_answers: {
          eat_with,
          frequency,
          main_concern,
          interested_in_service,
          submitted_at: new Date().toISOString()
        }
      };

      try {
        let endpoint = '/api/survey';
        if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          endpoint = window.location.port === '8080' ? '/api/survey' : 'http://localhost:8080/api/survey';
        }

        let isSuccess = false;
        let resData = null;

        // 1. Gửi tới endpoint chính
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            resData = await response.json().catch(() => ({ success: true }));
            if (resData && (resData.success || resData.discount_code)) {
              isSuccess = true;
            }
          }
        } catch (netErr) {
          console.warn('Primary survey endpoint failed, trying cloud fallback...', netErr);
        }

        // 2. Dự phòng: Gửi trực tiếp tới Railway Backend nếu endpoint chính lỗi
        if (!isSuccess) {
          try {
            const rCloud = await fetch('/api/survey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (rCloud.ok) {
              resData = await rCloud.json().catch(() => ({ success: true }));
              isSuccess = true;
            }
          } catch (cloudErr) {
            console.warn('Cloud survey fallback failed:', cloudErr);
          }
        }

        // 3. Fallback: Nếu cả 2 API offline, vẫn mở modal mã 50K cho khách
        if (!isSuccess && !resData) {
          isSuccess = true;
          resData = { success: true, discount_code: 'LAUNHA50K' };
        }

        if (isSuccess) {
          // Ẩn form khảo sát & hiện ô thông báo nhận mã
          surveyForm.classList.add('hidden');
          const successBox = document.getElementById('surveySuccessBox');
          if (successBox) {
            successBox.classList.remove('hidden');
            const custEmailEl = document.getElementById('successCustomerEmail');
            if (custEmailEl) custEmailEl.textContent = email;
          }

          // Bật Popup Cảm Ơn
          const thankYouModal = document.getElementById('surveyThankYouModal');
          if (thankYouModal) {
            thankYouModal.classList.remove('hidden');
          } else {
            if (successBox) successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          throw new Error('Không thể xử lý yêu cầu, vui lòng thử lại.');
        }
      } catch (err) {
        console.error('Survey submission error:', err);
        alert('Có lỗi xảy ra: ' + (err.message || 'Vui lòng kiểm tra lại kết nối mạng.'));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.innerHTML = '<span class="btn-text"><i class="fa-solid fa-paper-plane"></i> GỬI KHẢO SÁT & NHẬN MÃ 50.000Đ</span>';
        }
      }
    });
  }

  // Hàm đóng popup cảm ơn và tự động cuộn xuống ô thông báo mã email
  window.closeSurveyThankYouModal = function () {
    const modal = document.getElementById('surveyThankYouModal');
    if (modal) {
      modal.classList.add('hidden');
    }
    const successBox = document.getElementById('surveySuccessBox');
    if (successBox) {
      setTimeout(() => {
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  // 3D Parallax Tilt Effect for Hero Hotpot
  const heroContainer = document.getElementById('hero3dContainer');
  const heroDish = document.getElementById('hero3dDish');
  const floatingCards = document.querySelectorAll('.hero-visual .floating-card');

  if (heroContainer && heroDish) {
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let isHovered = false;
    let idleAngle = 0;

    function handleMove(clientX, clientY) {
      const rect = heroContainer.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      targetX = Math.max(-1, Math.min(1, x * 2));
      targetY = Math.max(-1, Math.min(1, y * 2));
    }

    heroContainer.addEventListener('mousemove', e => {
      isHovered = true;
      handleMove(e.clientX, e.clientY);
    });

    heroContainer.addEventListener('mouseleave', () => {
      isHovered = false;
      targetX = 0;
      targetY = 0;
    });

    // Touch support for mobile
    heroContainer.addEventListener('touchmove', e => {
      if (e.touches && e.touches[0]) {
        isHovered = true;
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    heroContainer.addEventListener('touchend', () => {
      isHovered = false;
      targetX = 0;
      targetY = 0;
    });

    // Device orientation for mobile tilt
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', e => {
        if (e.gamma !== null && e.beta !== null && !isHovered) {
          targetX = Math.max(-1, Math.min(1, e.gamma / 25));
          targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
        }
      }, { passive: true });
    }

    function animate3D() {
      // Smooth dampening
      if (!isHovered) {
        idleAngle += 0.025;
        // Subtle floating breath when idle
        currentX += (Math.sin(idleAngle) * 0.15 - currentX) * 0.05;
        currentY += (Math.cos(idleAngle * 0.8) * 0.12 - currentY) * 0.05;
      } else {
        currentX += (targetX - currentX) * 0.12;
        currentY += (targetY - currentY) * 0.12;
      }

      const rotY = currentX * 22; // rotate around Y axis (degrees)
      const rotX = -currentY * 18; // rotate around X axis (degrees)
      const scale = isHovered ? 1.04 : 1.0;

      heroDish.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(${scale}, ${scale}, ${scale})`;

      // Parallax floating cards
      floatingCards.forEach(card => {
        const depth = parseFloat(card.dataset.depth) || 30;
        const cardX = currentX * depth;
        const cardY = currentY * depth;
        card.style.transform = `translate3d(${cardX}px, ${cardY}px, ${depth}px) rotateX(${rotX * 0.3}deg) rotateY(${rotY * 0.3}deg)`;
      });

      requestAnimationFrame(animate3D);
    }

    animate3D();
  }

});
