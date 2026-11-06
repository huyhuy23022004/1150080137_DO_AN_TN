# FUTA Bus System - Backend

Backend API cho hệ thống quản lý đặt vé xe trực tuyến (đồ án tốt nghiệp), triển khai theo mô hình của FUTA.

- **Stack:** Node.js 20+, TypeScript, Express 5, MySQL 8.0 (`mysql2/promise`, raw SQL), Redis 7 (`ioredis`), JWT, bcrypt.
- **Kiến trúc:** Controller → Service → Repository. Redis là advisory lock, DB `UNIQUE` là nguồn xác thực cuối cùng.
- **Phạm vi hiện tại:** Phase 1 - Base Setup & Auth; Phase 2 - Danh mục xe/tuyến/chuyến, chi nhánh, người dùng; Phase 3 - Giữ ghế realtime, đặt vé và thanh toán tiền mặt tại quầy.

Kế hoạch kiến trúc đầy đủ: `../docs/ARCHITECTURE_PLAN.md`.

## 1. Yêu cầu môi trường

- Node.js **20+** (khuyến nghị 24 LTS)
- MySQL **8.0**
- Redis **7+**
- Hoặc Docker Desktop để chạy MySQL/Redis/API bằng `docker-compose.yml`

> Trên Windows PowerShell, nếu bị chặn `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

## 2. Cài đặt

```bash
cd backend
npm install
cp .env.example .env
```

Mở `.env` và cập nhật tối thiểu:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=futa
DB_PASSWORD=futa_dev_password
DB_NAME=quan_ly_ve_xe

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

JWT_ACCESS_SECRET=<chuỗi-ngẫu-nhiên-ít-nhất-32-ký-tự>
JWT_REFRESH_SECRET=<chuỗi-ngẫu-nhiên-ít-nhất-32-ký-tự>
QR_SECRET=<chuỗi-ngẫu-nhiên-ít-nhất-32-ký-tự>

ADMIN_PHONE=0900000000
ADMIN_PASSWORD=Admin@123456
```

Lưu ý:

- Không commit `.env`.
- Ở `NODE_ENV=production`, các secret bắt buộc phải đủ mạnh và không được dùng giá trị mặc định.
- MySQL dùng timezone UTC (`SET time_zone = '+00:00'`); thời gian hiển thị/thanh toán VNPAY được format theo GMT+7 ở tầng xử lý.
- `BIGINT` và `DECIMAL` được trả về dạng string để tránh mất độ chính xác.

Nếu chưa có database/user, tạo bằng MySQL root:

```sql
CREATE DATABASE IF NOT EXISTS quan_ly_ve_xe
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'futa'@'%' IDENTIFIED BY 'futa_dev_password';
GRANT ALL PRIVILEGES ON quan_ly_ve_xe.* TO 'futa'@'%';
FLUSH PRIVILEGES;
```

## 3. Migration & seed

```bash
npm run db:migrate
npm run db:seed
```

- `database/migrations/001_init.sql`: tạo 13 bảng nghiệp vụ.
- `database/migrations/002_optional_constraints.sql`: bổ sung trạng thái vé, generated column và unique index phục vụ hủy vé/giữ chỗ.
- `database/seeds/001_base_data.sql`: vai trò, chi nhánh, xe, sơ đồ ghế Limousine 34 chỗ, tuyến Sài Gòn - Đà Lạt.
- Seed admin được tạo từ `ADMIN_PHONE` / `ADMIN_PASSWORD` (bỏ qua nếu thiếu hoặc đã tồn tại).
- `SEED_DEMO_DATA=true` tạo thêm 7 tài khoản demo đủ 6 vai trò và 3 chuyến sắp chạy. Mật khẩu của tài khoản demo dùng chung `ADMIN_PASSWORD` (giá trị local mặc định là `Admin@123456`), chỉ dành cho môi trường local. Tài khoản `KHACH_HANG` dùng để đăng nhập app mobile.

| Số điện thoại | Mật khẩu       | Vai trò              | Chi nhánh        |
| ------------- | -------------- | -------------------- | ---------------- |
| `0900000000`  | `Admin@123456` | `QUAN_TRI_VIEN`      | —                |
| `0901000001`  | `Admin@123456` | `TAI_XE`             | PV_MIEN_TAY      |
| `0901000002`  | `Admin@123456` | `TAI_XE`             | PV_DA_LAT        |
| `0901000003`  | `Admin@123456` | `QUAN_LY_CHI_NHANH`  | PV_MIEN_TAY      |
| `0901000004`  | `Admin@123456` | `NHAN_VIEN_PHONG_VE` | PV_MIEN_TAY      |
| `0901000005`  | `Admin@123456` | `NHAN_VIEN_PHONG_VE` | PV_LE_HONG_PHONG |
| `0901000006`  | `Admin@123456` | `DIEU_HANH`          | PV_MIEN_TAY      |
| `0901000007`  | `Admin@123456` | `KHACH_HANG`         | —                |

Chạy gộp:

```bash
npm run db:setup
```

## 4. Chạy ứng dụng

Development (hot reload):

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

Mặc định API: `http://localhost:3000/api/v1`

Health check:

- `GET /livez` - process còn sống, không phụ thuộc MySQL/Redis.
- `GET /healthz` - kiểm tra MySQL và Redis; trả `503` nếu một dependency down.

## 5. Docker

```bash
docker compose up --build
```

Compose sẽ khởi động MySQL, Redis, chạy migration + seed, rồi chạy API. Dữ liệu được giữ trong volume `mysql_data` và `redis_data`.

## 6. Scripts

| Script               | Mô tả                                  |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Chạy dev với `tsx watch`               |
| `npm run build`      | Compile TypeScript sang `dist/`        |
| `npm start`          | Chạy bản build                         |
| `npm run typecheck`  | Kiểm tra TypeScript                    |
| `npm run lint`       | ESLint                                 |
| `npm run format`     | Prettier                               |
| `npm test`           | Chạy unit + integration tests (Vitest) |
| `npm run db:migrate` | Chạy migration                         |
| `npm run db:seed`    | Chạy seed                              |
| `npm run db:setup`   | Migration + seed                       |

## 7. Auth API (Phase 1)

Base path: `/api/v1/auth`

| Method | Endpoint           | Mô tả                                                     |
| ------ | ------------------ | --------------------------------------------------------- |
| `POST` | `/register`        | Đăng ký khách hàng, trả access token + set refresh cookie |
| `POST` | `/login`           | Đăng nhập bằng số điện thoại/mật khẩu                     |
| `POST` | `/refresh`         | Rotate refresh token từ HttpOnly cookie                   |
| `POST` | `/logout`          | Thu hồi refresh token hiện tại                            |
| `POST` | `/logout-all`      | Thu hồi toàn bộ session (cần access token)                |
| `GET`  | `/me`              | Thông tin người dùng hiện tại                             |
| `POST` | `/change-password` | Đổi mật khẩu, thu hồi mọi session                         |

Đặc điểm bảo mật:

- Access token JWT HS256, TTL 15 phút.
- Refresh token JWT 7 ngày, **chỉ** nằm trong cookie `HttpOnly`, không trả về JSON.
- Refresh token rotation lưu hash trong Redis; phát hiện reuse sẽ thu hồi toàn bộ session.
- Khóa đăng nhập tạm thời sau 5 lần sai trong 15 phút (cấu hình qua env).
- RBAC theo `ten_vai_tro`; branch scope cho các module sau.
- Rate limit cho toàn API và riêng auth.

### Ví dụ đăng ký

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"ho_va_ten\":\"Nguyễn Văn A\",\"so_dien_thoai\":\"0901234567\",\"email\":\"a@example.com\",\"mat_khau\":\"MatKhau@123\",\"xac_nhan_mat_khau\":\"MatKhau@123\"}"
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "token_type": "Bearer",
    "expires_in": 900,
    "nguoi_dung": {
      "ma_nguoi_dung": "1",
      "ho_va_ten": "Nguyễn Văn A",
      "so_dien_thoai": "0901234567",
      "email": "a@example.com",
      "ma_chi_nhanh": null,
      "ten_vai_tro": "KHACH_HANG",
      "trang_thai_tai_khoan": "HOAT_DONG",
      "thoi_gian_tao": "2026-10-21T04:00:00.000Z"
    }
  }
}
```

Cookie `futa_refresh_token` được set kèm response.

### Ví dụ gọi API cần đăng nhập

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Refresh

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/refresh \
  -b "futa_refresh_token=<refresh_token>"
```

Khi dùng trình duyệt, cookie được gửi tự động nếu `fetch` có `credentials: 'include'`.

## 8. Danh mục & chuyến xe (Phase 2)

### API công khai

| Method | Endpoint              | Mô tả                                                              |
| ------ | --------------------- | ------------------------------------------------------------------ |
| `GET`  | `/vehicle-types`      | Danh sách loại xe kèm sơ đồ ghế                                    |
| `GET`  | `/vehicle-types/:id`  | Chi tiết loại xe                                                   |
| `GET`  | `/routes`             | Danh sách tuyến đường kèm điểm dừng                                |
| `GET`  | `/routes/:id`         | Chi tiết tuyến đường                                               |
| `GET`  | `/trips`              | Tìm chuyến sắp chạy theo `tinh_di`, `tinh_den`, `ma_tuyen`, `ngay` |
| `GET`  | `/trips/:id`          | Chi tiết chuyến xe                                                 |
| `GET`  | `/trips/:id/seat-map` | Sơ đồ ghế và trạng thái `TRONG`, `DANG_GIU`, `DA_DAT`              |

- `GET /trips` mặc định tìm trong 30 ngày tới; `ngay=YYYY-MM-DD` được hiểu là ngày Việt Nam (+07:00).
- Chuyến đã hủy không xuất hiện trong API công khai.

### API quản trị

Các endpoint dưới đây cần `Authorization: Bearer <access_token>`.

| Method   | Endpoint                     | Vai trò                                           |
| -------- | ---------------------------- | ------------------------------------------------- |
| `GET`    | `/vehicles`, `/vehicles/:id` | `QUAN_TRI_VIEN`, `DIEU_HANH`, `QUAN_LY_CHI_NHANH` |
| `POST`   | `/vehicles`                  | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `PUT`    | `/vehicles/:id`              | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `DELETE` | `/vehicles/:id`              | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `POST`   | `/vehicle-types`             | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `PUT`    | `/vehicle-types/:id`         | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `DELETE` | `/vehicle-types/:id`         | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `POST`   | `/routes`                    | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `PUT`    | `/routes/:id`                | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `DELETE` | `/routes/:id`                | `QUAN_TRI_VIEN`, `DIEU_HANH`                      |
| `GET`    | `/admin/trips`               | Cả 3 vai trò quản lý                              |
| `GET`    | `/admin/trips/:id`           | Cả 3 vai trò quản lý                              |
| `POST`   | `/admin/trips`               | Cả 3 vai trò quản lý                              |
| `PUT`    | `/admin/trips/:id`           | Cả 3 vai trò quản lý                              |
| `PATCH`  | `/admin/trips/:id/status`    | Cả 3 vai trò quản lý                              |
| `DELETE` | `/admin/trips/:id`           | Cả 3 vai trò quản lý                              |

`GET /admin/trips` hỗ trợ `tinh_di`, `tinh_den`, `ma_tuyen`, `ma_xe`, `ma_tai_xe`, `trang_thai`, `tu_ngay`, `den_ngay`, `page`, `limit`.

### Ví dụ tạo chuyến

```bash
curl -X POST http://localhost:3000/api/v1/admin/trips \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"ma_tuyen\":1,\"ma_xe\":1,\"ma_tai_xe\":\"3\",\"thoi_gian_xuat_ben\":\"2026-10-22T08:00:00+07:00\",\"thoi_gian_den_du_kien\":\"2026-10-22T14:30:00+07:00\",\"gia_ve_co_ban\":320000}"
```

Quy tắc nghiệp vụ:

- Thời gian phải là ISO 8601 có múi giờ; lưu UTC trong MySQL, trả ISO UTC.
- Giá vé chuẩn hóa về `DECIMAL(12,2)` dạng string.
- Không cho trùng lịch xe hoặc tài xế trong cùng khoảng thời gian (`TRIP_VEHICLE_CONFLICT`, `TRIP_DRIVER_CONFLICT`).
- Không cho sửa lịch/phân công hoặc hủy/xóa chuyến đã phát sinh vé.
- Trạng thái chuyến: `SAP_CHAY` → `DANG_CHAY` → `HOAN_THANH`; `SAP_CHAY` → `HUY`.
- `QUAN_LY_CHI_NHANH` chỉ thấy và phân công tài xế thuộc chi nhánh của mình.

## 9. Chi nhánh, người dùng & giữ ghế (Phase 3)

### API chi nhánh

| Method   | Endpoint                     | Vai trò / Ghi chú                              |
| -------- | ---------------------------- | ---------------------------------------------- |
| `GET`    | `/branches`, `/branches/:id` | Công khai                                      |
| `POST`   | `/branches`                  | `QUAN_TRI_VIEN`                                |
| `PUT`    | `/branches/:id`              | `QUAN_TRI_VIEN`                                |
| `DELETE` | `/branches/:id`              | `QUAN_TRI_VIEN`, chặn nếu đang có người/đơn vé |

### API người dùng

| Method   | Endpoint                    | Vai trò                                           |
| -------- | --------------------------- | ------------------------------------------------- |
| `GET`    | `/users/roles`              | `QUAN_TRI_VIEN`, `DIEU_HANH`, `QUAN_LY_CHI_NHANH` |
| `GET`    | `/users`, `/users/:id`      | Cả 3 vai trò quản lý                              |
| `POST`   | `/users`                    | `QUAN_TRI_VIEN`, `QUAN_LY_CHI_NHANH`              |
| `PUT`    | `/users/:id`                | `QUAN_TRI_VIEN`, `QUAN_LY_CHI_NHANH`              |
| `PATCH`  | `/users/:id/status`         | `QUAN_TRI_VIEN`, `QUAN_LY_CHI_NHANH`              |
| `POST`   | `/users/:id/reset-password` | `QUAN_TRI_VIEN`, `QUAN_LY_CHI_NHANH`              |
| `DELETE` | `/users/:id`                | `QUAN_TRI_VIEN`                                   |

`QUAN_LY_CHI_NHANH` chỉ quản lý người dùng thuộc chi nhánh của mình; không thể tự khóa/xóa chính mình.

### Đặt vé

| Method | Endpoint                     | Mô tả                                            |
| ------ | ---------------------------- | ------------------------------------------------ |
| `POST` | `/bookings/quote`            | Báo giá và trạng thái ghế, không cần đăng nhập   |
| `POST` | `/bookings`                  | Tạo đơn; cần `owner_ref` đang giữ ghế            |
| `GET`  | `/bookings/:id`              | Khách xem đơn của mình; nhân viên xem theo quyền |
| `POST` | `/bookings/:id/cancel`       | Hủy đơn `CHO_THANH_TOAN`                         |
| `POST` | `/bookings/:id/confirm-cash` | Nhân viên xác nhận đã thu tiền mặt               |

- `POST /bookings` hỗ trợ header `Idempotency-Key` (hoặc `idempotency_key` trong body), lưu mapping trong Redis.
- Khách hàng đặt trước: đơn `CHO_THANH_TOAN`, thanh toán `TIEN_MAT` + `CHO_XU_LY`, hết hạn sau `PAYMENT_TIMEOUT_MINUTES`.
- Nhân viên bán tại quầy: đơn `DA_THANH_TOAN`, thanh toán `TIEN_MAT` + `THANH_CONG` ngay.
- Giá vé tính server-side bằng `decimal.js`; tổng tiền trả dạng string.
- Mã đơn dạng `FUTA + YYMMDD + sequence` lấy từ Redis; `ma_qr_kiem_tra` ký HMAC-SHA256.
- Job nền tự hủy đơn quá hạn, job dọn `giu_cho_tam_thoi` chạy định kỳ.
- Redis không khả dụng: giữ ghế/đặt vé trả `503` (`SEAT_LOCK_UNAVAILABLE`), xem sơ đồ ghế vẫn hoạt động.

### Socket.IO

Kết nối tới `SOCKET_PATH` (mặc định `/socket.io`). Có thể gửi access token qua `auth.token` hoặc header `Authorization: Bearer`; khách vãng lai vẫn xem/giữ ghế được.

| Hướng | Event           | Payload                                                 |
| ----- | --------------- | ------------------------------------------------------- |
| C→S   | `trip:join`     | `{ma_chuyen}` — ack trả `so_do_ghe`                     |
| C→S   | `trip:leave`    | `{ma_chuyen}`                                           |
| C→S   | `seat:hold`     | `{ma_chuyen, danh_sach_ghe, owner_ref}`                 |
| C→S   | `seat:extend`   | `{ma_chuyen, owner_ref}`                                |
| C→S   | `seat:release`  | `{ma_chuyen, danh_sach_ghe?, owner_ref}`                |
| S→C   | `seat:held`     | `{ma_chuyen, danh_sach_ghe, expires_at, ttl_seconds}`   |
| S→C   | `seat:released` | `{ma_chuyen, danh_sach_ghe, reason}`                    |
| S→C   | `seat:booked`   | `{ma_chuyen, danh_sach_ghe, ma_don_ve, trang_thai_don}` |

Mọi sự kiện C→S nhận ack `{success:true,data}` hoặc `{success:false,code,message,details?}`. Redis adapter được bật khi Redis sẵn sàng; `owner_ref` không broadcast cho client khác.

## 10. Thanh toán VNPAY, soát vé & thống kê (Phase 4)

### Thanh toán VNPAY Sandbox

| Method | Endpoint                     | Vai trò / Ghi chú                                             |
| ------ | ---------------------------- | ------------------------------------------------------------- |
| `POST` | `/bookings`                  | Thêm `phuong_thuc_thanh_toan: "VNPAY"`, trả kèm `payment_url` |
| `POST` | `/payments/vnpay/create-url` | Đã đăng nhập, body `{ma_don_ve}`                              |
| `GET`  | `/payments/vnpay/return`     | Công khai, VNPAY redirect về trình duyệt                      |
| `GET`  | `/payments/vnpay/ipn`        | Công khai, VNPAY gọi server-to-server                         |

- Đơn VNPAY luôn bắt đầu ở `CHO_THANH_TOAN`, thanh toán `VNPAY` + `CHO_XU_LY`, kể cả khi nhân viên tạo.
- URL thanh toán dùng `vnp_TxnRef = ma_dinh_danh_don`, số tiền nhân 100, thời gian theo GMT+7, hết hạn sau `VNP_PAYMENT_EXPIRE_MINUTES`.
- Cả return và IPN đều xác minh HMAC-SHA256 bằng `VNP_HASH_SECRET` và đối chiếu `vnp_Amount` với `tong_tien` trong DB.
- IPN luôn trả HTTP `200` theo đặc tả VNPAY: `00` thành công, `01` không thấy đơn, `02` đã xác nhận, `04` sai số tiền, `97` sai chữ ký, `99` lỗi hệ thống.
- Xử lý trong transaction kèm khóa đơn; gọi lại nhiều lần không nhân đôi thanh toán/không phát lại `seat:booked`.
- Đơn đã hủy không bị mở lại khi VNPAY báo thanh toán muộn.

### Vé & soát vé QR

| Method | Endpoint                            | Vai trò                                                            |
| ------ | ----------------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/tickets/my`                       | Khách hàng, lọc `trang_thai_soat_ve`, `trang_thai_don`, phân trang |
| `GET`  | `/tickets/:id`                      | Chủ vé hoặc vai trò quản lý                                        |
| `GET`  | `/tickets/:id/qr`                   | Chủ vé; `?format=png` trả ảnh PNG                                  |
| `POST` | `/tickets/check-in`                 | `TAI_XE`, body `{ma_qr}`                                           |
| `GET`  | `/tickets/trips/:tripId/passengers` | `TAI_XE`, `QUAN_LY_CHI_NHANH`, `DIEU_HANH`, `QUAN_TRI_VIEN`        |

- QR ký HMAC-SHA256 bằng `QR_SECRET`; check-in xác minh chữ ký, đúng chuyến, đúng tài xế được phân công, đơn đã thanh toán, vé còn hiệu lực.
- Quét lại vé đã lên xe trả `already_checked_in: true` (idempotent), không ghi đè tài xế/thời gian.
- Chỉ cho check-in trong khoảng `QR_CHECKIN_OPEN_HOURS_BEFORE` giờ trước và `QR_CHECKIN_CLOSE_HOURS_AFTER` giờ sau giờ xuất bến.
- Danh sách hành khách trả kèm `tong_so_hanh_khach`, `da_len_xe`, `chua_len_xe`.

### Thống kê doanh thu

| Method | Endpoint                        | Ghi chú                                                      |
| ------ | ------------------------------- | ------------------------------------------------------------ |
| `GET`  | `/statistics/revenue`           | `tu_ngay`, `den_ngay`, `group_by=day\|month`, `ma_chi_nhanh` |
| `GET`  | `/statistics/revenue/by-route`  | Nhóm theo tuyến                                              |
| `GET`  | `/statistics/revenue/by-branch` | Nhóm theo chi nhánh bán                                      |

- Mặc định 30 ngày gần nhất theo múi giờ Việt Nam; ngày tính từ `00:00` đến `24:00` GMT+7.
- Doanh thu = tổng tiền đơn `DA_THANH_TOAN` + vé `HIEU_LUC`; trả chuỗi decimal để tránh sai số.
- `QUAN_LY_CHI_NHANH` và `NHAN_VIEN_PHONG_VE` chỉ xem chi nhánh của mình; truyền `ma_chi_nhanh` khác trả `403`.

## 11. Quy ước response & lỗi

Thành công:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi:

```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Số điện thoại hoặc mật khẩu không đúng",
  "trace_id": "..."
}
```

- Lỗi validation trả `422` kèm `details: [{ field, message }]`.
- Mọi response có header `X-Request-Id`; `trace_id` dùng để đối chiếu log.
- Request/response dùng tiếng Việt `snake_case`.

## 12. Cấu trúc thư mục

```text
backend/
├── database/
│   ├── migrations/       # SQL migration
│   ├── seeds/            # Dữ liệu nền
│   └── schema.sql        # Schema gốc tham khảo
├── src/
│   ├── common/           # Constants, errors, response envelope
│   ├── config/           # env, MySQL, Redis, logger
│   ├── db/               # Migration/seed runner, transaction helper
│   ├── middlewares/      # Auth, RBAC, validation, rate limit, errors
│   ├── modules/
│   │   ├── auth/         # Auth domain
│   │   ├── branches/     # Chi nhánh
│   │   ├── users/        # Quản lý người dùng & vai trò
│   │   ├── vehicle-types/# Loại xe & sơ đồ ghế
│   │   ├── vehicles/     # Danh mục xe
│   │   ├── routes/       # Tuyến đường & điểm dừng
│   │   ├── trips/        # Chuyến xe, tìm chuyến, sơ đồ ghế
│   │   ├── seat-locks/   # Lua lock, mirror giu_cho_tam_thoi
│   │   ├── bookings/     # Đơn vé, chi tiết vé, thanh toán
│   │   ├── payments/     # VNPAY: tạo URL, return, IPN idempotent
│   │   ├── tickets/      # Vé của tôi, QR, check-in, danh sách hành khách
│   │   └── statistics/   # Doanh thu theo thời gian/tuyến/chi nhánh
│   ├── realtime/         # Socket.IO, Redis adapter, event bus
│   ├── jobs/             # Hủy đơn hết hạn, dọn mirror
│   ├── routes/           # API + health routes
│   ├── utils/            # Phone, password, time, token hash, QR, VNPAY, order code
│   ├── app.ts            # Express app factory
│   ├── container.ts      # Composition root
│   └── server.ts         # Entry point + graceful shutdown
└── tests/
    ├── unit/
    ├── integration/
    └── helpers/          # In-memory fakes cho auth
```

## 13. Kiểm thử

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Unit test dùng in-memory fake, không cần MySQL/Redis:

- Auth, trip, branch, user service.
- Seat lock: all-or-nothing, ghế đã bán, verify owner, ghép Redis + mirror.
- Booking: tiền mặt tại quầy, VNPAY chờ thanh toán, idempotency, hủy đơn, hết hạn, báo giá.
- VNPAY: ký/verify URL, chống sửa số tiền, IPN lặp idempotent, đơn hủy không mở lại, mapping `RspCode`.
- Vé: quyền xem vé, QR DataURL/PNG, check-in đúng chuyến/tài xế, quét lặp, sai chữ ký, ngoài giờ, danh sách hành khách.
- Thống kê: khoảng ngày mặc định GMT+7, nhóm ngày/tháng, giới hạn chi nhánh, validate tham số.
- Socket.IO: join room, ack snapshot, broadcast `seat:held` không lộ `owner_ref`, validation qua ack.
- Race condition: hai đơn đồng thời cùng ghế chỉ một đơn thành công (`ER_DUP_ENTRY` → `BOOKING_SEAT_CONFLICT`).

Các test cần hạ tầng thật (Redis Lua atomic, MySQL transaction) nên chạy thêm trong CI có service containers.

## 14. Phase tiếp theo

- Hoàn vé/hủy vé đã thanh toán kèm chính sách hoàn tiền.
- Xuất báo cáo Excel/PDF và dashboard realtime.
- Tích hợp cổng thanh toán khác (MoMo, ZaloPay) sau VNPAY.
