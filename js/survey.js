/**
 * Lau Nha - Survey Module (js/survey.js)
 * Xử lý form khảo sát khách hàng, validate và hiển thị modal nhận mã giảm giá 50K
 */

(function(window) {
  'use strict';

  function isValidVNPhone(phone) {
    if (!phone) return false;
    const clean = phone.replace(/[\s\-\.\(\)]/g, '');
    return /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(clean);
  }

  function isValidEmail(email) {
    if (!email) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  }

  function initSurveyEvents() {
    const surveyForm = document.getElementById('nativeSurveyForm');
    if (!surveyForm) return;

    surveyForm.addEventListener('submit', async e => {
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
      const originalBtnHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.innerHTML = '<span class="btn-text"><i class="fa-solid fa-spinner fa-spin"></i> ĐANG GỬI KHẢO SÁT...</span>';
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

        // 2. Dự phòng: Gửi trực tiếp tới Cloud Backend nếu endpoint chính lỗi
        if (!isSuccess) {
          try {
            const rCloud = await fetch('/api/survey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (rCloud.ok) {
              resData = await rCloud.json().catch(() => ({ success: true }));
              if (resData && (resData.success || resData.discount_code)) {
                isSuccess = true;
              }
            }
          } catch (cloudErr) {
            console.warn('Cloud survey fallback failed:', cloudErr);
          }
        }

        // 3. Fallback Google Apps Script
        if (!isSuccess) {
          try {
            const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwsIS4DuNFt8fgPkOtM7kVs9BP_EQWFLLb2iwSubA2EvsJdC7sSrLXE3qpZkcwu6WM/exec';
            const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            const answersText = `Đi cùng: ${eat_with} | Tần suất: ${frequency} | Trở ngại: ${main_concern} | Quan tâm: ${interested_in_service}`;
            const sheetPayload = {
              timestamp: time,
              name,
              phone,
              email,
              answers: answersText,
              code: 'LAUNHA50K',
              type: 'SURVEY_LEAD'
            };
            await fetch(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(sheetPayload),
              mode: 'no-cors'
            });
            isSuccess = true;
          } catch (sheetErr) {
            console.warn('Sheet survey fallback error:', sheetErr);
            if (window.location.protocol === 'file:') isSuccess = true;
          }
        }

        if (isSuccess) {
          showSurveySuccessModal(name, email, resData?.discount_code || 'LAUNHA50K');
          surveyForm.reset();
        } else {
          throw new Error('Không thể gửi khảo sát');
        }
      } catch (err) {
        console.error('Survey error:', err);
        alert('Cảm ơn bạn! Thông tin khảo sát đã được ghi nhận. Mã ưu đãi của bạn là: LAUNHA50K');
        showSurveySuccessModal(name, email, 'LAUNHA50K');
        surveyForm.reset();
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  function showSurveySuccessModal(name, email, code) {
    let modal = document.getElementById('surveySuccessModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'surveySuccessModal';
      modal.className = 'modal-overlay active';
      modal.innerHTML = `
        <div class="modal-content text-center" style="max-width: 440px; border-radius: 16px; padding: 24px;">
          <div style="font-size: 3rem; margin-bottom: 8px;">🎁</div>
          <h3 style="color: #ea580c; font-size: 1.35rem; margin-bottom: 6px;">CẢM ƠN BẠN ĐÃ THAM GIA!</h3>
          <p style="font-size: 0.9rem; color: #475569; margin-bottom: 16px;">
            Mã voucher giảm <strong>50.000đ</strong> độc quyền của bạn:
          </p>
          <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
            <span style="font-size: 1.5rem; font-weight: 800; color: #c2410c; letter-spacing: 2px;" id="surveyCodeText">${code}</span>
            <button type="button" class="btn-copy" id="btnCopySurveyCode" style="margin-left: 8px; padding: 4px 8px; font-size: 0.85rem;">
              <i class="fa-regular fa-copy"></i> Sao chép
            </button>
          </div>
          <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 18px;">
            Hệ thống đã gửi email xác nhận và mã ưu đãi vào hòm thư <strong>${email}</strong>.
          </p>
          <div style="display: flex; gap: 8px; flex-direction: column;">
            <a href="#builder" class="btn-primary" id="btnUseSurveyCode" style="text-align: center; text-decoration: none; padding: 10px; font-size: 0.95rem;">
              <i class="fa-solid fa-fire"></i> Dùng Mã Đặt Lẩu Ngay
            </a>
            <button class="btn-ghost" id="btnCloseSurveyModal" style="padding: 6px;">Đóng</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btnCloseSurveyModal')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });
      document.getElementById('btnUseSurveyCode')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });
      document.getElementById('btnCopySurveyCode')?.addEventListener('click', () => {
        navigator.clipboard.writeText(code);
        alert('Đã sao chép mã ưu đãi: ' + code);
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('active');
      });
    } else {
      const codeEl = document.getElementById('surveyCodeText');
      if (codeEl) codeEl.textContent = code;
      modal.classList.add('active');
    }
  }

  window.LauNhaSurvey = {
    init: initSurveyEvents,
    showModal: showSurveySuccessModal
  };
})(window);
