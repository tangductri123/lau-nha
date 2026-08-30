/**
 * LẨU NHÀ - CHATBOT TRỢ LÝ BÁN HÀNG TỰ NHIÊN
 * Tích hợp toàn bộ kho tri thức từ /data & sales_script.md
 */

(function () {
    // Hàm chuẩn hóa tiếng Việt bỏ dấu để tìm kiếm thông minh
    function removeVietnameseTones(str) {
        if (!str) return '';
        str = str.toLowerCase();
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
        str = str.replace(/\u02C6|\u0306|\u031B/g, "");
        return str.trim();
    }

    // 1. KHO TRI THỨC VÀ KỊCH BẢN CHUẨN XÁC TỪ SALES_SCRIPT.MD & /DATA
    const KNOWLEDGE_BASE = {
        greeting: `Chào bạn nha! Đang tìm món ngon đổi bữa hay tối nay tụ tập bạn bè ăn lẩu vậy bạn? ✨<br><br>Bên mình chuẩn bị sẵn trọn gói từ <strong>nước cốt hầm xương 12 tiếng</strong> đến <strong>thịt bò, hải sản tươi và khay đun trực tiếp</strong> — giao tới 30 phút là có lẩu ăn ngay, ăn xong dọn 30 giây khỏi rửa nồi.<br><br>Bạn đang tính ăn mấy người để mình gợi ý set vừa vặn nhất nha! 😊`,

        qaList: [
            {
                id: "q1_set_info",
                label: "🍲 Set lẩu gồm những gì?",
                keywords: ["gom nhung gi", "set gom", "combo", "thanh phan", "co nhung gi", "chuan bi gi", "do an", "topping", "mon gi"],
                reply: `Thật ra bạn không cần chuẩn bị thêm bất cứ thứ gì luôn! Một set bên mình đóng gói đầy đủ:<br>
• Nước cốt lẩu hầm 12h đậm đà tự nhiên<br>
• Thịt bò Mỹ/Úc, tôm mực tươi và viên nhúng<br>
• Khay rau nấm sạch và mì nhúng lẩu<br>
• Sốt chấm đặc sản độc quyền<br>
• <strong>Khay nhôm chịu nhiệt đun trực tiếp</strong> và túi gom rác<br><br>
Nhận hàng là xé túi đổ vào khay đun sôi 3-5 phút là ăn ngay, ăn xong túm túi rác bỏ đi là phòng sạch bóng!`
            },
            {
                id: "q2_broth_diff",
                label: "🥣 Cốt lẩu khác gì ngoài quán?",
                keywords: ["khac gi", "nuoc lau", "cot lau", "bot ngot", "say bot ngot", "ham", "nuoc dung", "chat luong", "ngot thanh", "dau mo"],
                reply: `Khác biệt lớn nhất là phần nước cốt ninh từ xương củ quả thật 100% suốt 12 tiếng bạn nha.<br><br>
Ngoài quán hay lẩu giá rẻ trên app thường dùng bột nêm công nghiệp pha sẵn, ăn xong rất khát nước và dễ bị say bột ngọt, đầy bụng. Nước cốt bên mình ngọt thanh tự nhiên: Trưa ăn xong làm việc tỉnh táo, tối ăn xong êm bụng ngủ ngon, không bị ám mùi dầu mỡ khắp phòng.`
            },
            {
                id: "q3_broth_flavors",
                label: "🌶️ 4 Vị lẩu có những loại nào?",
                keywords: ["vi lau", "4 vi", "cac vi", "tom yum", "tu xuyen", "lau nam", "rieu cua", "loai lau", "huong vi", "cay khong"],
                reply: `Bên mình có 4 vị nước cốt hầm 12h độc quyền đóng túi tiệt trùng 1 Lít (89k - 99k/túi):<br>
1. <strong>Lẩu Thái Tom Yum Hải Sản (89k):</strong> Chua thanh chanh sả, cay nồng ớt Xiêm, béo nhẹ cốt dừa (Cay vừa 🌶️🌶️ - Bán chạy nhất).<br>
2. <strong>Lẩu Tứ Xuyên Tiêu Tê (99k):</strong> Đậm đà chuẩn Trung Hoa, thơm hoa hồi thảo quả, tê cay đầu lưỡi (Cay nồng 🌶️🌶️🌶️).<br>
3. <strong>Lẩu Nấm Thượng Hạng (89k):</strong> Ninh từ nấm tùng nhung, đông trùng hạ thảo ngọt thanh (Không cay 0% - Rất bổ dưỡng).<br>
4. <strong>Lẩu Riêu Cua Đồng Đặc Biệt (99k):</strong> Riêu cua giã tay thơm béo, chua dịu giấm bỗng nếp (Cay nhẹ 🌶️ - Đậm đà).`
            },
            {
                id: "q4_choose_set",
                label: "👨‍👩‍👧‍👦 Nhóm mình nên chọn set nào?",
                keywords: ["may nguoi", "chon set", "set nao", "2 nguoi", "3 nguoi", "4 nguoi", "5 nguoi", "6 nguoi", "8 nguoi", "doi lua", "gia dinh", "dai tiec", "khau phan", "du no"],
                reply: `Bên mình có 3 set định lượng chuẩn no nê:<br>
• <strong>2-3 người:</strong> Chọn <strong>Set Đôi Lứa (249k)</strong> — 350g bò Mỹ/Úc, tôm thẻ tươi (4 con), viên nhúng, khay rau nấm sạch, khay nhôm đun.<br>
• <strong>4-5 người:</strong> Chọn <strong>Set Gia Đình (399k - Bán chạy nhất)</strong> — 600g bò Mỹ + bò Úc, 300g tôm mực tươi, 10 viên nhúng, 2 khay rau nấm, mì lẩu + <strong>Được FREE mượn bếp cồn</strong>.<br>
• <strong>6-8 người:</strong> Chọn <strong>Set Đại Tiệc (599k)</strong> — 800g bò thượng hạng, 500g hải sản (tôm, mực, cá hồi phi lê), 16 viên phô mai, 3 khay rau nấm, 2 khay đun, mì Udon + <strong>FREE mượn bếp cồn</strong>.`
            },
            {
                id: "q5_addons",
                label: "🥩 Món gọi thêm & giá bao nhiêu?",
                keywords: ["goi them", "them mon", "mon them", "bo my", "pho mai", "bat dua", "con gel", "gia them"],
                reply: `Bên mình có các món gọi thêm rất tiện lợi:<br>
• <strong>Thêm Ba Chỉ Bò Mỹ (200g):</strong> 65.000đ<br>
• <strong>Viên Nhúng Phô Mai Chảy (6 viên):</strong> 45.000đ<br>
• <strong>Tép Cồn Khô/Gel:</strong> 15.000đ / tép (cháy 35-45 phút)<br>
• <strong>Bộ Bát Đũa Dùng 1 Lần:</strong> 15.000đ / bộ (bát giấy, đũa tre, thìa, khăn ướt, túi rác)<br>
• <strong>Khay Nhôm Đun:</strong> Tặng kèm MIỄN PHÍ 0đ trong mọi set!`
            },
            {
                id: "q6_no_stove",
                label: "🍳 Không có bếp nồi thì ăn ra sao?",
                keywords: ["khong co bep", "khong co noi", "o tro", "phong tro", "noi lau", "khay nhom", "dun bang gi", "nau bang gi", "chua co bep"],
                reply: `Đơn giản lắm bạn! Bạn <strong>khỏi cần chuẩn bị nồi</strong> vì mỗi set lẩu bên mình đều tặng sẵn khay nhôm thực phẩm cao cấp đun trực tiếp trên bếp ga mini hoặc bếp cồn.<br><br>
Nếu bạn chưa có bếp, bên mình có dịch vụ <strong>cho mượn trọn bộ bếp cồn mang tới tận nhà</strong>. Đơn từ 399k là được mượn hoàn toàn MIỄN PHÍ luôn nha!`
            },
            {
                id: "q7_stove_deposit",
                label: "🔥 Mượn bếp cồn & cọc thế nào?",
                keywords: ["muon bep", "coc bep", "thue bep", "tra bep", "tien coc", "200k", "200.000", "coc tien", "thu hoi", "phi muon"],
                reply: `Rất minh bạch và tiện cho bạn:<br>
• <strong>Phí mượn:</strong> Đơn từ 399k mượn bếp <strong>0đ (Miễn phí)</strong>. Đơn dưới 399k phí mượn chỉ 50k (đã gồm phí giao và thu hồi).<br>
• <strong>Tiền cọc bếp:</strong> Bạn gửi shipper cọc nhẹ <strong>200.000đ/bếp</strong> khi nhận hàng.<br>
• <strong>Trả bếp:</strong> Hôm sau shipper bên mình tự động qua tận nơi nhận lại bếp và <strong>hoàn trả đủ 100% tiền cọc 200k</strong> ngay tại chỗ. Bạn không cần phải mang bếp đi đâu trả cả!`
            },
            {
                id: "q8_shipping_fee",
                label: "🚚 Phí ship & Freeship thế nào?",
                keywords: ["phi ship", "tien ship", "freeship", "ahamove", "van chuyen", "giao hang", "ship bao nhieu", "4km", "5km", "chia se ship"],
                reply: `Phí ship bên mình tính theo giá app Ahamove theo khoảng cách thực tế, nhân viên gọi xác nhận đơn sẽ báo rõ từng nghìn trước khi gửi hàng nha.<br><br>
🎁 <strong>Đặc biệt bên mình có ưu đãi ship cực tốt:</strong><br>
• Địa chỉ cách bếp <strong>dưới 4km: FREESHIP 100%</strong><br>
• Địa chỉ <strong>trên 5km: Hỗ trợ chia sẻ 20.000đ tiền ship</strong> (áp dụng cho đơn từ 399k)<br><br>
Bạn nhận lẩu kiểm tra xong thì gửi tiền ship trực tiếp cho shipper nha!`
            },
            {
                id: "q9_delivery_time",
                label: "⚡ Bao lâu thì giao tới?",
                keywords: ["bao lau", "thoi gian", "may phut", "giao nhanh", "kip khong", "dang doi", "khi nao toi", "hoa toc", "may gio"],
                reply: `Kịp ăn luôn bạn nha! Nguyên liệu tươi trong ngày bên mình đã sơ chế sẵn trong tủ lạnh chuyên dụng. Bạn chốt đơn xong, bếp đóng khay chỉ mất 5 phút và shipper hỏa tốc giao tới tận cửa trong vòng <strong>30 đến 40 phút</strong> là có lẩu nóng hổi ăn liền.`
            },
            {
                id: "q10_clean_up",
                label: "🧹 Ăn xong dọn có cực không?",
                keywords: ["don dep", "rua noi", "dau mo", "rua bat", "cuc khong", "30 giay", "30s", "vut rac", "tui rac", "ve sinh", "sach khong"],
                reply: `<strong>Đúng 30 giây là xong bạn ơi!</strong> Vì đun trực tiếp bằng khay nhôm và có tặng kèm túi gom rác sinh học. Ăn xong bạn chỉ việc gom toàn bộ khay và đồ ăn thừa vào túi rác rồi vứt, bàn ăn sạch bong không dính một giọt dầu mỡ, không phải đùn đẩy nhau rửa nồi mỡ màng.`
            },
            {
                id: "q11_kids_elderly",
                label: "👶 Trẻ em / người không ăn cay?",
                keywords: ["tre em", "nguoi gia", "khong an cay", "cay khong", "lau nam", "rieu cua", "be nho", "it cay", "khong cay", "vi nao"],
                reply: `Bạn chọn <strong>Lẩu Nấm Thượng Hạng</strong> hoặc <strong>Lẩu Riêu Cua Đồng</strong> nha:<br>
• <strong>Lẩu Nấm:</strong> ninh từ nấm tùng nhung, đông trùng hạ thảo ngọt thanh, 0% cay, cực kỳ bổ dưỡng cho các bé và ông bà.<br>
• <strong>Lẩu Riêu Cua:</strong> thơm béo truyền thống thanh mát.<br><br>
Bên mình luôn để riêng gói sa tế tắc và ớt tươi bên ngoài, ai thích ăn cay thì tự chấm thêm thoải mái nha!`
            },
            {
                id: "q12_stove_compatibility",
                label: "🔌 Đun trên bếp từ/hồng ngoại được không?",
                keywords: ["bep tu", "bep hong ngoai", "bep ga", "dun tren bep tu", "bat tu", "bep o nha"],
                reply: `Khay nhôm bên mình đun trực tiếp cực tốt trên <strong>Bếp hồng ngoại, Bếp ga mini và Bếp cồn</strong> bạn nha! (Riêng bếp từ do cơ chế cảm ứng từ trường nên nhôm không bắt từ trực tiếp). Nếu nhà dùng bếp từ, bạn có thể trút nước cốt vào nồi từ ở nhà hoặc mượn Bếp Cồn MIỄN PHÍ của bên mình cho tiện khỏi rửa nồi nha!`
            },
            {
                id: "q13_storage_later",
                label: "❄️ Chưa ăn ngay thì bảo quản thế nào?",
                keywords: ["bao quan", "toi moi an", "de qua dem", "chua an ngay", "tu lanh", "ngan mat", "ngan dong"],
                reply: `Đơn giản lắm bạn! Đồ ăn bên mình đóng khay kín tiệt trùng. Khi nhận hàng, bạn chỉ cần để khay thịt, hải sản và túi nước cốt vào <strong>ngăn mát tủ lạnh</strong> (nếu ăn trong ngày) hoặc ngăn đông (nếu để qua hôm sau); rau nấm để ngăn mát rau củ. Tối khi nào ăn, lấy ra đổ vào khay đun sôi 3-5 phút là tươi ngon trọn vị!`
            },
            {
                id: "q14_alcohol_safety",
                label: "🛡️ Đốt cồn phòng máy lạnh có an toàn?",
                keywords: ["an toan", "chay no", "phong may lanh", "phong kin", "mui khet", "cay mat", "con gel", "mui con"],
                reply: `Dạ cồn bên mình cung cấp là <strong>Cồn Gel sinh học không khói, không cay mắt và không mùi khét</strong>, đạt tiêu chuẩn an toàn cho nhà hàng. Bếp cồn inox có cần gạt chỉnh to nhỏ, hoàn toàn không lo bắn lửa hay nổ như cồn nước trôi nổi. Dùng trong phòng điều hòa cực kỳ sạch sẽ và an toàn nha!`
            },
            {
                id: "q15_food_freshness",
                label: "🥩 Cam kết đồ tươi & bảo hành thế nào?",
                keywords: ["tuoi ngon", "chat luong", "thit bo", "hai san", "kiem tra hang", "doi tra", "do tuoi", "bao hanh", "uon", "hu hong", "khieu nai"],
                reply: `Bên mình cam kết nhập tươi mới mỗi sáng, đóng gói giữ lạnh suốt đường đi. Khi shipper tới, bạn cứ <strong>mở ra kiểm tra trực tiếp đồ tươi ngon mới thanh toán</strong>. Nếu có bất cứ món nào không tươi hoặc không đúng vị, bên mình áp dụng chính sách <strong>Bảo Hành 100%</strong>: Đổi mới 1-1 hỏa tốc trong 15 phút hoặc hoàn tiền ngay lập tức cho bạn!`
            }
        ],

        // PHẦN 3: CÂU CHỐT ĐƠN KHI KHÁCH ĐÃ QUAN TÂM (CLOSING DEALS)
        closingOrder: {
            reply: `Hôm nay bên mình đang có mã <strong>[GIAM50K]</strong> trừ thẳng vào hóa đơn và <strong>FREE mượn bếp cồn</strong> cho đơn từ 399k.<br><br>Bạn lấy Set Gia Đình vị Thái Tom Yum hay Lẩu Nấm để bếp chuẩn bị giao nóng hổi qua cho bạn luôn nè? Bạn bấm nút bên dưới để chọn set và điền thông tin nhận hàng nha! ✨`,
            btnText: "🔥 ĐẶT SET LẨU (GIẢM 50K)",
            action: "order"
        },

        // PHẦN 4: CÂU HƯỚNG KHÁCH ĐIỀN FORM (KHI CHƯA SẴN SÀNG MUA NGAY)
        leadSurvey: {
            reply: `Dạ không sao nè bạn, khi nào thèm lẩu cứ ới bên mình 30 phút là có! ✨<br><br>Hiện bên mình đang có chương trình <strong>Khảo sát ngắn nhận Voucher Ưu Đãi 50%</strong> cho bữa tiệc lẩu tiếp theo. Bạn dành ra 30 giây điền form nhanh ở đây để lưu quà tặng nha: 😊`,
            btnText: "🎁 ĐIỀN FORM KHẢO SÁT NHẬN ƯU ĐÃI 50%",
            action: "survey"
        }
    };

    // 2. RENDER WIDGET GIAO DIỆN
    function renderChatWidget() {
        if (document.getElementById('lauNhaChatWidget')) return;

        const widget = document.createElement('div');
        widget.id = 'lauNhaChatWidget';
        widget.innerHTML = `
            <!-- Tooltip Prompt -->
            <div class="chat-tooltip-bubble" id="chatTooltip">
                <span>🔥 Thèm lẩu tại nhà? Chat với Lẩu Nhà nha!</span>
                <span class="chat-tooltip-close" id="closeChatTooltip" title="Đóng">&times;</span>
            </div>

            <!-- Floating Button -->
            <button type="button" class="chat-trigger-btn" id="chatTriggerBtn" aria-label="Mở khung chat">
                <i class="fa-solid fa-comment-dots"></i>
                <span class="chat-unread-badge">1</span>
            </button>

            <!-- Chat Window -->
            <div class="chat-window" id="chatWindow">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-avatar-wrapper">
                            <img src="assets/images/logo.jpg" alt="Lẩu Nhà" class="chat-avatar-img">
                            <span class="chat-status-dot"></span>
                        </div>
                        <div class="chat-header-text">
                            <h4>Trợ Lý Lẩu Nhà</h4>
                            <p>🟢 Đang trực tuyến · Ăn lẩu 15p</p>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button type="button" class="chat-btn-icon" id="resetChatBtn" title="Bắt đầu lại">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <button type="button" class="chat-btn-icon" id="closeChatBtn" title="Thu nhỏ">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>
                </div>

                <div class="chat-body" id="chatMessages">
                    <!-- Messages dynamically rendered here -->
                </div>

                <div class="chat-quick-replies">
                    <div class="chat-quick-replies-title">💡 Chọn nhanh câu hỏi:</div>
                    <div class="chat-chips-scroll" id="chatChipsContainer">
                        <!-- Chips dynamically rendered here -->
                    </div>
                </div>

                <form class="chat-input-bar" id="chatInputForm">
                    <input type="text" class="chat-input-field" id="chatInputField" placeholder="Nhập câu hỏi của bạn..." autocomplete="off">
                    <button type="submit" class="chat-send-btn" id="chatSendBtn" aria-label="Gửi tin nhắn">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(widget);

        initChatEvents();
    }

    // 3. LOGIC HOẠT ĐỘNG VÀ BỘ NHẬN DIỆN Ý ĐỊNH THÔNG MINH
    function initChatEvents() {
        const triggerBtn = document.getElementById('chatTriggerBtn');
        const chatWindow = document.getElementById('chatWindow');
        const closeBtn = document.getElementById('closeChatBtn');
        const resetBtn = document.getElementById('resetChatBtn');
        const tooltip = document.getElementById('chatTooltip');
        const closeTooltip = document.getElementById('closeChatTooltip');
        const chatForm = document.getElementById('chatInputForm');
        const chatInput = document.getElementById('chatInputField');
        const messagesArea = document.getElementById('chatMessages');
        const chipsContainer = document.getElementById('chatChipsContainer');

        let isInitialized = false;

        function openChat() {
            chatWindow.classList.add('active');
            if (tooltip) tooltip.style.display = 'none';
            const badge = triggerBtn.querySelector('.chat-unread-badge');
            if (badge) badge.style.display = 'none';

            if (!isInitialized) {
                renderInitialState();
                isInitialized = true;
            }
            chatInput.focus();
        }

        function closeChat() {
            chatWindow.classList.remove('active');
        }

        triggerBtn.addEventListener('click', () => {
            if (chatWindow.classList.contains('active')) {
                closeChat();
            } else {
                openChat();
            }
        });

        if (tooltip) {
            tooltip.addEventListener('click', (e) => {
                if (e.target !== closeTooltip) openChat();
            });
        }
        if (closeTooltip) {
            closeTooltip.addEventListener('click', (e) => {
                e.stopPropagation();
                tooltip.style.display = 'none';
            });
        }

        closeBtn.addEventListener('click', closeChat);

        resetBtn.addEventListener('click', () => {
            messagesArea.innerHTML = '';
            renderInitialState();
        });

        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;
            chatInput.value = '';
            handleUserMessage(text);
        });

        function renderInitialState() {
            appendBotMessage(KNOWLEDGE_BASE.greeting, [
                { text: "🛒 TÔI MUỐN ĐẶT LẨU NGAY", action: "order", primary: true },
                { text: "🎁 Khảo Sát Nhận Ưu Đãi 50%", action: "survey", primary: false }
            ]);

            renderChips();
        }

        function renderChips() {
            chipsContainer.innerHTML = '';

            // 2 Nút hành động ưu tiên cao
            const buyChip = document.createElement('button');
            buyChip.type = 'button';
            buyChip.className = 'chat-chip highlight';
            buyChip.innerHTML = '🔥 Đặt lẩu (Giảm 50K)';
            buyChip.addEventListener('click', () => handleUserAction('order', 'Tôi muốn đặt lẩu giảm 50k'));
            chipsContainer.appendChild(buyChip);

            const surveyChip = document.createElement('button');
            surveyChip.type = 'button';
            surveyChip.className = 'chat-chip';
            surveyChip.innerHTML = '🎁 Nhận ưu đãi 50%';
            surveyChip.addEventListener('click', () => handleUserAction('survey', 'Tôi muốn nhận voucher ưu đãi 50%'));
            chipsContainer.appendChild(surveyChip);

            // 15 Câu hỏi chuẩn từ sales_script.md
            KNOWLEDGE_BASE.qaList.forEach(item => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chat-chip';
                chip.textContent = item.label;
                chip.addEventListener('click', () => {
                    handleUserQuestion(item);
                });
                chipsContainer.appendChild(chip);
            });
        }

        function appendUserMessage(text) {
            const msg = document.createElement('div');
            msg.className = 'chat-msg user';
            msg.innerHTML = `
                <div class="chat-msg-avatar"><i class="fa-solid fa-user"></i></div>
                <div class="chat-msg-content"><p>${escapeHtml(text)}</p></div>
            `;
            messagesArea.appendChild(msg);
            scrollToBottom();
        }

        function appendBotMessage(htmlContent, ctaButtons = []) {
            const msg = document.createElement('div');
            msg.className = 'chat-msg bot';

            let buttonsHtml = '';
            if (ctaButtons && ctaButtons.length > 0) {
                buttonsHtml = `<div class="chat-action-cta-group">` +
                    ctaButtons.map(btn => `
                        <button type="button" class="chat-cta-btn ${btn.primary ? 'primary' : 'secondary'}" data-action="${btn.action}">
                            ${btn.text}
                        </button>
                    `).join('') +
                    `</div>`;
            }

            msg.innerHTML = `
                <div class="chat-msg-avatar"><i class="fa-solid fa-fire"></i></div>
                <div class="chat-msg-content">
                    <div>${htmlContent}</div>
                    ${buttonsHtml}
                </div>
            `;

            msg.querySelectorAll('.chat-cta-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.getAttribute('data-action');
                    if (action === 'order') {
                        closeChat();
                        const builder = document.getElementById('builder');
                        if (builder) builder.scrollIntoView({ behavior: 'smooth' });
                    } else if (action === 'survey') {
                        closeChat();
                        const survey = document.getElementById('survey-section');
                        if (survey) survey.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });

            messagesArea.appendChild(msg);
            scrollToBottom();
        }

        function handleUserQuestion(item) {
            appendUserMessage(item.label.replace(/^[^\w\s\d]+/, '').trim());
            setTimeout(() => {
                appendBotMessage(item.reply, [
                    { text: "👉 Đặt Set Lẩu Giảm 50K", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50%", action: "survey", primary: false }
                ]);
            }, 300);
        }

        function handleUserAction(action, userText) {
            appendUserMessage(userText);
            setTimeout(() => {
                if (action === 'order') {
                    appendBotMessage(KNOWLEDGE_BASE.closingOrder.reply, [
                        { text: KNOWLEDGE_BASE.closingOrder.btnText, action: "order", primary: true }
                    ]);
                } else if (action === 'survey') {
                    appendBotMessage(KNOWLEDGE_BASE.leadSurvey.reply, [
                        { text: KNOWLEDGE_BASE.leadSurvey.btnText, action: "survey", primary: true }
                    ]);
                }
            }, 300);
        }

        // BỘ XỬ LÝ NHẬN DIỆN CÂU HỎI THÔNG MINH
        function handleUserMessage(text) {
            appendUserMessage(text);

            const rawLower = text.toLowerCase();
            const normalized = removeVietnameseTones(text);

            // 1. Chào hỏi ban đầu
            if (/^(chao|hi|hello|alo|hai|helo|xin chao|shop oi|ad oi|ban oi)/i.test(normalized)) {
                setTimeout(() => {
                    appendBotMessage(KNOWLEDGE_BASE.greeting, [
                        { text: "🛒 TÔI MUỐN ĐẶT LẨU NGAY", action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Ưu Đãi 50%", action: "survey", primary: false }
                    ]);
                }, 300);
                return;
            }

            // 2. Nhận diện ý định Mua hàng / Chốt đơn (Phần 3 của sales_script.md)
            if (/mua|dat|order|lay set|chot|thanh toan|tinh tien|dat hang|cho minh 1 set|lay minh 1 set|muon dat/i.test(normalized)) {
                setTimeout(() => {
                    appendBotMessage(KNOWLEDGE_BASE.closingOrder.reply, [
                        { text: KNOWLEDGE_BASE.closingOrder.btnText, action: "order", primary: true }
                    ]);
                }, 300);
                return;
            }

            // 3. Nhận diện ý định Form khảo sát / Voucher / Chưa mua ngay (Phần 4 của sales_script.md)
            if (/form|khao sat|danh sach cho|voucher|uu dai 50|giam 50|chua mua|tham khao|dang ky|luu ma/i.test(normalized)) {
                setTimeout(() => {
                    appendBotMessage(KNOWLEDGE_BASE.leadSurvey.reply, [
                        { text: KNOWLEDGE_BASE.leadSurvey.btnText, action: "survey", primary: true }
                    ]);
                }, 300);
                return;
            }

            // 4. So khớp điểm từ khóa với 15 câu hỏi chuẩn (sales_script.md)
            let bestMatch = null;
            let highestScore = 0;

            KNOWLEDGE_BASE.qaList.forEach(item => {
                let score = 0;
                item.keywords.forEach(kw => {
                    const normKw = removeVietnameseTones(kw);
                    if (normalized.includes(normKw)) {
                        score += normKw.length;
                    }
                });
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = item;
                }
            });

            setTimeout(() => {
                if (bestMatch && highestScore > 0) {
                    appendBotMessage(bestMatch.reply, [
                        { text: "👉 Đặt Set Lẩu Giảm 50K", action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Ưu Đãi 50%", action: "survey", primary: false }
                    ]);
                } else {
                    appendBotMessage(
                        `Dạ Lẩu Nhà đã nhận được câu hỏi của bạn! Bạn có thể chọn nhanh các thắc mắc thường gặp ở bên dưới, hoặc bấm nút đặt lẩu ngay để nhận ưu đãi giảm 50.000đ nha:`,
                        [
                            { text: "🔥 TỰ MIX SET LẨU (GIẢM 50K)", action: "order", primary: true },
                            { text: "🎁 Điền Form Nhận Ưu Đãi 50%", action: "survey", primary: false }
                        ]
                    );
                }
            }, 350);
        }

        function scrollToBottom() {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        function escapeHtml(str) {
            return String(str ?? '').replace(/[&<>"']/g, c => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[c]));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderChatWidget);
    } else {
        renderChatWidget();
    }
})();
