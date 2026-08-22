// Interactive Hotpot Customizer Logic with Quantity Controllers (+ / -) & Live Badges

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const itemQtyInputs = document.querySelectorAll('.item-qty');
    const addonStoveCheckbox = document.getElementById('addonStove');

    const summaryItemList = document.getElementById('summaryItemList');
    const summaryStoveFee = document.getElementById('summaryStoveFee');
    const stovePriceDisplay = document.getElementById('stovePriceDisplay');
    const totalPriceEl = document.getElementById('totalPrice');

    const orderForm = document.getElementById('orderForm');
    const orderModal = document.getElementById('orderModal');
    const closeModalBtn = document.getElementById('closeModal');
    const modalName = document.getElementById('modalName');
    const modalAddress = document.getElementById('modalAddress');
    const modalOrderCode = document.getElementById('modalOrderCode');

    const DISCOUNT = 50000; // 50,000 VND discount code [GIAM50K]
    const STOVE_FREE_THRESHOLD = 399000; // Free stove rental for order >= 399,000 VND

    // --- Helper: Format Currency VND ---
    function formatVND(amount) {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    }

    // --- Calculate Total & Update Order Breakdown & Badges ---
    function updateSummary() {
        let orderSubtotal = 0;
        let selectedItemsHTML = '';

        itemQtyInputs.forEach(input => {
            const qty = parseInt(input.value) || 0;
            const price = parseInt(input.getAttribute('data-price')) || 0;
            const name = input.getAttribute('data-name') || 'Món nhúng';

            // Update quantity badge right between minus and plus buttons
            const badge = document.getElementById('badge-' + input.id);
            if (badge) {
                badge.textContent = qty;
                if (qty > 0) {
                    badge.classList.add('has-count');
                } else {
                    badge.classList.remove('has-count');
                }
            }

            // Highlight parent card if quantity > 0
            const parentContent = input.closest('.broth-content') || input.closest('.set-content');
            if (parentContent) {
                if (qty > 0) {
                    parentContent.classList.add('has-qty');
                } else {
                    parentContent.classList.remove('has-qty');
                }
            }

            if (qty > 0) {
                const itemTotal = price * qty;
                orderSubtotal += itemTotal;

                selectedItemsHTML += `
                    <div class="summary-line">
                        <span><strong>${qty}x</strong> ${name}:</span>
                        <strong>${formatVND(itemTotal)}</strong>
                    </div>
                `;
            }
        });

        if (summaryItemList) {
            summaryItemList.innerHTML = selectedItemsHTML || `
                <div class="summary-line" style="color: #A0AEC0;">
                    <em>Chưa chọn món nào</em>
                </div>
            `;
        }

        // Dynamic Stove Rental Fee Logic
        let stoveFee = 0;
        let stoveFeeText = 'Không mượn bếp';

        if (addonStoveCheckbox && addonStoveCheckbox.checked) {
            if (orderSubtotal >= STOVE_FREE_THRESHOLD) {
                stoveFee = 0;
                stoveFeeText = '0đ (Free mượn bếp)';
                if (stovePriceDisplay) {
                    stovePriceDisplay.textContent = '0đ (Free mượn bếp)';
                    stovePriceDisplay.style.color = '#4ADE80';
                }
            } else {
                stoveFee = 50000;
                stoveFeeText = '50.000đ (Phí mượn bếp)';
                if (stovePriceDisplay) {
                    stovePriceDisplay.textContent = '+50.000đ (Phí mượn bếp)';
                    stovePriceDisplay.style.color = '#E9A23B';
                }
            }
        } else if (stovePriceDisplay) {
            stovePriceDisplay.textContent = 'Bấm chọn để mượn';
            stovePriceDisplay.style.color = '#D2C4BC';
        }

        // Final total price with 50K discount applied if order has items
        const appliedDiscount = orderSubtotal > 0 ? DISCOUNT : 0;
        const finalTotal = Math.max(0, orderSubtotal + stoveFee - appliedDiscount);

        if (summaryStoveFee) {
            summaryStoveFee.textContent = stoveFeeText;
            summaryStoveFee.style.color = stoveFee === 0 && addonStoveCheckbox && addonStoveCheckbox.checked ? '#4ADE80' : '#E9A23B';
        }

        if (totalPriceEl) {
            totalPriceEl.textContent = formatVND(finalTotal);
        }
    }

    // --- Global Click Event Delegation for Minus (-) and Plus (+) Buttons ---
    document.addEventListener('click', (e) => {
        const btnMinus = e.target.closest('.btn-minus');
        const btnPlus = e.target.closest('.btn-plus');

        if (btnMinus) {
            e.preventDefault();
            e.stopPropagation();
            const targetId = btnMinus.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                let currentVal = parseInt(targetInput.value) || 0;
                if (currentVal > 0) {
                    targetInput.value = currentVal - 1;
                    updateSummary();
                }
            }
        }

        if (btnPlus) {
            e.preventDefault();
            e.stopPropagation();
            const targetId = btnPlus.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                let currentVal = parseInt(targetInput.value) || 0;
                targetInput.value = currentVal + 1;
                updateSummary();
            }
        }
    });

    if (addonStoveCheckbox) {
        addonStoveCheckbox.addEventListener('change', updateSummary);
    }

    // Initial calculation run
    updateSummary();

    // --- Order Form Submission ---
    if (orderForm) {
        orderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('custName').value.trim();
            const address = document.getElementById('custAddress').value.trim();

            if (name && address) {
                modalName.textContent = name;
                modalAddress.textContent = address;
                modalOrderCode.textContent = Math.floor(1000 + Math.random() * 9000);

                orderModal.classList.add('active');
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            orderModal.classList.remove('active');
        });
    }

    // --- FAQ Accordion Toggle ---
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(q => {
        q.addEventListener('click', () => {
            const parent = q.parentElement;
            const isActive = parent.classList.contains('active');

            document.querySelectorAll('.faq-item').forEach(item => item.classList.remove('active'));

            if (!isActive) {
                parent.classList.add('active');
            }
        });
    });

    // --- Top Announcement Bar Countdown ---
    let duration = 14 * 60 + 59;
    const timerDisplay = document.getElementById('timer');

    if (timerDisplay) {
        setInterval(() => {
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;

            timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            if (--duration < 0) {
                duration = 15 * 60;
            }
        }, 1000);
    }
});
