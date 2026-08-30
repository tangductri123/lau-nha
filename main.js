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
  const subtotal=items.reduce((s,i)=>s+i.qty*i.price,0),discount=subtotal?50000:0,stoveFee=stove?.checked&&subtotal<399000?50000:0,total=Math.max(0,subtotal+stoveFee-discount),list=document.getElementById('summaryItemList');
  if(list){list.innerHTML=items.length?items.map(i=>`<div class="summary-line summary-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.24);gap:14px;width:100%;margin:0;"><div style="display:flex;flex-direction:column;min-width:0;line-height:1.4;"><span style="font-weight:800;font-size:14px;color:#fff;overflow-wrap:anywhere;">${esc(i.name)}</span><span style="font-size:12px;color:#f0f0f0;margin-top:3px;">Đơn giá: ${money(i.price)} × ${i.qty}</span></div><span style="font-weight:900;font-size:15px;color:#fff;text-align:right;white-space:nowrap;margin-left:auto;flex-shrink:0;">${money(i.qty*i.price)}</span></div>`).join(''):'<p class="summary-empty">Chưa có món nào được chọn.</p>';list.style.setProperty('font-family',sans,'important');list.querySelectorAll(':not(i):not([class*="fa-"])').forEach(el=>el.style.setProperty('font-family',sans,'important'));}
  const sub=document.getElementById('summarySubtotal');if(sub)sub.textContent=money(subtotal);
  const d=document.getElementById('summaryDiscount');if(d)d.textContent=discount?`-${money(discount)} Khai trương`:'0đ';
  const f=document.getElementById('summaryStoveFee');if(f)f.textContent=stove?.checked?(stoveFee?money(stoveFee):'0đ (miễn phí)'):'Không mượn bếp';
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
  const isStove = Boolean(stove?.checked);
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
   const codeDigits = codeUpper.replace(/[^0-9]/g, '');

   sepayPollTimer = setInterval(async () => {
     try {
       let paid = false;
       
       // 1. Try serverless backend proxy first
       try {
         const res = await fetch(`/api/check-payment?code=${encodeURIComponent(codeUpper)}&amount=${totalAmount}`);
         if (res.ok) {
           const data = await res.json();
           if (data && data.paid) paid = true;
         }
       } catch (_) {}

       // 2. Direct SePay API check (works in local preview, static hosting, or fallback)
       if (!paid) {
         try {
           const directRes = await fetch(`https://my.sepay.vn/userapi/transactions/list?account_number=${SEPAY_CONFIG.acc}&limit=20`, {
             headers: {
               'Authorization': `Bearer ${SEPAY_CONFIG.token}`,
               'Content-Type': 'application/json'
             }
           });
           if (directRes.ok) {
             const d = await directRes.json();
             const txs = d?.transactions || [];
             const match = txs.find(tx => {
               const c = String(tx.transaction_content || '').toUpperCase();
               const a = parseFloat(tx.amount_in || 0);
               const hasCode = (codeUpper && c.includes(codeUpper)) || (codeDigits && codeDigits.length >= 4 && c.includes(codeDigits));
               return hasCode && a > 0;
             });
             if (match) paid = true;
           }
         } catch (directErr) {
           console.warn('Direct SePay API poll failed:', directErr);
         }
       }

       if (paid) {
         clearInterval(sepayPollTimer);
         sepayPollTimer = null;
         onPaid();
       }
     } catch (e) {
       console.warn('SePay polling check:', e);
     }
   }, 2500);
 }

 summary();
 if (!form) return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const value=id=>(document.getElementById(id)?.value||'').trim(),name=value('custName'),phone=value('custPhone'),email=value('custEmail'),address=value('custAddress'),s=summary();
    if(!name||!phone||!address)return alert('Vui lòng điền họ tên, số điện thoại và địa chỉ.');
    if(!s.items.length)return alert('Vui lòng chọn ít nhất một món hoặc một set.');
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    try{
      const orderCodeNum = Math.floor(1000 + Math.random() * 9000);
      const orderCode=`LN${orderCodeNum}`;
      const stoveIncluded=Boolean(stove?.checked);
      const isFileProtocol=window.location.protocol==='file:';
      let success=false, displayedCode=orderCode;

      if(!isFileProtocol){
        try{
          const endpoint=new URL('/api/send-order',document.baseURI).toString();
          const r=await fetch(endpoint,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({cust_name:name,cust_phone:phone,cust_email:email,cust_address:address,order_code:orderCode,items:s.items,stove_included:stoveIncluded})
          });
          const result=await r.json().catch(()=>({}));
          if(r.ok&&result.success){
            success=true;
            displayedCode=result.order_code||result.orderId||orderCode;
          }
        }catch(netErr){
          console.warn('API endpoint failed, attempting direct Google Sheet fallback...',netErr);
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

 // Auto-shrink Google Survey Form on submit
 const surveyIframe=document.getElementById('googleSurveyFrame');
 if(surveyIframe){
  let loadCount=0;
  surveyIframe.addEventListener('load',()=>{
   loadCount++;
   if(loadCount>1){
    surveyIframe.classList.add('submitted');
    const wrapper=document.getElementById('surveyWrapper');
    if(wrapper)wrapper.classList.add('submitted');
    surveyIframe.style.setProperty('height','380px','important');
    const surveySection=document.getElementById('survey-section');
    if(surveySection){
     surveySection.scrollIntoView({behavior:'smooth',block:'center'});
    }
   }
  });
 }
});