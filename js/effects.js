/**
 * Lau Nha - UI Effects Module (js/effects.js)
 * Xử lý hiệu ứng giao diện: 3D Tilt Hero, Đồng hồ đếm ngược Flash Sale, FAQ Accordion và Thanh đặt hàng di động
 */

(function(window) {
  'use strict';

  function init3DTiltHero() {
    const container = document.getElementById('hero3dContainer');
    const dish = document.getElementById('hero3dDish');
    const floatingCards = document.querySelectorAll('.floating-card');
    if (!container || !dish) return;

    let bounds;
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;
    let isHovered = false;

    function updateBounds() {
      bounds = container.getBoundingClientRect();
    }
    updateBounds();
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, { passive: true });

    container.addEventListener('mouseenter', () => {
      isHovered = true;
      dish.style.transition = 'none';
      floatingCards.forEach(card => card.style.transition = 'none');
    });

    container.addEventListener('mousemove', e => {
      if (!bounds) updateBounds();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      mouseX = (x / bounds.width - 0.5) * 2;
      mouseY = (y / bounds.height - 0.5) * 2;
    });

    container.addEventListener('mouseleave', () => {
      isHovered = false;
      mouseX = 0;
      mouseY = 0;
      dish.style.transition = 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)';
      floatingCards.forEach(card => card.style.transition = 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)');
    });

    function renderLoop() {
      currentX += (mouseX - currentX) * 0.1;
      currentY += (mouseY - currentY) * 0.1;

      const rotateX = -currentY * 18;
      const rotateY = currentX * 22;

      dish.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      floatingCards.forEach(card => {
        const depth = parseFloat(card.dataset.depth) || 20;
        const moveX = currentX * depth;
        const moveY = currentY * depth;
        card.style.transform = `translate3d(${moveX}px, ${moveY}px, ${depth * 1.5}px) rotateX(${rotateX * 0.5}deg) rotateY(${rotateY * 0.5}deg)`;
      });

      requestAnimationFrame(renderLoop);
    }
    renderLoop();
  }

  function initCountdownTimer() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;

    let timeRemaining = 15 * 60 - 1; // 14:59
    setInterval(() => {
      if (timeRemaining <= 0) {
        timeRemaining = 15 * 60;
      }
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      timeRemaining--;
    }, 1000);
  }

  function initFaqAndAccordion() {
    document.addEventListener('click', e => {
      // FAQ Accordion
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

      // Step Accordion Header
      const header = e.target.closest('.step-accordion-header');
      if (header) {
        const card = header.closest('.step-card');
        if (card) card.classList.toggle('active');
      }
    });
  }

  function initAllEffects() {
    init3DTiltHero();
    initCountdownTimer();
    initFaqAndAccordion();
  }

  window.LauNhaEffects = {
    init: initAllEffects
  };
})(window);
