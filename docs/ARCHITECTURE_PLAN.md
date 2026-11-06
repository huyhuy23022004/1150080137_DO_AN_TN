# FUTA Bus System — Backend Architecture & Implementation Plan

> Tài liệu đối chiếu xuyên suốt đồ án. Mọi thay đổi kiến trúc phải được cập nhật tại đây trước khi triển khai.
>
> - Nguồn CSDL: `backend/database/schema.sql` (MySQL 8.0, 13 bảng, tên bảng/cột tiếng Việt không dấu).
> - Tech stack: TypeScript, Node.js 20+ LTS, Express, mysql2/promise, Redis/ioredis, Socket.IO, JWT, bcrypt, express-validator, VNPAY Sandbox, qrcode.
> - Kiến trúc: Controller – Service – Repository.

---

## 0. Quyết định kiến trúc đã chốt

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Truy cập DB | `mysql2/promise` + SQL thuần, TypeScript strict, không ORM |
| 2 | Migration bổ sung | Cho phép `database/002_optional_constraints.sql`, gồm cột `trang_thai_ve` để hủy vé không hard-delete |
| 3 | Thời điểm tạo vé | Tạo `don_dat_ve` + `chi_tiet_ve` **trước** khi gọi VNPAY |
| 4 | Quy ước API | `snake_case` tiếng Việt không dấu xuyên suốt request/response |
| 5 | Giá ghế VIP | MVP dùng chung `gia_ve_co_ban` cho mọi ghế |
| 6 | Redis down | Fail-closed (503) cho giữ ghế/đặt vé; không fallback DB-only |
| 7 | Định danh giữ ghế | `owner_ref` do server/client phiên giữ, không dùng `socket.id` |

Nguyên tắc rút ra:

1. **Redis là advisory lock, DB là authoritative.** `UNIQUE(ma_chuyen, ma_ghe)` trên `chi_tiet_ve` là trọng tài cuối.
2. **Controller mỏng – Service chứa nghiệp vụ và biên transaction – Repository chỉ SQL.**
3. **Mọi callback bên ngoài (VNPAY IPN) phải verify chữ ký, verify số tiền và idempotent.**
4. **Không tin client** về giá, tổng tiền, trạng thái ghế hay vai trò.
5. **Tiền và BIGINT truyền dạng string** trong JSON để tránh mất chính xác.
6. **Thời gian lưu UTC** trong DB; hiển thị và VNPAY format theo `Asia/Ho_Chi_Minh`.

---

## 1. Đánh giá schema hiện tại

### 1.1. Điểm mạnh

| Thành phần | Ý nghĩa |
|---|---|
| `chi_tiet_ve UNIQUE(ma_chuyen, ma_ghe)` | Chốt chặn chống bán trùng ghế ở tầng DB |
| `giu_cho_tam_thoi` PK `(ma_chuyen, ky_hieu_ghe)` + index hết hạn | Bảng mirror/dự phòng Redis, phục vụ hydrate và dọn rác |
| `so_do_ghe UNIQUE(ma_loai_xe, ky_hieu_ghe)` | Layout ghế bất biến theo loại xe |
| `DECIMAL(12,2)` | Tiền tệ chính xác, không dùng float |
| `vai_tro` seed 6 role | RBAC map trực tiếp `ten_vai_tro` |
| `don_dat_ve.ma_chi_nhanh_ban`, `ma_nhan_vien_ban` | Phân quyền chi nhánh và doanh thu quầy |

### 1.2. Khoảng trống và cách xử lý

| Vấn đề | Ảnh hưởng | Giải pháp |
|---|---|---|
| `don_dat_ve` không có `ma_chuyen` | Đơn có thể chứa vé nhiều chuyến | Bắt buộc 1 đơn = 1 chuyến ở Service |
| `chi_tiet_ve` không có trạng thái hủy | Không giải phóng được unique seat | Bổ sung `trang_thai_ve` + generated column `ma_ghe_hieu_luc` (migration 002) |
| `thanh_toan.ma_giao_dich_vnpay` không UNIQUE | IPN trùng có thể ghi log trùng | Idempotency service + UNIQUE index (002) |
| Lock dùng `ky_hieu_ghe`, vé dùng `ma_ghe` | Lệch khóa | Resolve qua `so_do_ghe` theo `loai_xe` của chuyến |
| Không có giá ghế VIP | `loai_cho` chưa dùng vào giá | MVP dùng `gia_ve_co_ban`; mở rộng sau |
| Không có hạn thanh toán | Đơn treo vô hạn | Job dùng `thoi_gian_tao + PAYMENT_TIMEOUT_MINUTES` |
| `chuyen_xe.ma_tai_xe NOT NULL` | Tạo chuyến bắt buộc có tài xế | Validate role `TAI_XE` |
| `TIMESTAMP` theo timezone session | Lệch giờ với VNPAY | Session MySQL UTC, app lưu UTC, format VNPAY GMT+7 |
| BIGINT / DECIMAL | Mất chính xác nếu dùng Number | `bigNumberStrings`, `decimalNumbers:false`, `dateStrings:true` |

### 1.3. Migration 002

- Thêm `chi_tiet_ve.trang_thai_ve` (`HIEU_LUC`, `DA_HUY`).
- Thêm generated column `ma_ghe_hieu_luc`:
  - `ma_ghe` nếu vé còn hiệu lực.
  - `NULL` nếu vé đã hủy.
- Unique mới `(ma_chuyen, ma_ghe_hieu_luc)` thay cho `(ma_chuyen, ma_ghe)`.
  - MySQL cho phép nhiều `NULL` trong unique index, nên vé hủy không chặn ghế.
- Unique `thanh_toan.ma_giao_dich_vnpay`.
- Index phục vụ job/IPN: `thanh_toan(ma_don_ve, trang_thai)`, `don_dat_ve(trang_thai_don, thoi_gian_tao)`, `chuyen_xe(ma_tuyen, thoi_gian_xuat_ben)`, `chi_tiet_ve(ma_ghe)`.

---

## 2. Cấu trúc thư mục Backend

```text
backend/
├─ src/
│  ├─ server.ts
│  ├─ app.ts
│  ├─ container.ts
│  ├─ routes/
│  │  ├─ index.ts
│  │  └─ health.routes.ts
│  ├─ config/
│  │  ├─ env.ts
│  │  ├─ database.ts
│  │  ├─ redis.ts
│  │  └─ logger.ts
│  ├─ common/
│  │  ├─ errors/AppError.ts
│  │  ├─ errors/error-codes.ts
│  │  ├─ errors/db-errors.ts
│  │  ├─ http-status.ts
│  │  ├─ response.ts
│  │  ├─ async-handler.ts
│  │  └─ constants.ts
│  ├─ middlewares/
│  │  ├─ request-id.middleware.ts
│  │  ├─ auth.middleware.ts
│  │  ├─ rbac.middleware.ts
│  │  ├─ branch-scope.middleware.ts
│  │  ├─ validate.middleware.ts
│  │  ├─ rate-limit.middleware.ts
│  │  ├─ not-found.middleware.ts
│  │  └─ error.middleware.ts
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ auth.repository.ts
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ auth.validator.ts
│  │  │  ├─ auth.types.ts
│  │  │  ├─ token.service.ts
│  │  │  ├─ refresh-token.store.ts
│  │  │  └─ login-attempt.tracker.ts
│  │  ├─ users/
│  │  ├─ branches/
│  │  ├─ roles/
│  │  ├─ vehicle-types/
│  │  ├─ vehicles/
│  │  ├─ routes/
│  │  ├─ trips/
│  │  ├─ seat-locks/
│  │  ├─ bookings/
│  │  ├─ payments/
│  │  └─ tickets/
│  ├─ realtime/
│  │  ├─ io.ts
│  │  ├─ socket-auth.ts
│  │  ├─ redis-adapter.ts
│  │  ├─ rooms.ts
│  │  ├─ events.ts
│  │  ├─ validators.ts
│  │  └─ handlers/seat.handler.ts
│  ├─ jobs/
│  │  ├─ scheduler.ts
│  │  ├─ seat-lock-sweeper.job.ts
│  │  ├─ order-expiry.job.ts
│  │  └─ payment-reconcile.job.ts
│  ├─ db/
│  │  ├─ types.ts
│  │  ├─ transaction.ts
│  │  ├─ migrator.ts
│  │  ├─ migrate.ts
│  │  └─ seed.ts
│  ├─ utils/
│  │  ├─ time.ts
│  │  ├─ money.ts
│  │  ├─ code-generator.ts
│  │  ├─ crypto.ts
│  │  ├─ phone.ts
│  │  └─ redis-keys.ts
│  └─ types/
│     ├─ express.d.ts
│     └─ domain.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ helpers/
├─ database/
│  ├─ schema.sql
│  ├─ migrations/
│  │  ├─ 001_init.sql
│  │  └─ 002_optional_constraints.sql
│  └─ seeds/
│     └─ 001_base_data.sql
├─ .env.example
├─ docker-compose.yml
├─ Dockerfile
└─ README.md
```

Quy tắc phụ thuộc: `routes → controller → service → repository`. Không import ngược. Service không dùng `Request/Response`. Socket handler và cron job gọi Service.

---

## 3. Biến môi trường

Toàn bộ biến nằm trong `backend/.env.example`. Các nhóm chính:

- Runtime: `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_TIMEZONE`, `TRUST_PROXY`, `CORS_ORIGINS`, `BODY_LIMIT`, `LOG_LEVEL`.
- MySQL: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, `DB_QUEUE_LIMIT`, `DB_TIMEZONE`, `DB_SSL`.
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX`, `REDIS_TLS`.
- JWT/Auth: `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `REFRESH_COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`, `BCRYPT_SALT_ROUNDS`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`.
- Seat lock/booking: `SEAT_LOCK_TTL_SECONDS`, `SEAT_LOCK_MAX_EXTEND_SECONDS`, `SEAT_LOCK_MIRROR_ENABLED`, `SEAT_LOCK_SWEEP_INTERVAL_SECONDS`, `PAYMENT_TIMEOUT_MINUTES`, `BOOKING_IDEMPOTENCY_TTL_SECONDS`, `MAX_SEATS_PER_ORDER`, `TRIP_BOOKING_CLOSE_MINUTES`.
- Socket.IO: `SOCKET_PATH`, `SOCKET_CORS_ORIGINS`, `SOCKET_PING_INTERVAL_MS`, `SOCKET_PING_TIMEOUT_MS`.
- VNPAY Sandbox: `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_API_URL`, `VNP_RETURN_URL`, `VNP_IPN_URL`, `VNP_VERSION`, `VNP_COMMAND`, `VNP_CURR_CODE`, `VNP_LOCALE`, `VNP_ORDER_TYPE`, `VNP_PAYMENT_EXPIRE_MINUTES`, `PAYMENT_RESULT_REDIRECT_URL`, `MOBILE_DEEPLINK_SCHEME`.
- QR: `QR_SECRET`, `QR_ISSUER`, `QR_CHECKIN_OPEN_HOURS_BEFORE`, `QR_CHECKIN_CLOSE_HOURS_AFTER`.
- Rate limit: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `HOLD_RATE_LIMIT_MAX`, `IPN_RATE_LIMIT_MAX`.
- Bootstrap: `ADMIN_PHONE`, `ADMIN_PASSWORD`, `SEED_DEMO_DATA`.

---

## 4. Luồng giữ ghế tạm thời (Seat Locking)

### 4.1. Máy trạng thái ghế

```text
AVAILABLE --hold--> HELD (Redis TTL 8m) --tạo đơn--> PENDING_PAYMENT
   ^                    |                                    |
   |             hết hạn / release                     IPN thành công
   |                    |                                    v
   +--------------------+---------------------------------- SOLD
   |                                                         |
   +------------------ hủy đơn / hết hạn thanh toán --------+
```

- `HELD`: chỉ tồn tại trong Redis + mirror `giu_cho_tam_thoi`.
- `PENDING_PAYMENT`: vé đã có trong `chi_tiet_ve`, đơn `CHO_THANH_TOAN`.
- `SOLD`: đơn `DA_THANH_TOAN`.
- Availability = layout ghế của `loai_xe` trừ vé còn hiệu lực của đơn `CHO_THANH_TOAN/DA_THANH_TOAN` trừ lock Redis còn sống.

### 4.2. Redis keys

| Key | Value | TTL | Mục đích |
|---|---|---|---|
| `futa:seatlock:{ma_chuyen}:{ky_hieu_ghe}` | `owner_ref` | 480s | Khóa từng ghế |
| `futa:hold:session:{owner_ref}` | Set `ma_chuyen:ky_hieu_ghe` | 900s | Release toàn bộ khi client rời |
| `futa:hold:meta:{owner_ref}` | JSON owner/socket | 900s | Audit/ownership |
| `futa:order:seq:{YYMMDD}` | số tăng dần | 2 ngày | Sinh `ma_dinh_danh_don` |
| `futa:idem:booking:{owner_ref}:{key}` | `ma_don_ve` | 24h | Chống double-tap tạo đơn |
| `futa:vnp:txnref:{txnRef}` | JSON | 24h | IPN tra cứu nhanh |
| `futa:rt:{ma_nguoi_dung}:{jti}` | hash refresh token | 7 ngày | Refresh token rotation |
| `futa:job:lock:{job}` | instance id | 55s | Chống cron chạy trùng |
| `futa:cache:seatlayout:{ma_loai_xe}` | JSON layout | 1h | Cache sơ đồ ghế |

`owner_ref` là token ngẫu nhiên ≤ 50 ký tự, lưu client-side để reconnect vẫn giữ quyền.

### 4.3. Lua acquire all-or-nothing

```lua
-- KEYS: seatlock keys; ARGV[1]=owner_ref; ARGV[2]=ttl_ms
local n = #KEYS
for i = 1, n do
  local owner = redis.call('GET', KEYS[i])
  if owner and owner ~= ARGV[1] then return {0, i} end
end
for i = 1, n do
  redis.call('SET', KEYS[i], ARGV[1], 'PX', ARGV[2])
end
return {1, 0}
```

Cùng một `owner_ref` giữ lại ghế đã giữ là idempotent (refresh TTL), owner khác vẫn bị chặn. Release chỉ xóa nếu đúng owner. Verify + PEXPIRE ngắn trước khi tạo đơn để lock không hết hạn giữa transaction.

### 4.4. Luồng

1. Client join room `trip:{ma_chuyen}`, nhận snapshot.
2. Client gửi `seat:hold`.
3. Server validate chuyến/ghế/số lượng/rate limit.
4. Lua acquire toàn bộ. Fail → ack lỗi kèm danh sách ghế xung đột, không broadcast.
5. Thành công → mirror DB, ghi session, broadcast `seat:held`, ack `expires_at`.
6. `seat:extend`, `seat:release`; hết TTL → keyspace notification hoặc job đối soát.
7. Tạo đơn thành công → xóa lock, broadcast `seat:booked` (`PENDING_PAYMENT`).

### 4.5. Socket events

| Hướng | Event | Payload |
|---|---|---|
| C→S | `trip:join` | `{ma_chuyen}` — ack `{so_do_ghe}` |
| C→S | `trip:leave` | `{ma_chuyen}` |
| C→S | `seat:hold` | `{ma_chuyen, danh_sach_ghe, owner_ref}` |
| C→S | `seat:extend` | `{ma_chuyen, owner_ref}` |
| C→S | `seat:release` | `{ma_chuyen, danh_sach_ghe?, owner_ref}` |
| S→C | `seat:held` | `{ma_chuyen, danh_sach_ghe, expires_at, ttl_seconds}` |
| S→C | `seat:released` | `{ma_chuyen, danh_sach_ghe, reason}` |
| S→C | `seat:booked` | `{ma_chuyen, danh_sach_ghe, ma_don_ve, trang_thai_don}` |

Mọi sự kiện C→S nhận ack `{success:true,data}` hoặc `{success:false,code,message,details?}`. Snapshot trả qua ack của `trip:join` thay vì event riêng. Server là nguồn broadcast duy nhất; `owner_ref` không broadcast cho client khác. Dùng `@socket.io/redis-adapter` khi scale nhiều instance; nếu Redis không sẵn sàng server vẫn chạy single-instance.

### 4.6. Vai trò `giu_cho_tam_thoi`

- Không phải nguồn sự thật; Redis quyết định.
- Hydrate mirror còn hạn vào Redis khi Redis miss/restart.
- Job dọn mirror hết hạn mỗi 30s.
- Redis down → 503 cho hold/booking; xem sơ đồ ghế vẫn đọc DB được.

### 4.7. Race conditions

| Tình huống | Cơ chế chặn |
|---|---|
| 2 người giữ cùng ghế | Lua atomic |
| Giữ nhiều ghế, 1 ghế bận | All-or-nothing |
| Lock hết hạn khi tạo đơn | Verify + PEXPIRE + DB UNIQUE |
| 2 request tạo đơn cùng ghế | `ER_DUP_ENTRY` → rollback 409 |
| Client mất kết nối | Giữ đến TTL, reconnect bằng `owner_ref` |
| Redis restart | Hydrate mirror; DB vẫn chặn bán trùng |
| IPN sau khi hủy | Log `paid_after_cancel`, hoàn tiền thủ công |

---

## 5. Luồng đặt vé, VNPAY và QR

### 5.1. Tạo đơn (REST)

`POST /api/v1/bookings`

1. Validate chuyến, ghế, điểm đón/trả; tính tiền server-side bằng `decimal.js`.
2. Lua verify + PEXPIRE lock của `owner_ref`.
3. Transaction:
   - `SELECT chuyen_xe ... FOR UPDATE` (đọc giá/trạng thái ổn định).
   - Insert `don_dat_ve` (`CHO_THANH_TOAN`, `FUTA + YYMMDD + sequence`).
   - Insert `chi_tiet_ve` cho từng ghế, sinh `ma_qr_kiem_tra`, `trang_thai_ve='HIEU_LUC'`.
   - Insert `thanh_toan` (`VNPAY` + `CHO_XU_LY` hoặc `TIEN_MAT` + `THANH_CONG`).
   - Commit.
4. Sau commit: xóa lock Redis, ghi mapping TxnRef, broadcast `seat:booked`.
5. Trả `ma_don_ve`, `tong_tien`, `expires_at`, `payment_url` nếu VNPAY.

`ER_DUP_ENTRY` → rollback 409. Deadlock → retry có giới hạn. Không gọi VNPAY trong transaction.

Idempotency: header `Idempotency-Key` + Redis + `ma_dinh_danh_don UNIQUE`.

### 5.2. VNPAY

- URL sandbox: `VNP_URL`, params `vnp_Version`, `vnp_Command=pay`, `vnp_TmnCode`, `vnp_Amount = tong_tien * 100`, `vnp_CurrCode=VND`, `vnp_TxnRef = {ma_dinh_danh_don}-{attempt}`, `vnp_OrderInfo` không dấu, `vnp_ReturnUrl`, `vnp_IpAddr`, `vnp_CreateDate` GMT+7, `vnp_ExpireDate`.
- Ký HMAC-SHA512 trên chuỗi key sorted + `encodeURIComponent`, dùng `timingSafeEqual` khi verify.
- `vnp_ReturnUrl` chỉ hiển thị, không xác nhận thanh toán.

### 5.3. IPN

`GET /api/v1/payments/vnpay/ipn` luôn trả JSON HTTP 200:

1. Verify chữ ký → sai `RspCode 97`.
2. Resolve đơn từ TxnRef → không thấy `01`.
3. So số tiền → lệch `04`.
4. Transaction `SELECT don ... FOR UPDATE`:
   - Đã `DA_THANH_TOAN` → `02`.
   - Đã `DA_HUY` → log `paid_after_cancel`, `00`.
   - Success → cập nhật `thanh_toan THANH_CONG`, `ma_giao_dich_vnpay`, đơn `DA_THANH_TOAN`.
   - Fail → `thanh_toan THAT_BAI`, giữ đơn cho thử lại.
5. Broadcast `seat:booked (SOLD)`.

Idempotency nhờ row lock + trạng thái + unique index VNPAY.

### 5.4. Hủy đơn và hết hạn

- Job quét đơn `CHO_THANH_TOAN` quá `PAYMENT_TIMEOUT_MINUTES`.
- Transaction + `FOR UPDATE`; nếu vẫn treo:
  - `UPDATE chi_tiet_ve SET trang_thai_ve='DA_HUY'` (không hard-delete).
  - `UPDATE don_dat_ve SET trang_thai_don='DA_HUY'`.
  - Broadcast `seat:released`.
- `VNP_PAYMENT_EXPIRE_MINUTES < PAYMENT_TIMEOUT_MINUTES` + grace để giảm race.
- IPN đến sau hủy: không mở lại ghế, ghi log hoàn tiền.

### 5.5. QR soát vé

- Token: `FUTA1.<base64url(payload)>.<base64url(HMAC_SHA256(QR_SECRET, payloadB64))>`.
- Payload chứa `ma_chuyen`, `ky_hieu_ghe`, nonce; không chứa PII.
- Lưu token vào `chi_tiet_ve.ma_qr_kiem_tra` (UNIQUE); sinh ảnh QR on-demand bằng `qrcode`.
- `POST /api/v1/tickets/check-in`:
  - Verify HMAC constant-time.
  - `SELECT ... FOR UPDATE`; kiểm tra đơn `DA_THANH_TOAN`, đúng chuyến/tài xế/thời gian.
  - Nếu đã `DA_LEN_XE` → trả 200 + `already_checked_in:true`.
  - Cập nhật `DA_LEN_XE`, `thoi_gian_soat_ve`, `tai_xe_soat_ve`.

---

## 6. Lộ trình Phase

### Phase 1 — Base Setup & Auth

- Tooling TypeScript strict, ESLint/Prettier, Vitest, Docker Compose MySQL + Redis.
- Env validation, pool MySQL, Redis, logger, error envelope, health checks.
- Migration runner, `001_init.sql`, `002_optional_constraints.sql`, seed base data + admin.
- Auth: register, login, refresh rotation HttpOnly cookie, logout, logout-all, me, change password.
- RBAC, branch scope, rate limit, request-id, security middleware.
- Test unit + integration auth.

**DoD:** migrate/seed sạch; login/refresh/logout/change-password hoạt động; role chặn đúng; lint/typecheck/test pass.

### Phase 2 — Danh mục Xe / Tuyến / Chuyến

- CRUD chi nhánh, người dùng, loại xe + sơ đồ ghế, xe, tuyến + điểm dừng, chuyến.
- Validate layout, trùng lịch xe/tài xế, trạng thái chuyến.
- Public search chuyến, chi tiết, sơ đồ ghế (DB).
- Seed tài xế/nhân viên/chuyến demo.

**DoD:** quản trị đủ dữ liệu; tìm chuyến đúng; phân quyền chi nhánh đúng.

### Phase 3 — Real-time Seat Locking & Đặt vé

- Lua lock, mirror DB, hydrate, sweeper.
- Socket.IO auth/rooms/events + Redis adapter.
- Availability service (DB + Redis).
- Quote, create booking, idempotency, cancel; TIEN_MAT tại quầy.
- Job hết hạn đơn; test concurrency.

**DoD:** đồng bộ ghế tức thời; không bán trùng trong mọi test; đơn treo tự hủy.

**Đã triển khai:**

- `branches`, `users` (RBAC + branch scope, chặn tự khóa/xóa).
- Seat lock service + Redis Lua all-or-nothing, same-owner idempotent; mirror `giu_cho_tam_thoi`; hydrate khi Redis miss; sweeper job.
- Socket.IO path `/socket.io`, room `trip:{ma_chuyen}`, ack chuẩn, Redis adapter tùy chọn; snapshot qua ack `trip:join`.
- `POST /bookings/quote`, `POST /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel`, `POST /bookings/:id/confirm-cash`.
- `TIEN_MAT`: khách tạo đơn `CHO_THANH_TOAN` chờ nhân viên thu tiền; nhân viên bán quầy ghi nhận `DA_THANH_TOAN` ngay.
- Idempotency Redis + `Idempotency-Key`; mã đơn Redis sequence; QR HMAC-SHA256; job hủy đơn quá hạn.
- Unit test branch/user/seat-lock/booking, gồm race hai đơn cùng ghế.

### Phase 4 — VNPAY & Soát vé QR

- Build URL, return, IPN, querydr.
- QR token/image, check-in, danh sách hành khách.
- Hardening, Dockerfile, README, Postman.
- Test sandbox: success/fail/cancel/IPN lặp/sai chữ ký/quét 2 lần.

**DoD:** thanh toán sandbox → vé QR; IPN idempotent; soát vé đúng chuyến/tài xế.

---

## 7. Quy ước xuyên suốt

**Response**

```json
{ "success": true, "data": {}, "meta": {} }
{ "success": false, "code": "BOOKING_SEAT_CONFLICT", "message": "...", "details": [], "trace_id": "..." }
```

**Mã lỗi:** `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `FORBIDDEN`, `VALIDATION_ERROR`, `TRIP_NOT_BOOKABLE`, `SEAT_CONFLICT`, `BOOKING_EXPIRED`, `PAYMENT_INVALID_SIGNATURE`, `PAYMENT_AMOUNT_MISMATCH`, `TICKET_ALREADY_CHECKED_IN`, `TICKET_WRONG_TRIP`, `SERVICE_UNAVAILABLE`.

**Bảo mật:** bcrypt 10–12; mật khẩu ≤ 72 byte; refresh cookie HttpOnly + SameSite + Secure(prod); access token ngắn hạn; ownership check chống IDOR; SQL parameterized; whitelist ORDER BY; không log secret.

**DB:** transaction helper rollback chuẩn, retry deadlock; repository nhận `PoolConnection` để dùng chung transaction; BIGINT/DECIMAL trả string.

**Testing:** Vitest + Supertest; fake repository/store cho auth; integration DB/Redis khi có môi trường; test race, IPN idempotency, QR double-scan.
