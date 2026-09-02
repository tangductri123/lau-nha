/**
 * LẨU NHÀ - CHATBOT TRỢ LÝ BÁN HÀNG TỰ NHIÊN
 * Tích hợp toàn bộ kho tri thức từ /data & sales_script.md
 */

(function () {
    // 1. BỘ TỪ ĐIỂN CHUẨN HÓA TIẾNG VIỆT & TEENCODE
    function normalizeText(str) {
        if (!str) return '';
        let s = str.toLowerCase();

        // Chuẩn hóa dấu tiếng Việt
        s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        s = s.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        s = s.replace(/đ/g, "d");
        s = s.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
        s = s.replace(/\u02C6|\u0306|\u031B/g, "");

        // Chuẩn hóa teencode & từ viết tắt phổ biến
        s = s.replace(/\b(ko|k|khg|kh|hok|hong|hông|hem|k0)\b/g, "khong");
        s = s.replace(/\b(dc|đc|duoc|dk|dck)\b/g, "duoc");
        s = s.replace(/\b(bnhieu|bnh|bn|bao nhiu|b nhiu|bnhiu|gia bn)\b/g, "bao nhieu");
        s = s.replace(/\b(ntn|nhu nao)\b/g, "nhu the nao");
        s = s.replace(/\b(dt|đt|sdt|sđt|tel|phone)\b/g, "so dien thoai");
        s = s.replace(/\b(ng|nguoi|ng`|nguoii)\b/g, "nguoi");
        s = s.replace(/\b(vc|vk ck|2 vc|hai vc|2 vk ck)\b/g, "2 vo chong");
        s = s.replace(/\b(ad|shop|shopp|sop|em oi|ban oi|e oi|ad oi)\b/g, "tu van");
        s = s.replace(/\b(tphcm|hcm|sg|sai gon|ho chi minh)\b/g, "thanh pho ho chi minh");
        s = s.replace(/\b(ship|giao hang|van chuyen|shipment)\b/g, "giao hang");
        s = s.replace(/\b(fb|zalo|inbox|ib|mess)\b/g, "nhan tin");
        s = s.replace(/\b(voucher|code|ma giam|ma km|khuyen mai|giam gia)\b/g, "voucher");
        s = s.replace(/\b(tks|thanks|thank you|cam on ban|cam on shop)\b/g, "cam on");

        // Xóa ký tự thừa
        s = s.replace(/[^\w\s\d]/g, " ");
        s = s.replace(/\s+/g, " ").trim();
        return s;
    }

    // 1B. HÀM TRÍCH XUẤT VÀ TÍNH TOÁN NGÂN SÁCH THÔNG MINH
    function parseBudget(text) {
        if (!text) return null;
        let s = text.toLowerCase();

        // 1. Nhận diện triệu (tr / trieu)
        let mTr = s.match(/(\d+[\.,]?\d*)\s*(tr|trieu)/);
        if (mTr) {
            let val = parseFloat(mTr[1].replace(',', '.'));
            if (!isNaN(val) && val > 0) return Math.round(val * 1000000);
        }

        // 2. Nhận diện nghìn (k / nghin / ngan / tram)
        let mK = s.match(/(\d+[\.,]?\d*)\s*(k|nghin|ngan|tram)/);
        if (mK) {
            let val = parseFloat(mK[1].replace(',', '.'));
            let unit = mK[2];
            if (!isNaN(val) && val > 0) {
                if (unit === 'tram') return Math.round(val * 100000);
                return Math.round(val * 1000);
            }
        }

        // 3. Nhận diện số trực tiếp (e.g. 300000, 249000, 300)
        let mNum = s.match(/\b(\d{2,7})\b/);
        if (mNum) {
            let val = parseInt(mNum[1], 10);
            if (!isNaN(val)) {
                if (val >= 50 && val <= 1500) return val * 1000; // ví dụ gõ '300' hiểu là 300.000đ
                if (val > 10000) return val;
            }
        }

        return null;
    }

    // 2. KHO TRI THỨC TOÀN DIỆN (KNOWLEDGE BASE CHUẨN XÁC)
    const KNOWLEDGE_BASE = {
        greeting: `Chào bạn nha! Đang tìm món ngon đổi bữa hay tối nay tụ tập bạn bè ăn lẩu vậy bạn? ✨<br><br>Bên mình chuẩn bị sẵn trọn gói từ <strong>nước cốt hầm xương 12 tiếng</strong> đến <strong>thịt bò, hải sản tươi và khay đun trực tiếp</strong> — giao tới 30 phút là có lẩu ăn ngay, ăn xong dọn 30 giây khỏi rửa nồi.<br><br>Bạn đang tính ăn mấy người hoặc thích ăn vị chua cay, riêu cua hay lẩu nấm thanh ngọt để mình tư vấn set chuẩn nhất nha! 😊`,

        topics: [
            // TOPIC 1: SỐ NGƯỜI ĂN (2-3 NGƯỜI / CẶP ĐÔI)
            {
                id: "people_couple_2_3",
                label: "👫 Set 2-3 người (Đôi lứa)",
                keywords: ["2 nguoi", "3 nguoi", "2 3 nguoi", "2 den 3 nguoi", "2 vo chong", "cap doi", "nguoi yeu", "hai nguoi", "ba nguoi", "set doi lua", "249k", "249000"],
                reply: `Dạ nhóm <strong>2-3 người</strong> hoặc 2 vợ chồng ăn thì chọn Combo trọn gói cực kỳ vừa vặn và no nê ạ:<br><br>
🍲 <strong>1. Chọn Nước Cốt Lẩu (89k - 99k):</strong> Túi 1L hầm xương 12h (Lẩu Thái Tom Yum, Lẩu Nấm, Riêu Cua hoặc Tứ Xuyên).<br>
🥩 <strong>2. Chọn Set Topping Đôi Lứa (249.000đ):</strong><br>
• 350g Ba chỉ bò Mỹ + Bắp bò Úc, tôm thẻ tươi (4 con), viên nhúng hải sản.<br>
• 1 Khay rau nấm tổng hợp tươi sạch, mì nhúng lẩu, sốt chấm độc quyền.<br>
• <strong>Tặng sẵn khay nhôm thực phẩm cao cấp đun trực tiếp</strong>.<br><br>
🎁 <strong>MẸO TIẾT KIỆM:</strong> Tổng combo gốc 338k, bạn áp dụng mã giảm giá <strong>[LAUNHA50K]</strong> (nhận qua khảo sát 30s) -> <strong>Chỉ còn 288.000đ</strong> trọn gói cả nước lẩu và thịt tươi!`,
                cta: [
                    { text: "🔥 TỰ MIX SET ĐÔI LỨA (288K)", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 2: SỐ NGƯỜI ĂN (4-5 NGƯỜI / GIA ĐÌNH)
            {
                id: "people_family_4_5",
                label: "👨‍👩‍👧‍👦 Set 4-5 người (Gia đình)",
                keywords: ["4 nguoi", "5 nguoi", "4 5 nguoi", "4 den 5 nguoi", "gia dinh", "nha 4 nguoi", "nha 5 nguoi", "bon nguoi", "nam nguoi", "set gia dinh", "399k", "399000"],
                reply: `Dạ nhóm <strong>4-5 người</strong> thì bạn chọn Combo Gia Đình (Best Seller) là chuẩn bài nhất ạ:<br><br>
🍲 <strong>1. Chọn Nước Cốt Lẩu (89k - 99k):</strong> 1-2 Túi nước cốt hầm 12h đậm đà tự nhiên.<br>
🥩 <strong>2. Chọn Set Topping Gia Đình (399.000đ):</strong><br>
• 600g Ba chỉ bò Mỹ + Lõi vai Úc + 300g tôm thẻ & mực trứng tươi + 10 viên nhúng cao cấp.<br>
• 2 Khay rau nấm sạch, mì tươi nhúng lẩu, sốt chấm và khay nhôm đun trực tiếp.<br><br>
🎁 <strong>ĐẶC QUYỀN ĐƠN TỪ 399K:</strong> Được <strong>MIỄN PHÍ MƯỢN TRỌN BỘ BẾP CỒN (0đ)</strong> mang tận nhà (hôm sau shipper tự qua lấy lại) và hỗ trợ 20k ship nếu trên 5km!`,
                cta: [
                    { text: "🔥 ĐẶT COMBO GIA ĐÌNH", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 3: SỐ NGƯỜI ĂN (6-8+ NGƯỜI / ĐẠI TIỆC / LIÊN HOAN)
            {
                id: "people_party_6_8",
                label: "🎉 Set 6-8 người (Đại tiệc)",
                keywords: ["6 nguoi", "7 nguoi", "8 nguoi", "9 nguoi", "10 nguoi", "dong nguoi", "dai tiec", "lien hoan", "sinh nhat", "cong ty", "hop mat", "599k", "599000"],
                reply: `Dạ nhóm đông từ <strong>6-8 người</strong> trở lên ăn liên hoan, sinh nhật thì bạn chọn:<br><br>
🍲 <strong>1. Chọn Nước Cốt Lẩu (89k - 99k x 2 túi):</strong> Thoải mái chọn 2 vị lẩu khác nhau (ví dụ: 1 nồi Thái Tom Yum chua cay + 1 nồi Lẩu Nấm thanh ngọt).<br>
🥩 <strong>2. Chọn Set Topping Đại Tiệc (599.000đ):</strong><br>
• 800g Bò thượng hạng (Ba chỉ Mỹ, Lõi vai Úc) + 500g Hải sản (Tôm, mực trứng, cá hồi) + 16 viên phô mai béo ngậy.<br>
• 3 Khay rau nấm sạch, mì Udon & mì tươi.<br>
• 2 Khay nhôm đun chịu nhiệt + <strong>FREE mượn 2 bộ bếp cồn</strong> tận nhà!`,
                cta: [
                    { text: "🔥 ĐẶT COMBO ĐẠI TIỆC", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 4: TỔNG QUAN 4 VỊ NƯỚC LẨU
            {
                id: "broth_flavors_all",
                label: "🌶️ 4 Vị nước cốt lẩu hầm 12h",
                keywords: ["4 vi", "cac vi lau", "loai lau", "vi lau", "menu lau", "huong vi", "nuoc cot lau", "nuoc dung lau", "co nhung vi nao"],
                reply: `Lẩu Nhà có <strong>4 vị nước cốt hầm xương 12h độc quyền</strong> (đóng túi tiệt trùng 1 Lít - 89k đến 99k/túi):<br>
1. <strong>Lẩu Thái Tom Yum (89k):</strong> Chua thanh chanh sả, cay nồng ớt Xiêm, thơm béo cốt dừa (Cay vừa 🌶️🌶️ - Bán chạy nhất).<br>
2. <strong>Lẩu Riêu Cua Đồng (99k):</strong> Riêu cua đồng giã tay thơm béo bùi, chua thanh giấm bỗng nếp (Cay nhẹ 🌶️ - Rất đậm đà).<br>
3. <strong>Lẩu Nấm Thượng Hạng (89k):</strong> Ninh từ nấm tùng nhung, đông trùng hạ thảo, táo đỏ (0% Cay - Bổ dưỡng cho bé và người già).<br>
4. <strong>Lẩu Tứ Xuyên Tiêu Tê (99k):</strong> Đậm đà chuẩn vị Hoa, thơm hoa hồi thảo quả, tiêu tê đầu lưỡi (Cay nồng 🌶️🌶️🌶️).`,
                cta: [
                    { text: "🛒 TỰ MIX VỊ LẨU NGAY", action: "order", primary: true },
                    { text: "🎁 Nhận Mã Ưu Đãi 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 5: KHÔNG ĂN CAY / TRẺ EM / NGƯỜI GIÀ / BÀ BẦU
            {
                id: "spicy_none_kids",
                label: "👶 Trẻ em / Người không ăn cay",
                keywords: ["khong cay", "khong an cay", "it cay", "tre em", "tre nho", "be nho", "con nit", "nguoi gia", "ong ba", "nguoi lon tuoi", "ba bau", "mang thai", "thanh dam", "ngot thanh"],
                reply: `Dạ nếu nhà mình có <strong>em bé, người lớn tuổi hoặc không ăn được cay</strong> thì bạn nên chọn:<br>
• <strong>Lẩu Nấm Thượng Hạng:</strong> Hoàn toàn không cay (0%), nước dùng ninh từ nấm đông trùng, kỷ tử, táo đỏ ngọt thanh tự nhiên, thanh đạm và cực kỳ lành bụng cho bé.<br>
• <strong>Lẩu Riêu Cua Đồng:</strong> Vị thơm béo bùi truyền thống, thanh mát dễ ăn.<br><br>
👉 Bên mình luôn để riêng gói sa tế tắc và ớt xiêm tươi bên ngoài, ai thích ăn cay chỉ cần tự chấm thêm vào chén là xong ạ!`,
                cta: [
                    { text: "🍲 ĐẶT LẨU NẤM / RIÊU CUA", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 6: THÍCH ĂN CAY / CHUA CAY / TOM YUM / TỨ XUYÊN
            {
                id: "spicy_tomyum_sichuan",
                label: "🌶️ Thích chua cay / Tiêu tê",
                keywords: ["an cay", "chua cay", "cay nhieu", "sieu cay", "tom yum", "thai", "hai san", "tu xuyen", "tieu te", "cay nong", "dam da"],
                reply: `Dạ tín đồ mê lẩu cay thì chọn ngay 1 trong 2 vị này là mê liền ạ:<br>
• <strong>Lẩu Thái Tom Yum (Cay vừa 🌶️🌶️):</strong> Chua cay bùng nổ vị giác từ chanh sả tươi và ớt xiêm rừng, nhúng tôm mực bò Mỹ là chuẩn bài nhất.<br>
• <strong>Lẩu Tứ Xuyên (Cay nồng 🌶️🌶️🌶️):</strong> Hương thảo mộc hoa hồi quế chi nồng ấm kết hợp tiêu tê Tứ Xuyên, ăn vào ngày mát trời hay phòng lạnh là ấm sực người!`,
                cta: [
                    { text: "🔥 ĐẶT LẨU THÁI / TỨ XUYÊN", action: "order", primary: true },
                    { text: "🎁 Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 7: CỐT LẨU KHÁC GÌ NGOÀI QUÁN (SAY BỘT NGỌT / HẦM 12H)
            {
                id: "broth_difference",
                label: "🥣 Cốt lẩu hầm 12h khác gì ngoài quán?",
                keywords: ["khac gi", "bot ngot", "say bot ngot", "khat nuoc", "khat kho co", "ham 12h", "ham xuong", "chat luong", "day bung", "dau mo", "chuan nha hang"],
                reply: `Khác biệt lớn nhất là <strong>nước cốt Lẩu Nhà được hầm từ xương ống và củ quả thật 100% suốt 12 tiếng</strong>:<br><br>
• <strong>Ngoài quán / lẩu app giá rẻ:</strong> Thường dùng bột nêm công nghiệp pha sẵn và hương liệu tạo mùi. Ăn xong rất khát khô cổ, háo nước và dễ bị "say bột ngọt", đầy bụng khó ngủ.<br>
• <strong>Lẩu Nhà:</strong> Vị ngọt thanh hậu vị sâu từ tủy xương thật, không phẩm màu, không chất bảo quản. Trưa ăn xong làm việc tỉnh táo, tối ăn xong êm bụng ngủ ngon, không bị ám mùi dầu mỡ khắp phòng!`,
                cta: [
                    { text: "🍲 TRẢI NGHIỆM LẨU NHÀ NGAY", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 8: MƯỢN BẾP CỒN & TIỀN CỌC 200K
            {
                id: "stove_loan_deposit",
                label: "🔥 Dịch vụ mượn bếp cồn 0đ & Cọc",
                keywords: ["muon bep", "thue bep", "coc bep", "tien coc", "200k", "200000", "tra bep", "thu hoi bep", "phi muon bep", "khong co bep", "chua co bep", "o tro"],
                reply: `Quy trình mượn bếp cồn bên mình cực kỳ minh bạch và tiện lợi cho bạn:<br>
• <strong>Phí mượn bếp:</strong> Đơn từ 399k được <strong>MƯỢN BẾP MIỄN PHÍ 0Đ</strong>. Đơn dưới 399k phí mượn chỉ 50k (đã bao gồm phí shipper giao và qua thu hồi tận nơi).<br>
• <strong>Tiền cọc bếp:</strong> Bạn gửi shipper cọc nhẹ <strong>200.000đ/bếp</strong> khi nhận hàng.<br>
• <strong>Trả bếp:</strong> Bạn giữ bếp ăn thoải mái qua đêm. Sáng hoặc chiều hôm sau, shipper tự động ghé tận nhà nhận lại bếp và <strong>hoàn trả đủ 100% tiền cọc 200k</strong> ngay tại chỗ. Bạn không cần phải mang bếp đi đâu cả!`,
                cta: [
                    { text: "🔥 ĐẶT SET LẨU & MƯỢN BẾP 0Đ", action: "order", primary: true },
                    { text: "🎁 Nhận Mã Ưu Đãi 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 9: BẾP TỪ / BẾP GA / KHAY NHÔM ĐUN
            {
                id: "stove_compatibility",
                label: "🔌 Khay nhôm đun bếp từ/hồng ngoại được không?",
                keywords: ["bep tu", "bep hong ngoai", "bep ga", "bep ga mini", "khay nhom", "dun tren bep tu", "bat tu", "dung cu dun", "co can noi khong"],
                reply: `Dạ khay nhôm thực phẩm cao cấp bên em đun trực tiếp cực tốt trên <strong>Bếp hồng ngoại, Bếp ga mini và Bếp cồn</strong> bạn nha!<br><br>
• <strong>Bếp từ:</strong> Do cơ chế cảm ứng từ trường nên chất liệu nhôm không bắt từ trực tiếp. Nếu nhà bạn dùng bếp từ, bạn có 2 cách rất tiện:<br>
1. Trút nước cốt và topping vào nồi từ sẵn có ở nhà đun sôi.<br>
2. Chọn dịch vụ <strong>Mượn Bếp Cồn MIỄN PHÍ (0đ)</strong> của Lẩu Nhà để vừa tiện vừa khỏi phải rửa nồi dính mỡ sau khi ăn!`,
                cta: [
                    { text: "🔥 ĐẶT LẨU & MƯỢN BẾP CỒN", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 10: AN TOÀN KHAY NHÔM & CỒN GEL
            {
                id: "aluminum_alcohol_safety",
                label: "🛡️ Khay nhôm & Cồn gel có an toàn?",
                keywords: ["an toan", "khay nhom an toan khong", "doc hai", "thung khay", "mui khet", "cay mat", "con gel", "phong may lanh", "phong kin", "chay no"],
                reply: `Bạn hoàn toàn yên tâm 100% về độ an toàn nha:<br>
• <strong>Khay nhôm:</strong> Là nhôm lá thực phẩm cao cấp dày dặn, chịu nhiệt tới 600°C, đạt kiểm định ATTP. Nước lẩu sôi bùng sau 3-5 phút, không lo thủng hay cháy xém.<br>
• <strong>Cồn gel sinh học:</strong> Cháy êm, không khói, không cay mắt và không có mùi khét, đạt chuẩn an toàn sử dụng trong phòng máy lạnh/chung cư kín. Bếp inox có cần gạt điều chỉnh lửa to nhỏ an toàn tuyệt đối!`,
                cta: [
                    { text: "🍲 YÊN TÂM ĐẶT LẨU NGAY", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 11: PHÍ SHIP & FREESHIP AHAMOVE
            {
                id: "shipping_policy",
                label: "🚚 Phí ship & Freeship thế nào?",
                keywords: ["phi ship", "tien ship", "freeship", "ahamove", "giao hang bao nhieu", "ship bao nhieu", "dia chi", "quan 1", "quan 3", "quan 7", "binh thanh", "go vap", "thu duc", "tan binh"],
                reply: `Lẩu Nhà giao hàng hỏa tốc qua đối tác <strong>Ahamove</strong> theo khoảng cách thực tế, nhân viên sẽ gọi xác nhận và báo rõ phí ship trước khi giao hàng nha.<br><br>
🎁 <strong>CHÍNH SÁCH ƯU ĐÃI SHIP CỰC TỐT:</strong><br>
• Địa chỉ cách bếp <strong>dưới 4km: FREESHIP 100%</strong><br>
• Địa chỉ <strong>trên 5km: Hỗ trợ chia sẻ 20.000đ tiền ship</strong> (áp dụng cho đơn từ 399k)<br><br>
👉 Bạn nhận lẩu kiểm tra đồ tươi mới thanh toán tiền ship cho shipper nha!`,
                cta: [
                    { text: "🛒 ĐẶT LẨU GIAO TẬN NƠI", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 12: THỜI GIAN GIAO HÀNG (30-40 PHÚT)
            {
                id: "delivery_time_speed",
                label: "⚡ Bao lâu thì giao tới nơi?",
                keywords: ["bao lau", "may phut", "thoi gian giao", "giao nhanh", "kip khong", "dang doi", "khi nao toi", "hoa toc", "may gio toi", "dat truoc"],
                reply: `Kịp ăn luôn bạn nha! Nguyên liệu tươi trong ngày bên mình đã sơ chế sạch sẽ trong tủ lạnh chuyên dụng.<br><br>
Sau khi bạn đặt đơn, bếp đóng khay mất đúng 5 phút và shipper Ahamove giao hỏa tốc tận cửa trong vòng <strong>30 đến 40 phút</strong> là có bữa lẩu nóng hổi bốc khói! Bạn cũng có thể đặt hẹn giờ giao trước (ví dụ hẹn 18h30 tối) để đúng giờ có lẩu ăn nha.`,
                cta: [
                    { text: "🔥 ĐẶT LẨU GIAO 30 PHÚT", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 13: BẢO QUẢN & CHƯA ĂN NGAY
            {
                id: "storage_later_use",
                label: "❄️ Chưa ăn ngay bảo quản thế nào?",
                keywords: ["bao quan", "toi moi an", "de qua dem", "chua an ngay", "tu lanh", "ngan mat", "ngan dong", "mai moi an", "chieu moi an", "de duoc bao lau"],
                reply: `Đồ ăn bên mình đóng khay kín tiệt trùng nên bảo quản cực kỳ tiện lợi ạ:<br>
• <strong>Ăn trong ngày (chiều/tối ăn):</strong> Bạn để khay thịt, hải sản và túi nước cốt vào <strong>ngăn mát tủ lạnh</strong>. Khay rau nấm để ngăn rau củ.<br>
• <strong>Để qua ngày hôm sau:</strong> Bạn để khay thịt, hải sản và túi nước cốt lên <strong>ngăn đông</strong>. Khi nào ăn chỉ cần rã đông tự nhiên 15 phút rồi đổ vào khay đun sôi là tươi ngon trọn vị!`,
                cta: [
                    { text: "🛒 ĐẶT LẨU TRƯỚC", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 14: DỌN DẸP 30 GIÂY KHÔNG CẦN RỬA NỒI
            {
                id: "clean_up_zero_mess",
                label: "🧹 Ăn xong dọn dẹp có cực không?",
                keywords: ["don dep", "rua noi", "rua bat", "dau mo", "cuc khong", "30 giay", "30s", "vut rac", "tui rac", "ve sinh", "sach khong", "tien loi"],
                reply: `<strong>Đúng 30 giây là phòng sạch bong bạn ơi!</strong><br><br>
Vì bạn đun trực tiếp trên khay nhôm và có tặng kèm trọn bộ túi gom rác sinh học + khăn trải bàn. Ăn xong bạn chỉ việc túm 4 góc khăn trải bàn gom toàn bộ khay và đồ thừa bỏ vào túi rác rồi vứt. Bàn ăn sạch bóng không dính một giọt dầu mỡ, không phải đùn đẩy nhau đi cọ rửa xoong nồi ngập mỡ màng!`,
                cta: [
                    { text: "🔥 TRẢI NGHIỆM ĂN LẨU KHỎI RỬA NỒI", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 15: CAM KẾT ĐỒ TƯƠI & BẢO HÀNH ĐỔI TRẢ
            {
                id: "freshness_warranty",
                label: "🥩 Cam kết đồ tươi & Bảo hành",
                keywords: ["tuoi ngon", "kiem tra hang", "doi tra", "bao hanh", "uon", "hu hong", "khieu nai", "do tuoi", "thit tuoi", "hai san tuoi", "khong hai long"],
                reply: `Lẩu Nhà cam kết nhập nguyên liệu tươi mới mỗi sáng từ các nhà cung cấp uy tín, đóng khay giữ lạnh suốt đường đi.<br><br>
🛡️ <strong>QUYỀN LỢI CỦA BẠN:</strong><br>
• Khi shipper tới, bạn được <strong>mở kiểm tra đồ tươi ngon đúng ý mới thanh toán</strong>.<br>
• Nếu có bất cứ món nào không tươi hoặc không đúng vị, bên mình áp dụng chính sách <strong>Bảo Hành 100%</strong>: Đổi mới 1-1 hỏa tốc trong 15 phút hoặc hoàn lại 100% tiền ngay lập tức cho bạn!`,
                cta: [
                    { text: "🍲 ĐẶT LẨU TƯƠI NGON NGAY", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 16: MÓN GỌI THÊM (ADD-ONS & GIÁ)
            {
                id: "addons_pricing",
                label: "🥩 Các món gọi thêm & Giá",
                keywords: ["goi them", "them mon", "mon them", "them bo", "them hai san", "them rau", "them mi", "them con", "bat dua", "gia them", "topping them"],
                reply: `Bên mình có menu các món gọi thêm cực kỳ đầy đặn và giá hạt dẻ:<br>
• <strong>Ba chỉ bò Mỹ thêm (200g):</strong> 65.000đ<br>
• <strong>Viên nhúng phô mai tan chảy (6 viên):</strong> 45.000đ<br>
• <strong>Tép cồn gel sinh học:</strong> 15.000đ / tép (cháy 35-45 phút)<br>
• <strong>Bộ bát đũa dùng 1 lần:</strong> 15.000đ / bộ (bát giấy, đũa tre, thìa, khăn ướt, túi rác)<br>
• <strong>Khay nhôm thực phẩm cao cấp:</strong> Tặng MIỄN PHÍ 0đ trong mọi set!`,
                cta: [
                    { text: "🛒 TỰ MIX MÓN THÊM", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 17: BÁO GIÁ TOÀN BỘ MENU (MENU FULL)
            {
                id: "full_menu_pricing",
                label: "📋 Xem toàn bộ Menu & Bảng giá",
                keywords: ["menu", "thuc don", "bang gia", "gia bao nhieu", "gia ca", "cac mon", "danh sach mon", "gia set"],
                reply: `Dạ Lẩu Nhà gửi bạn bảng giá menu trọn gói chi tiết nha:<br><br>
🍲 <strong>CỐT LẨU HẦM 12H (Túi 1L):</strong><br>
• Lẩu Thái Tom Yum: 89.000đ<br>
• Lẩu Nấm Thượng Hạng: 89.000đ<br>
• Lẩu Riêu Cua Đồng: 99.000đ<br>
• Lẩu Tứ Xuyên Tiêu Tê: 99.000đ<br><br>
🥩 <strong>SET COMBO ĐẦY ĐỦ TOPPING & KHAY ĐUN:</strong><br>
• <strong>Set Đôi Lứa (2-3 người):</strong> 249.000đ<br>
• <strong>Set Gia Đình (4-5 người - Free mượn bếp):</strong> 399.000đ<br>
• <strong>Set Đại Tiệc (6-8 người - Free mượn 2 bếp):</strong> 599.000đ`,
                cta: [
                    { text: "🔥 CHỌN SET LẨU NGAY", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 18: DỊ ỨNG HẢI SẢN / ĐỔI MÓN / ĂN CHAY
            {
                id: "allergy_vegetarian",
                label: "🥗 Dị ứng hải sản / Người ăn chay",
                keywords: ["di ung", "an chay", "khong an tom", "khong an muc", "khong an hai san", "doi mon", "doi thit", "doi topping", "chay", "mon chay"],
                reply: `Dạ hoàn toàn được bạn nha!<br><br>
• <strong>Dị ứng hải sản / không ăn tôm mực:</strong> Bạn chỉ cần ghi chú vào đơn: <em>"Đổi tôm mực sang thêm ba chỉ bò Mỹ"</em> hoặc <em>"Đổi sang khay nấm tươi"</em>. Bếp bên mình sẽ cân đối đổi ngang định lượng tương đương cho bạn.<br>
• <strong>Người thích ăn thanh đạm/chay:</strong> Bạn có thể chọn <strong>Lẩu Nấm Thượng Hạng</strong> và ghi chú đổi topping sang combo nấm tổng hợp và đậu hũ non nha!`,
                cta: [
                    { text: "🛒 ĐẶT SET & GHI CHÚ ĐỔI MÓN", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 19: CHƯƠNG TRÌNH KHUYẾN MÃI & MÃ GIẢM GIÁ 50K
            {
                id: "promotions_voucher_50k",
                label: "🎁 Mã giảm giá 50k & Khuyến mãi",
                keywords: ["ma giam gia", "voucher", "ma 50k", "giam 50k", "giam gia", "khuyen mai", "uu dai", "launha50k", "giam50k", "ma uu dai", "lay ma o dau"],
                reply: `Hiện tại Lẩu Nhà đang có 2 chương trình ưu đãi cực hot:<br><br>
1. 🎁 <strong>Mã giảm giá [LAUNHA50K] (Trừ thẳng 50.000đ):</strong> Dành tặng riêng cho khách hàng tham gia khảo sát nhanh 30 giây trên website (mã được gửi thẳng vào email của bạn).<br>
2. 🚚 <strong>Ưu đãi vận chuyển:</strong> FREESHIP dưới 4km + Miễn phí mượn trọn bộ bếp cồn cho đơn từ 399k!`,
                cta: [
                    { text: "🎁 ĐIỀN KHẢO SÁT NHẬN MÃ 50K", action: "survey", primary: true },
                    { text: "🔥 ĐẶT LẨU ÁP DỤNG MÃ", action: "order", primary: false }
                ]
            },

            // TOPIC 20: HƯỚNG DẪN CÁCH NẤU LẨU TẠI NHÀ
            {
                id: "how_to_cook",
                label: "📖 Cách nấu lẩu & Thưởng thức",
                keywords: ["cach nau", "nau nhu the nao", "cach an", "huong dan", "dun the nao", "do nuoc the nao", "pha nuoc lau"],
                reply: `Cách nấu lẩu siêu đơn giản chỉ mất đúng 3 bước:<br><br>
• <strong>Bước 1:</strong> Đặt khay nhôm lên bếp cồn (hoặc bếp ga/hồng ngoại), cắt túi nước cốt đổ trực tiếp vào khay (không cần pha thêm nước vì nước cốt đã được nêm chuẩn vị).<br>
• <strong>Bước 2:</strong> Bật bếp đun sôi bùng trong 3-5 phút là nước lẩu thơm lừng khắp phòng.<br>
• <strong>Bước 3:</strong> Nhúng thịt bò, tôm mực, viên thả lẩu và rau nấm vào thưởng thức kèm sốt chấm đặc sản!`,
                cta: [
                    { text: "🔥 ĐẶT SET LẨU NẤU NGAY", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Voucher 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 21: SO SÁNH TỰ ĐI CHỢ & ĂN BUFFET NGOÀI QUÁN
            {
                id: "compare_market_buffet",
                label: "💡 So sánh tự đi chợ vs Ăn ngoài quán",
                keywords: ["tu di cho", "so voi di cho", "tu nau", "dat khong", "re khong", "an buffet", "an quan", "ngoai quan"],
                reply: `Dạ tính ra đặt Lẩu Nhà tiết kiệm chi phí và khỏe hơn rất nhiều ạ:<br><br>
• <strong>So với tự đi chợ:</strong> Mua lẻ từng lạng thịt bò Mỹ, tôm mực, nấm, gia vị, ninh xương 4-5 tiếng... thường tốn 500k-600k mà lại dư thừa lãng phí, mất cả buổi nhặt rau và cọ rửa nồi mỡ màng. Lẩu Nhà trọn gói chỉ từ 249k-399k, có sẵn bếp khay đun, dọn 30s là xong.<br>
• <strong>So với ăn quán/buffet:</strong> Ra quán cuối tuần đông đúc, chờ bàn 45 phút, giá 350k-400k/người. Ăn tại nhà với Lẩu Nhà vừa ấm cúng riêng tư, tha hồ xem phim nói chuyện mà chỉ khoảng 80k-100k/người!`,
                cta: [
                    { text: "🍲 ĐẶT LẨU NHÀ TIẾT KIỆM NGAY", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                ]
            },

            // TOPIC 22: GIỜ MỞ CỬA, HOTLINE & ĐỊA CHỈ
            {
                id: "hours_contact_hotline",
                label: "📞 Hotline, Giờ mở cửa & Địa chỉ",
                keywords: ["hotline", "so dien thoai", "lien he", "gio mo cua", "may gio ban", "dia chi", "o dau", "shop o dau", "zalo"],
                reply: `Thông tin liên hệ chính thức của Lẩu Nhà:<br><br>
• ⏰ <strong>Giờ phục vụ:</strong> 09:00 - 23:00 (Tất cả các ngày trong tuần, kể cả Thứ 7, Chủ Nhật & Ngày Lễ).<br>
• 📞 <strong>Hotline / Zalo đặt gấp:</strong> <a href="https://zalo.me/0819943904" target="_blank" style="color:#ea580c;font-weight:bold;">0819 943 904</a><br>
• 🌐 <strong>Website đặt lẩu trực tiếp:</strong> <a href="https://laumangdi.com" style="color:#ea580c;font-weight:bold;">laumangdi.com</a><br>
• 🚀 <strong>Giao hàng:</strong> Hỏa tốc 30-40 phút khắp các quận huyện TP.HCM!`,
                cta: [
                    { text: "💬 Nhắn Qua Zalo (0819 943 904)", action: "zalo", primary: true },
                    { text: "🔥 ĐẶT LẨU TRỰC TIẾP", action: "order", primary: false }
                ]
            },

            // TOPIC 23: CẢM ƠN / KẾT THÚC TRÒ CHUYỆN
            {
                id: "thank_you_closing",
                label: "💖 Cảm ơn Lẩu Nhà",
                keywords: ["cam on", "thank you", "thanks", "tks", "ok shop", "da hieu", "ok ban", "minh biet roi"],
                reply: `Dạ không có gì ạ! Rất vui được hỗ trợ bạn. ✨<br><br>Khi nào bạn và gia đình muốn thưởng thức tiệc lẩu tươi ngon tại nhà, cứ ghé Lẩu Nhà đặt trước 30-40 phút là có lẩu nóng hổi giao tận cửa, ăn xong dọn 30 giây sạch bóng nha!<br><br>Chúc bạn một ngày thật nhiều niềm vui và ngon miệng ạ! 🍲🧡`,
                cta: [
                    { text: "🔥 ĐẶT LẨU KHI CẦN", action: "order", primary: true },
                    { text: "🎁 Nhận Mã Ưu Đãi 50K", action: "survey", primary: false }
                ]
            }
        ],

        // KỊCH BẢN CHỐT ĐƠN
        closingOrder: {
            reply: `Hôm nay bên mình đang có mã <strong>[LAUNHA50K]</strong> giảm ngay 50.000đ và <strong>FREE mượn trọn bộ bếp cồn</strong> cho đơn từ 399k.<br><br>Bạn lấy <strong>Set Gia Đình</strong> vị <strong>Thái Tom Yum chua cay</strong> hay <strong>Lẩu Nấm thảo mộc thanh ngọt</strong> để bếp chuẩn bị giao nóng hổi qua cho bạn luôn nè? Bạn bấm nút bên dưới để chọn món nha! ✨`,
            btnText: "🔥 TỰ MIX SET LẨU (GIẢM 50K)",
            action: "order"
        },

        // KỊCH BẢN HƯỚNG DẪN KHẢO SÁT
        leadSurvey: {
            reply: `Dạ không sao nè bạn, khi nào thèm lẩu cứ ới bên mình 30 phút là có lẩu nóng hổi giao tận cửa! ✨<br><br>Hiện bên mình đang có chương trình <strong>Khảo sát ngắn 30 giây nhận ngay Mã Giảm 50.000đ</strong> gửi thẳng vào email. Bạn điền form nhanh ở đây để lưu quà tặng dùng khi đặt lẩu nha: 😊`,
            btnText: "🎁 ĐIỀN KHẢO SÁT NHẬN MÃ 50K",
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

        window.openLauNhaChatbot = openChat;

        // Auto open if URL contains ?open_chat=1 or hash is #chatbot
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('open_chat') || window.location.hash === '#chatbot') {
                setTimeout(() => {
                    openChat();
                }, 600);
            }
        } catch (e) {}

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
            handleUserTextInput(text);
        });

        function renderInitialState() {
            appendBotMessage(KNOWLEDGE_BASE.greeting, [
                { text: "🛒 TÔI MUỐN ĐẶT LẨU NGAY", action: "order", primary: true },
                { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
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
            surveyChip.innerHTML = '🎁 Nhận mã 50K';
            surveyChip.addEventListener('click', () => handleUserAction('survey', 'Tôi muốn nhận mã ưu đãi 50.000đ'));
            chipsContainer.appendChild(surveyChip);

            // Các câu hỏi gợi ý từ kho tri thức
            KNOWLEDGE_BASE.topics.forEach(item => {
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
                    } else if (action === 'zalo') {
                        window.open('https://zalo.me/0819943904', '_blank');
                    }
                });
            });

            messagesArea.appendChild(msg);
            scrollToBottom();
        }

        function handleUserQuestion(item) {
            appendUserMessage(item.label.replace(/^[^\w\s\d]+/, '').trim());
            setTimeout(() => {
                appendBotMessage(item.reply, item.cta || [
                    { text: "👉 Đặt Set Lẩu Giảm 50K", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                ]);
            }, 250);
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
            }, 250);
        }

        // BỘ XỬ LÝ NHẬN DIỆN CÂU HỎI THÔNG MINH (PRIORITY INTENT + NLP FUZZY MATCHING)
        function findBestAnswer(userRawText) {
            const normalized = normalizeText(userRawText);
            if (!normalized) return null;

            // 1. Chào hỏi ban đầu
            if (/^(chao|hi|hello|alo|hai|helo|xin chao|shop|ad|b oi|e oi)\b/.test(normalized) && normalized.split(' ').length <= 4) {
                return {
                    reply: KNOWLEDGE_BASE.greeting,
                    cta: [
                        { text: "🛒 TÔI MUỐN ĐẶT LẨU NGAY", action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                    ]
                };
            }

            // 2. Lời cảm ơn / Đóng hội thoại
            if (/\b(cam on|thank|thanks|tks|ok shop|da hieu|ok ban|biet roi|da ro)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "thank_you_closing");
                if (topic) return topic;
            }

            // 3. Ý định Chốt đơn / Mua hàng trực tiếp
            if (/\b(mua|dat hang|order|lay set|chot don|thanh toan|tinh tien|cho minh 1 set|lay minh 1 set|muon dat|ship cho minh|giao cho minh)\b/.test(normalized)) {
                return {
                    reply: KNOWLEDGE_BASE.closingOrder.reply,
                    cta: [
                        { text: KNOWLEDGE_BASE.closingOrder.btnText, action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                    ]
                };
            }

            // 3.1. XỬ LÝ CÂU HỎI KẾT HỢP: TRẺ EM / CON NÍT + LẨU THÁI / ĐỘ CAY / SỐ NGƯỜI
            const hasChild = /\b(tre con|tre em|con nit|be nho|tre nho|em be|con nho|chau nho|be)\b/.test(normalized);
            const hasThaiOrSpicy = /\b(lau thai|thai|tom yum|cay|cay khong|co cay|hop cho con nit|hop cho be|an duoc khong|hop khong)\b/.test(normalized);
            if (hasChild && (hasThaiOrSpicy || normalized.includes("con nit"))) {
                return {
                    reply: `Dạ Lẩu Nhà xin chia sẻ thẳng thắn để bạn yên tâm chọn món cho gia đình nha:<br><br>
🌶️ <strong>1. Về Lẩu Thái Tom Yum đối với các bé:</strong><br>
Nước lẩu Thái Tom Yum bên mình có vị <strong>chua thanh & cay nồng vừa</strong> (từ ớt xiêm rừng và chanh sả tươi). Với các bé nhỏ chưa quen ăn cay thì vị này sẽ <strong>hơi cay đối với bé</strong> bạn nha.<br><br>
👶 <strong>2. Gợi ý chuẩn bài nhất cho gia đình có trẻ nhỏ:</strong><br>
• <strong>Lựa chọn số 1 (Tốt nhất cho bé): Lẩu Nấm Thượng Hạng (89k)</strong> — Nước dùng ninh từ nấm tùng nhung, đông trùng hạ thảo & kỷ tử ngọt thanh, <strong>hoàn toàn không cay (0%)</strong>, cực kỳ bổ dưỡng và lành bụng cho bé.<br>
• <strong>Lựa chọn số 2: Lẩu Riêu Cua Đồng (99k)</strong> — Vị thơm béo bùi truyền thống thanh mát.<br>
👉 <em>Bên mình luôn để riêng gói sa tế tắc và ớt tươi bên ngoài</em>, bố mẹ thích ăn cay chỉ cần tự chấm thêm vào chén của mình là cả nhà đều trọn vị!<br><br>
🥩 <strong>3. Về định lượng set cho 2 người lớn + 1 bé:</strong><br>
Bạn chọn <strong>Set Topping Đôi Lứa (249.000đ)</strong> (350g bò Mỹ/Úc, tôm thẻ tươi 4 con, viên nhúng, rau nấm, mì) là vừa xinh và no nê cho cả nhà ạ!`,
                    cta: [
                        { text: "🍲 ĐẶT LẨU NẤM CHO BÉ (0% CAY)", action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                    ]
                };
            }

            // 3.2. XỬ LÝ CÂU HỎI MẸ BẦU / MANG THAI
            if (/\b(ba bau|mang thai|co bau|me bau|dang mang bau)\b/.test(normalized)) {
                return {
                    reply: `Dạ với các mẹ bầu cần thanh đạm, lành tính và bổ dưỡng thì bạn nên chọn:<br><br>
🍲 <strong>Lẩu Nấm Thượng Hạng (89k):</strong> Nước dùng ninh 12 tiếng từ nấm tùng nhung, kỷ tử, táo đỏ ngọt thanh tự nhiên, <strong>0% cay và không bột ngọt</strong>, rất an tâm cho mẹ và bé.<br>
🥩 Kết hợp cùng <strong>Set Topping Gia Đình hoặc Đôi Lứa</strong> gồm thịt bò Úc/Mỹ và hải sản tươi rói trong ngày.<br><br>
👉 Mọi nguyên liệu đều có kiểm định ATTP và đóng khay tiệt trùng, bạn kiểm tra tươi mới thanh toán nha!`,
                    cta: [
                        { text: "🍲 ĐẶT LẨU NẤM BỔ DƯỠNG", action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                    ]
                };
            }

            // 3.3. XỬ LÝ CÂU HỎI NGƯỜI GIÀ / ÔNG BÀ / NGƯỜI LỚN TUỔI
            if (/\b(nguoi gia|ong ba|nguoi lon tuoi|nguoi cao tuoi|bo me lon tuoi)\b/.test(normalized)) {
                return {
                    reply: `Dạ <strong>Lẩu Nấm Thượng Hạng (89k/túi 1L)</strong> là lựa chọn số 1 và sinh ra là dành riêng cho người lớn tuổi / ông bà luôn ạ! 👵👴<br><br>
🍄 <strong>Vì sao Lẩu Nấm rất tốt cho người già:</strong><br>
• Nước cốt được ninh 12 tiếng từ nấm tùng nhung, đông trùng hạ thảo, táo đỏ và kỷ tử.<br>
• <strong>Hoàn toàn 0% CAY, ngọt thanh tự nhiên và KHÔNG BỘT NGỌT</strong>, cực kỳ lành bụng, thanh lọc cơ thể và tốt cho tim mạch, giấc ngủ của ông bà.<br><br>
🥩 Bạn có thể kết hợp cùng <strong>Set Topping Gia Đình (399k)</strong> hoặc <strong>Đôi Lứa (249k)</strong> có sẵn thịt bò Úc mềm, tôm tươi và rau nấm sạch. Đơn từ 399k còn được <strong>FREE mượn trọn bộ bếp cồn 0đ</strong> để cả nhà quây quần ấm cúng tại bàn!`,
                    cta: [
                        { text: "🍲 ĐẶT LẨU NẤM BỔ DƯỠNG (89K)", action: "order", primary: true },
                        { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                    ]
                };
            }

            // 3.4. XỬ LÝ KHÁCH DO DỰ / ĐỂ TÔI NGHĨ THÊM / CHƯA MUA NGAY (UPSELL VOUCHER & KHẢO SÁT)
            if (/\b(nghi them|suy nghi|suy nghi them|xem lai|xem them|de lat|de toi|de khi khac|chua mua|chua dat|de hoi|phan van|de xem|de tinh|chua voi)\b/.test(normalized)) {
                return {
                    reply: `Dạ không sao nè bạn ơi, bạn cứ thong thả tham khảo thêm nha! ✨<br><br>
🎁 <strong>Để không bị lỡ quyền lợi, Lẩu Nhà đang có 3 ƯU ĐÃI ĐẶC QUYỀN HÔM NAY bạn có thể lưu lại để dùng khi cần nè:</strong><br>
1. 🎟️ <strong>Mã giảm trực tiếp 50.000đ [LAUNHA50K]:</strong> Tặng riêng khi bạn điền khảo sát 30 giây (mã gửi thẳng vào email, dùng được cho mọi đơn hàng).<br>
2. 🔥 <strong>Miễn phí mượn trọn bộ bếp cồn 0đ:</strong> Áp dụng cho đơn từ 399k (hôm sau shipper tự qua lấy lại, không cần rửa nồi).<br>
3. 🚚 <strong>Freeship hỏa tốc dưới 4km</strong> & hỗ trợ 20.000đ tiền ship cho đơn trên 5km!<br><br>
👉 Bạn bấm nút bên dưới điền form 30 giây để <strong>nhận và lưu mã 50k vào email</strong> trước nha, khi nào thèm lẩu chỉ cần mang ra áp dụng là được giảm ngay ạ! 😊`,
                    cta: [
                        { text: "🎁 ĐIỀN KHẢO SÁT NHẬN MÃ 50K", action: "survey", primary: true },
                        { text: "🔥 Xem Lại Menu Lẩu", action: "order", primary: false }
                    ]
                };
            }

            // 3.5. XỬ LÝ CÂU HỎI TÍNH TOÁN NGÂN SÁCH (SMART BUDGET OPTIMIZER)
            const budgetVal = parseBudget(userRawText);
            if (budgetVal && (/\b(co|tam|khoang|ngan sach|chi phi|tien|goi y|an duoc|mua duoc|set nao|combo nao|phu hop|thoi|duoc gi)\b/.test(normalized) || budgetVal >= 50000)) {
                if (budgetVal < 250000) {
                    return {
                        reply: `Với ngân sách khoảng <strong>${budgetVal.toLocaleString('vi-VN')}đ</strong>, Lẩu Nhà gợi ý bạn 2 phương án cực kỳ kinh tế và ngon miệng ạ:<br><br>
🥣 <strong>Phương án 1 (Tiết kiệm nhất):</strong> Mua <strong>1-2 túi Nước Cốt Lẩu Hầm 12H (89k - 99k/túi 1L)</strong>. Nước cốt đã được hầm xương đậm đà chuẩn vị, bạn chỉ cần mua thêm ít rau thịt sẵn có ở nhà nhúng ăn là siêu rẻ và ngon miệng!<br><br>
🎁 <strong>Phương án 2 (Ăn trọn combo có thịt tươi):</strong> Bạn điền khảo sát 30s lấy ngay mã giảm <strong>[LAUNHA50K]</strong> (giảm 50k) -> Bạn đặt <strong>1 Túi Cốt Lẩu (89k) + Set Đôi Lứa (249k) = 338k chỉ còn 288.000đ</strong> trọn gói!`,
                        cta: [
                            { text: "🎁 LẤY MÃ 50K ĐẶT COMBO 288K", action: "survey", primary: true },
                            { text: "🍲 Tự Mix Cốt Lẩu (89k)", action: "order", primary: false }
                        ]
                    };
                } else if (budgetVal >= 250000 && budgetVal < 420000) {
                    return {
                        reply: `Với ngân sách khoảng <strong>${budgetVal.toLocaleString('vi-VN')}đ</strong>, bạn hoàn toàn có thể thưởng thức một bữa tiệc lẩu trọn gói <strong>ĐẦY ĐỦ CẢ NƯỚC LẨU VÀ THỊT TƯƠI</strong> cho 2-3 người ạ:<br><br>
🍲 <strong>COMBO TRỌN GÓI 2-3 NGƯỜI (Giá gốc 338.000đ):</strong><br>
• <strong>1. Nước cốt hầm xương 12h:</strong> 1 Túi Lẩu Thái Tom Yum hoặc Lẩu Nấm 1L (<strong>89.000đ</strong>).<br>
• <strong>2. Set Topping Đôi Lứa (249.000đ):</strong> 350g Ba chỉ bò Mỹ + Bắp bò Úc, tôm thẻ tươi (4 con), viên nhúng, khay rau nấm sạch, mì lẩu & khay nhôm đun trực tiếp.<br><br>
🎁 <strong>BÍ QUYẾT VỪA KHÍT NGÂN SÁCH:</strong><br>
Bạn chỉ cần điền khảo sát 30s lấy mã <strong>[LAUNHA50K]</strong> (trừ thẳng 50.000đ) -> <strong>Tổng thanh toán chỉ còn 288.000đ</strong> (dưới ${budgetVal.toLocaleString('vi-VN')}đ, ăn no nê từ A-Z khỏi rửa nồi)!`,
                        cta: [
                            { text: "🔥 TỰ MIX COMBO 288K NGAY", action: "order", primary: true },
                            { text: "🎁 Khảo Sát Lấy Mã 50K", action: "survey", primary: false }
                        ]
                    };
                } else if (budgetVal >= 420000 && budgetVal < 600000) {
                    return {
                        reply: `Với ngân sách khoảng <strong>${budgetVal.toLocaleString('vi-VN')}đ</strong>, combo "chân ái" cho nhóm 4-5 người ăn no căng bụng là:<br><br>
👨‍👩‍👧‍👦 <strong>COMBO GIA ĐÌNH TRỌN GÓI (Giá gốc 488.000đ):</strong><br>
• <strong>1. Nước cốt hầm xương 12h:</strong> 1 Túi Lẩu Thái / Lẩu Nấm / Riêu Cua 1L (<strong>89.000đ - 99.000đ</strong>).<br>
• <strong>2. Set Topping Gia Đình (399.000đ):</strong> 600g Ba chỉ bò Mỹ & Lõi vai Úc + 300g Tôm mực tươi + 10 Viên nhúng + 2 khay rau nấm & mì tươi.<br><br>
🎁 <strong>ƯU ĐÃI ĐẶC QUYỀN:</strong><br>
• Được <strong>MIỄN PHÍ MƯỢN TRỌN BỘ BẾP CỒN (0đ)</strong> mang tận nhà (hôm sau shipper tự qua lấy lại)!<br>
• Áp dụng mã <strong>[LAUNHA50K]</strong> -> <strong>Tổng thanh toán chỉ còn 438.000đ</strong> (vừa xinh ngân sách của bạn)!`,
                        cta: [
                            { text: "🔥 ĐẶT COMBO GIA ĐÌNH (438K)", action: "order", primary: true },
                            { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                        ]
                    };
                } else {
                    return {
                        reply: `Với ngân sách khoảng <strong>${budgetVal.toLocaleString('vi-VN')}đ</strong>, bạn có thể tổ chức một bữa tiệc lẩu hoành tráng cho 6-8 người cực kỳ xịn sò:<br><br>
🎉 <strong>COMBO ĐẠI TIỆC TRỌN GÓI:</strong><br>
• <strong>1. Nước cốt lẩu:</strong> 2 Túi cốt lẩu 1L tùy chọn 2 vị (178.000đ).<br>
• <strong>2. Set Topping Đại Tiệc (599.000đ):</strong> 800g Bò thượng hạng + 500g Hải sản (Tôm, mực, cá hồi) + 16 Viên phô mai + 3 khay rau nấm, mì Udon.<br>
• 🎁 Tặng kèm 2 khay nhôm đun + <strong>FREE mượn 2 bộ bếp cồn</strong> mang tận nhà.<br><br>
👉 Áp dụng mã <strong>[LAUNHA50K]</strong> -> Tổng trọn gói chỉ khoảng <strong>727.000đ</strong> cho cả bàn tiệc 8 người!`,
                        cta: [
                            { text: "🔥 ĐẶT COMBO ĐẠI TIỆC", action: "order", primary: true },
                            { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                        ]
                    };
                }
            }

            // 4. Giá cả / Menu / Bảng giá (Ưu tiên cao nhất)
            if (/\b(gia|gia ca|gia san pham|gia tien|bao nhieu|nhieu tien|bao nhieu tien|menu|thuc don|bang gia|bao gia)\b/.test(normalized)) {
                if (/\b(them|goi them|topping|bo my them|vien phomai|con gel|bat dua|gia them)\b/.test(normalized)) {
                    const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "addons_pricing");
                    if (topic) return topic;
                }
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "full_menu_pricing");
                if (topic) return topic;
            }

            // 5. Ý định Khảo sát / Nhận mã giảm giá
            if (/\b(form|khao sat|voucher|ma giam|ma 50k|giam 50k|giam 50|uu dai 50|chua mua|tham khao|luu ma|lay ma)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "promotions_voucher_50k");
                if (topic) return topic;
            }

            // 6. Trích xuất thực thể số người (Entity Recognition)
            if (/\b(1 nguoi|2 nguoi|3 nguoi|2 3 nguoi|2 den 3 nguoi|2 vo chong|cap doi|nguoi yeu|hai nguoi|ba nguoi|2 ng|3 ng)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "people_couple_2_3");
                if (topic) return topic;
            }
            if (/\b(4 nguoi|5 nguoi|4 5 nguoi|4 den 5 nguoi|gia dinh|nha 4 nguoi|nha 5 nguoi|bon nguoi|nam nguoi|4 ng|5 ng)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "people_family_4_5");
                if (topic) return topic;
            }
            if (/\b(6 nguoi|7 nguoi|8 nguoi|9 nguoi|10 nguoi|dong nguoi|dai tiec|lien hoan|sinh nhat|cong ty|hop mat|6 ng|7 ng|8 ng|10 ng)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "people_party_6_8");
                if (topic) return topic;
            }

            // 7. Cách nấu / Chế biến / Cách ăn
            if (/\b(cach nau|nau nhu the nao|huong dan nau|che bien|pha nuoc|cach an|dun the nao|nau lau|huong dan an|dun nhu the nao)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "how_to_cook");
                if (topic) return topic;
            }

            // 8. Mượn bếp cồn & Cọc bếp
            if (/\b(muon bep|thue bep|coc bep|tien coc|200k|200000|tra bep|thu hoi bep|bep con)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "stove_loan_deposit");
                if (topic) return topic;
            }

            // 9. Bếp từ & Thiết bị nấu
            if (/\b(bep tu|bep hong ngoai|bep ga|bep ga mini|khay nhom|dun tren bep tu|bat tu)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "stove_compatibility");
                if (topic) return topic;
            }

            // 10. Phí ship & Freeship & Quận huyện
            if (/\b(phi ship|tien ship|freeship|ahamove|giao hang|quan 1|quan 2|quan 3|quan 4|quan 5|quan 6|quan 7|quan 8|quan 9|quan 10|quan 11|quan 12|binh thanh|go vap|thu duc|tan binh|tan phu|binh tan|nha be|hoc mon)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "shipping_policy");
                if (topic) return topic;
            }

            // 11. Thời gian giao hàng
            if (/\b(bao lau|may phut|thoi gian giao|khi nao toi|hoa toc|may gio toi|dat truoc|hen gio|dang doi)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "delivery_time_speed");
                if (topic) return topic;
            }

            // 12. Bảo quản đồ ăn
            if (/\b(bao quan|tu lanh|ngan mat|ngan dong|toi moi an|mai moi an|chieu moi an|de duoc bao lau|de qua dem|chua an ngay)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "storage_later_use");
                if (topic) return topic;
            }

            // 13. Dọn dẹp Zero-Mess
            if (/\b(don dep|rua noi|rua bat|dau mo|30 giay|30s|tui rac|gom rac|ve sinh|sach khong)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "clean_up_zero_mess");
                if (topic) return topic;
            }

            // 14. Đồ tươi / Đổi trả / Bảo hành
            if (/\b(tuoi ngon|do tuoi|thit tuoi|hai san tuoi|kiem tra hang|doi tra|bao hanh|hu hong|uon|khieu nai|khong hai long)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "freshness_warranty");
                if (topic) return topic;
            }

            // 15. Không cay / Trẻ em / Người già
            if (/\b(khong cay|it cay|tre em|tre nho|be nho|con nit|nguoi gia|ong ba|ba bau|thanh dam|ngot thanh|lau nam)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "spicy_none_kids");
                if (topic) return topic;
            }

            // 16. Chua cay / Tom Yum / Tứ Xuyên
            if (/\b(chua cay|cay nong|cay nhieu|sieu cay|tom yum|thai|tu xuyen|tieu te)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "spicy_tomyum_sichuan");
                if (topic) return topic;
            }

            // 17. Khác biệt cốt hầm 12h vs Bột ngọt
            if (/\b(khac gi|bot ngot|say bot ngot|khat nuoc|khat kho co|ham 12h|ham xuong|chat luong|dau mo)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "broth_difference");
                if (topic) return topic;
            }

            // 18. Dị ứng / Đổi món / Ăn chay
            if (/\b(di ung|an chay|khong an tom|khong an muc|khong an hai san|doi mon|doi thit|chay|mon chay)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "allergy_vegetarian");
                if (topic) return topic;
            }

            // 19. Hotline / Giờ mở cửa / Liên hệ
            if (/\b(hotline|so dien thoai|lien he|gio mo cua|may gio ban|dia chi|o dau|shop o dau|zalo)\b/.test(normalized)) {
                const topic = KNOWLEDGE_BASE.topics.find(t => t.id === "hours_contact_hotline");
                if (topic) return topic;
            }

            // 20. So khớp trọng số Fuzzy Token Overlap dự phòng
            let bestTopic = null;
            let highestScore = 0;
            const userTokens = normalized.split(' ').filter(w => w.length >= 2);

            KNOWLEDGE_BASE.topics.forEach(topic => {
                let score = 0;

                topic.keywords.forEach(kw => {
                    const normKw = normalizeText(kw);
                    if (normalized.includes(normKw)) {
                        score += normKw.length * 3;
                    } else {
                        const kwTokens = normKw.split(' ');
                        let overlapCount = 0;
                        kwTokens.forEach(kt => {
                            if (userTokens.includes(kt)) overlapCount++;
                        });
                        if (overlapCount >= 2 || (kwTokens.length === 1 && overlapCount === 1)) {
                            score += overlapCount * 4;
                        }
                    }
                });

                if (score > highestScore) {
                    highestScore = score;
                    bestTopic = topic;
                }
            });

            // Nếu điểm đạt ngưỡng tin cậy >= 6
            if (bestTopic && highestScore >= 6) {
                return bestTopic;
            }

            // Fallback linh hoạt, thân thiện
            return {
                reply: `Dạ Lẩu Nhà đã lắng nghe câu hỏi của bạn! Bạn có thể chọn nhanh các chủ đề phổ biến bên dưới, hoặc bấm nút tự mix set lẩu để nhận ưu đãi giảm 50.000đ nha:`,
                cta: [
                    { text: "🔥 TỰ MIX SET LẨU (GIẢM 50K)", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                ]
            };
        }

        function showTypingIndicator() {
            const typing = document.createElement('div');
            typing.className = 'chat-msg bot chat-typing-msg';
            typing.id = 'chatTypingIndicator';
            typing.innerHTML = `
                <div class="chat-msg-avatar"><i class="fa-solid fa-fire"></i></div>
                <div class="chat-msg-content" style="padding: 10px 14px;">
                    <span style="font-size: 13px; color: #78716c; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-circle-notch fa-spin"></i> Lẩu Nhà đang soạn câu trả lời...
                    </span>
                </div>
            `;
            messagesArea.appendChild(typing);
            scrollToBottom();
        }

        function removeTypingIndicator() {
            const typing = document.getElementById('chatTypingIndicator');
            if (typing) typing.remove();
        }

        async function handleUserTextInput(text) {
            appendUserMessage(text);
            showTypingIndicator();

            try {
                // TẦNG 1: Gửi lên Gemini AI Assistant Backend
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.reply) {
                        removeTypingIndicator();
                        appendBotMessage(data.reply, data.cta || [
                            { text: "🔥 TỰ MIX SET LẨU (GIẢM 50K)", action: "order", primary: true },
                            { text: "🎁 Khảo Sát Nhận Mã 50K", action: "survey", primary: false }
                        ]);
                        return;
                    }
                }
            } catch (err) {
                console.warn("[Chatbot AI API Error, using Local Fallback]:", err);
            }

            // TẦNG 2: Fallback an toàn về Local NLP Matcher nếu API gặp sự cố
            removeTypingIndicator();
            const matchedResult = findBestAnswer(text);
            if (matchedResult) {
                appendBotMessage(matchedResult.reply, matchedResult.cta || [
                    { text: "👉 Đặt Set Lẩu Giảm 50K", action: "order", primary: true },
                    { text: "🎁 Khảo Sát Nhận Ưu Đãi 50K", action: "survey", primary: false }
                ]);
            }
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
