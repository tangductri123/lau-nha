/**
 * Lau Nha - Main Coordinator (main.js)
 * Khởi tạo và điều phối các module: Builder, Order, Survey, Effects
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // 1. Khởi tạo hiệu ứng giao diện (3D Tilt, Countdown, FAQ)
  if (window.LauNhaEffects && typeof window.LauNhaEffects.init === 'function') {
    window.LauNhaEffects.init();
  }

  // 2. Khởi tạo bộ tính giá & định lượng set lẩu
  if (window.LauNhaBuilder && typeof window.LauNhaBuilder.init === 'function') {
    window.LauNhaBuilder.init();
  }

  // 3. Khởi tạo form khảo sát nhận voucher
  if (window.LauNhaSurvey && typeof window.LauNhaSurvey.init === 'function') {
    window.LauNhaSurvey.init();
  }

  // 4. Khởi tạo form đặt hàng & đối soát SePay
  if (window.LauNhaOrder && typeof window.LauNhaOrder.init === 'function') {
    window.LauNhaOrder.init();
  }

  console.log('🍜 Lẩu Nhà Web Client Initialized (Modular v2026.09)');
});
