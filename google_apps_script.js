/**
 * HƯỚNG DẪN KẾT NỐI GOOGLE SHEET LƯU ĐƠN HÀNG LẨU NHÀ
 * 
 * Bước 1: Mở Google Sheet bạn muốn lưu đơn hàng (https://sheets.google.com)
 * Bước 2: Tạo dòng tiêu đề ở Hàng 1 (Row 1):
 *   A1: Thời Gian Đặt
 *   B1: Mã Đơn Hàng
 *   C1: Tên Khách Hàng
 *   D1: Số Điện Thoại
 *   E1: Email
 *   F1: Địa Chỉ Giao Hàng
 *   G1: Chi Tiết Món Đặt
 *   H1: Mượn Bếp Cồn
 *   I1: Tổng Tiền
 *   J1: Trạng Thái
 * 
 * Bước 3: Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script
 * Bước 4: Xóa hết code cũ và dán toàn bộ đoạn code dưới đây vào:
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Thêm 1 dòng mới vào Google Sheet
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('vi-VN'),
      data.order_code || '',
      data.cust_name || '',
      data.cust_phone || '',
      data.cust_email || '',
      data.cust_address || '',
      data.items || '',
      data.stove_included || '',
      data.total_price || '',
      data.status || 'Chờ xác nhận'
    ]);

    return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Bước 5: Bấm nút 'Triển khai' (Deploy) ở góc trên bên phải -> Chọn 'Tùy chọn triển khai mới' (New deployment)
 *   - Chọn loại: Ứng dụng web (Web app)
 *   - Mô tả: Lau Nha Order Receiver
 *   - Thực thi dưới dạng: Tôi (Me)
 *   - Ai có quyền truy cập: Bất kỳ ai (Anyone)  <-- BẮT BUỘC CHỌN 'BẤT KỲ AI'
 * Bước 6: Bấm 'Triển khai' (Deploy) -> Cấp quyền (Authorize Access)
 * Bước 7: Copy đường link URL Web App nhận được (dạng: https://script.google.com/macros/s/AKfycb.../exec)
 * 
 * Bước 8: 
 *   - Trên Vercel: Vào Settings -> Environment Variables -> Thêm biến GOOGLE_SHEET_URL với giá trị là link vừa copy.
 *   - Hoặc gán trực tiếp biến GOOGLE_SHEET_URL vào file server.js / api/send-order.js
 */
