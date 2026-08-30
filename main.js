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
  const t=document.getElementById('totalPrice');if(t)t.textContent=money(total);return{items,subtotal,discount,stoveFee,total};
 }
 function setQty(i,n){i.value=Math.max(0,n);const b=document.getElementById(`badge-${i.id}`);if(b){b.textContent=i.value;b.classList.toggle('has-count',n>0)}}
 document.addEventListener('click',e=>{const b=e.target.closest('.btn-minus,.btn-plus');if(b){e.preventDefault();const i=document.getElementById(b.dataset.target);if(i){setQty(i,(parseInt(i.value,10)||0)+(b.classList.contains('btn-plus')?1:-1));summary()}return}const card=e.target.closest('.set-card');if(card&&!e.target.closest('button,input,a')){const i=card.querySelector('.item-qty');if(i){inputs().forEach(x=>{if(x!==i)setQty(x,0)});setQty(i,1);summary()}}});
 document.addEventListener('change',e=>{if(e.target.matches('.item-qty,#addonStove'))summary()});
 const close=()=>modal?.classList.remove('active');document.getElementById('closeModal')?.addEventListener('click',close);modal?.addEventListener('click',e=>{if(e.target===modal)close()});summary();if(!form)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const value=id=>(document.getElementById(id)?.value||'').trim(),name=value('custName'),phone=value('custPhone'),email=value('custEmail'),address=value('custAddress'),s=summary();
    if(!name||!phone||!address)return alert('Vui lòng điền họ tên, số điện thoại và địa chỉ.');
    if(!s.items.length)return alert('Vui lòng chọn ít nhất một món hoặc một set.');
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    try{
      const orderCode=`LN-${Math.floor(1000+Math.random()*9000)}`;
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
        const SCRIPT_URL='https://script.google.com/macros/s/AKfycbz9OuRDjpTp1KwfRUwuY6cDVwFTBqLx8oh2GhnXysSY5gDE79Jjdp9Em_soQAvTSnLZ/exec';
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
          // Still treat as success if on local file preview
          if(isFileProtocol) success=true;
        }
      }

      if(success){
        const cleanCode=String(displayedCode).replace(/^[#\s]+LN-+/i,'').replace(/^LN-+/i,'').trim();
        document.getElementById('modalName').textContent=name;
        document.getElementById('modalAddress').textContent=address;
        const codeElement=document.getElementById('modalOrderCode')||document.getElementById('orderCodeDisplay')||document.getElementById('orderCode');
        if(codeElement)codeElement.textContent=`Mã đơn hàng: #LN-${cleanCode||orderCode.replace(/^LN-/,'')}`;
        modal?.classList.add('active');
        form.reset();
        summary();
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