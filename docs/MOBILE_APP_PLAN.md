# FUTA Bus Mobile App — Architecture & Implementation Plan

> Tài liệu đối chiếu cho ứng dụng di động `mobile-app/`. Mọi thay đổi kiến trúc, contract hoặc luồng nghiệp vụ phải được cập nhật tại đây trước khi triển khai.
>
> - Backend: `backend/`, API prefix `/api/v1`, response `snake_case` tiếng Việt không dấu.
> - Tài liệu nền: [`ARCHITECTURE_PLAN.md`](./ARCHITECTURE_PLAN.md), [`backend/README.md`](../backend/README.md).
> - Phạm vi: hành khách (`KHACH_HANG`) và tài xế (`TAI_XE`).

---

## 1. Quyết định kiến trúc đã chốt

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Nền tảng | Expo SDK 58 + React Native + TypeScript strict, chạy Expo Go cho development |
| 2 | Điều hướng | React Navigation 7: Native Stack + Bottom Tabs, phân luồng tự động theo `ten_vai_tro` |
| 3 | State toàn cục | Redux Toolkit + React Redux; server data qua `createAsyncThunk`, state cục bộ bằng hook |
| 4 | HTTP | Axios, timeout, chuẩn hóa envelope, gắn access token, silent refresh một lần cho nhiều request |
| 5 | Lưu token | Access token + refresh cookie trong `expo-secure-store`; AsyncStorage chỉ lưu dữ liệu không nhạy cảm |
| 6 | Realtime | `socket.io-client`, room `trip:{ma_chuyen}`, ack cho `trip:join`/`seat:hold`/`seat:release` |
| 7 | QR soát vé | `expo-camera` quét QR; luôn có ô nhập token thủ công dự phòng |
| 8 | VNPAY | `react-native-webview` mở URL sandbox; `expo-web-browser` cho fallback; xác nhận cuối cùng bằng trạng thái đơn từ backend |
| 9 | Định dạng | Tiền/BIGINT là string; thời gian backend UTC, hiển thị GMT+7 |
| 10 | Bảo mật | Không log token/mật khẩu; không tin client về giá, ghế hay vai trò; backend là nguồn xác thực cuối |

Nguyên tắc:

1. **Backend là nguồn sự thật.** Giá, trạng thái ghế, trạng thái đơn và kết quả soát vé do server quyết định.
2. **Redis là advisory lock, DB là trọng tài cuối.** Mobile chỉ phản ánh trạng thái qua socket và refetch REST khi cần.
3. **Một đơn = một chuyến.** Mỗi lần giữ ghế chỉ trong một `ma_chuyen`; đổi chuyến phải nhả ghế cũ.
4. **Single-flight refresh.** Nhiều request 401 đồng thời chỉ gọi `/auth/refresh` một lần.
5. **Không lưu refresh token dạng plaintext trong AsyncStorage.** Chỉ dùng SecureStore.

### 1.1. Ràng buộc từ backend hiện tại

- Backend luôn set refresh token trong cookie `HttpOnly`. Với header `X-Client-Type: mobile`, login/register/refresh trả thêm `refresh_token` trong body để React Native không phụ thuộc cookie jar.
- Mobile vẫn lưu cặp cookie nhận từ `Set-Cookie` trong SecureStore và gửi lại bằng header `Cookie` khi refresh/logout. Refresh nhận cả cookie và body token; xoay vòng token theo response.
- Đây là điểm khác biệt có chủ đích so với Web Admin. Khi build native production nên cân nhắc cookie manager native hoặc chỉ dùng refresh token body.
- `GET /api/v1/driver/trips` đã được bổ sung, chỉ trả chuyến có `ma_tai_xe` trùng tài khoản đang đăng nhập.
- `PATCH /auth/me` và `POST /auth/change-password` đã được bổ sung. Đổi mật khẩu thu hồi toàn bộ refresh token nên ứng dụng đưa người dùng về trạng thái đăng xuất.
- `GET /payments/vnpay/return` hiện trả JSON. WebView bắt URL return, gọi lại URL để backend xử lý, sau đó polling trạng thái đơn; không phụ thuộc redirect deep link.

---

## 2. Tech stack

| Nhóm | Thư viện |
|---|---|
| Runtime | Expo SDK 58, React Native 0.88, React 19 |
| Ngôn ngữ | TypeScript strict |
| Điều hướng | `@react-navigation/native`, `native-stack`, `bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler` |
| State | `@reduxjs/toolkit`, `react-redux` |
| HTTP | `axios` |
| Realtime | `socket.io-client` |
| Lưu trữ | `expo-secure-store`, `@react-native-async-storage/async-storage` |
| QR | `expo-camera` |
| Thanh toán | `react-native-webview`, `expo-web-browser` |
| Tiện ích | `expo-constants`, Expo env `EXPO_PUBLIC_*` |
| Test | Jest, `jest-expo`, `@testing-library/react-native`, `react-test-renderer` |
| Chất lượng | ESLint + `eslint-config-expo`, Prettier |

---

## 3. Cấu trúc thư mục

```text
mobile-app/
├─ App.tsx                        # Redux Provider + NavigationContainer
├─ index.ts                       # Expo entry
├─ app.json                       # Tên app, scheme, plugin native
├─ .env.example
├─ eslint.config.mjs
├─ jest.config.js
├─ jest.setup.ts
├─ tsconfig.json
├─ assets/                        # Icon, splash
├─ src/
│  ├─ api/
│  │  ├─ client.ts                # Axios + single-flight refresh + cookie/token mobile
│  │  ├─ endpoints/
│  │  │  ├─ auth.ts
│  │  │  ├─ trips.ts
│  │  │  ├─ bookings.ts
│  │  │  ├─ payments.ts
│  │  │  ├─ tickets.ts
│  │  │  └─ driver.ts
│  │  └─ errors.ts                # ApiError + đọc envelope lỗi
│  ├─ components/                 # Button, TextField, Screen, StatusView, InlineNotice
│  ├─ config/env.ts               # Đọc EXPO_PUBLIC_*
│  ├─ features/
│  │  ├─ auth/
│  │  │  ├─ LoginScreen.tsx
│  │  │  ├─ RegisterScreen.tsx
│  │  │  ├─ BootSplashScreen.tsx
│  │  │  ├─ UnsupportedRoleScreen.tsx
│  │  │  └─ validation.ts
│  │  ├─ search/SearchScreen.tsx
│  │  ├─ trips/TripDetailScreen.tsx
│  │  ├─ seats/
│  │  │  ├─ SeatSelectionScreen.tsx
│  │  │  └─ SeatMap.tsx
│  │  ├─ bookings/
│  │  │  ├─ BookingCheckoutScreen.tsx
│  │  │  ├─ PaymentWebViewScreen.tsx
│  │  │  └─ BookingDetailScreen.tsx
│  │  ├─ tickets/
│  │  │  ├─ MyTicketsScreen.tsx
│  │  │  └─ TicketDetailScreen.tsx
│  │  ├─ profile/
│  │  │  ├─ ProfileScreen.tsx
│  │  │  ├─ EditProfileScreen.tsx
│  │  │  └─ ChangePasswordScreen.tsx
│  │  └─ driver/
│  │     ├─ DriverHomeScreen.tsx
│  │     ├─ DriverTripDetailScreen.tsx
│  │     └─ ScanTicketScreen.tsx
│  ├─ hooks/
│  │  └─ useAppResume.ts          # Refetch màn hình đang focus khi app foreground
│  ├─ navigation/
│  │  ├─ RootNavigator.tsx        # Guest / Passenger / Driver
│  │  └─ types.ts
│  ├─ services/
│  │  ├─ app-lifecycle.ts         # Theo dõi AppState active, phát sự kiện resume
│  │  ├─ storage.ts               # SecureStore + AsyncStorage
│  │  ├─ socket-tracker.ts        # Theo dõi socket đang mở để reconnect
│  │  └─ socket.ts                # Socket.IO singleton + join/hold/extend/release
│  ├─ store/
│  │  ├─ index.ts
│  │  ├─ hooks.ts
│  │  ├─ authSlice.ts
│  │  └─ tripsSlice.ts
│  ├─ theme/colors.ts
│  ├─ types/
│  │  ├─ api.ts
│  │  ├─ auth.ts
│  │  ├─ trip.ts
│  │  ├─ booking.ts
│  │  ├─ ticket.ts
│  │  └─ driver.ts
│  └─ utils/
│     ├─ datetime.ts              # GMT+7, ngày YYYY-MM-DD
│     ├─ format.ts                # tiền, thời gian, khoảng cách
│     ├─ owner-ref.ts             # owner_ref hợp lệ 8–50 ký tự
│     ├─ seat-layout.ts           # nhóm ghế theo tầng/hàng/cột
│     ├─ status.ts                # nhãn trạng thái
│     └─ tickets.ts               # nhóm vé theo đơn
└─ __tests__/
   ├─ api/
   ├─ features/
   ├─ store/
   └─ utils/
```

---

## 4. Biến môi trường

Expo chỉ expose biến có tiền tố `EXPO_PUBLIC_`.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
EXPO_PUBLIC_SOCKET_PATH=/socket.io
EXPO_PUBLIC_APP_NAME=FUTA Bus
EXPO_PUBLIC_VNPAY_RETURN_PATH=/payments/vnpay/return
```

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Không | `http://localhost:3000/api/v1` | Base URL REST |
| `EXPO_PUBLIC_SOCKET_URL` | Không | `http://localhost:3000` | Origin Socket.IO |
| `EXPO_PUBLIC_SOCKET_PATH` | Không | `/socket.io` | Path Socket.IO |
| `EXPO_PUBLIC_APP_NAME` | Không | `FUTA Bus` | Tên hiển thị |
| `EXPO_PUBLIC_VNPAY_RETURN_PATH` | Không | `/payments/vnpay/return` | Path WebView dùng để bắt kết quả |

Lưu ý thiết bị:

- Android Emulator dùng `http://10.0.2.2:3000`.
- iOS Simulator dùng `http://localhost:3000`.
- Điện thoại thật dùng IP LAN của máy chạy backend, ví dụ `http://192.168.1.10:3000`.
- Không commit `.env`; chỉ commit `.env.example`.
- Production phải dùng HTTPS và siết `CORS_ORIGINS`/`SOCKET_CORS_ORIGINS` phù hợp.

---

## 5. API contract sử dụng

### 5.1. Xác thực

| Method | Endpoint | Ghi chú |
|---|---|---|
| `POST` | `/auth/register` | Body `ho_va_ten`, `so_dien_thoai`, `email?`, `mat_khau`, `xac_nhan_mat_khau`; auto login |
| `POST` | `/auth/login` | Body `so_dien_thoai`, `mat_khau` |
| `POST` | `/auth/refresh` | Gửi cookie và/hoặc body `refresh_token`; rotate token, trả body token cho mobile |
| `POST` | `/auth/logout` | Gửi cookie và/hoặc body `refresh_token` |
| `GET` | `/auth/me` | Bearer access token |
| `PATCH` | `/auth/me` | Cập nhật `ho_va_ten`, `so_dien_thoai`, `email` |
| `POST` | `/auth/change-password` | `mat_khau_cu`, `mat_khau_moi`, `xac_nhan_mat_khau_moi`; thu hồi refresh token |

Response đăng nhập:

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
      "email": null,
      "ma_chi_nhanh": null,
      "ten_vai_tro": "KHACH_HANG",
      "trang_thai_tai_khoan": "HOAT_DONG",
      "thoi_gian_tao": "2026-10-21T04:00:00.000Z"
    }
  }
}
```

Cookie refresh mặc định tên `futa_refresh_token`, path `/api/v1/auth`. Khi gửi header `X-Client-Type: mobile`, response login/register/refresh có thêm `data.refresh_token`; Web Admin không nhận trường này. Mobile luôn lưu cả cookie (nếu có) và body token, sau đó xóa cả hai khi logout hoặc refresh thất bại.

### 5.2. Tìm chuyến công khai

| Method | Endpoint | Query / response |
|---|---|---|
| `GET` | `/trips` | `tinh_di`, `tinh_den`, `ma_tuyen?`, `ngay=YYYY-MM-DD`, `page`, `limit`; data là mảng chuyến, `meta` phân trang |
| `GET` | `/trips/:id` | `{ chuyen_xe: TripDetail }`, gồm `diem_dung` |
| `GET` | `/trips/:id/seat-map` | `{ so_do_ghe: { ghe: [...] } }` |

`Trip` gồm:

```text
ma_chuyen, ma_tuyen, ten_tuyen, tinh_di, tinh_den,
ma_xe, bien_so_xe, ma_loai_xe, ten_loai_xe, tong_so_ghe,
ma_tai_xe, ten_tai_xe, so_dien_thoai_tai_xe, ma_chi_nhanh_tai_xe,
thoi_gian_xuat_ben, thoi_gian_den_du_kien, gia_ve_co_ban,
trang_thai, so_ghe_da_dat, so_ghe_dang_giu, so_ghe_trong
```

`Trip.diem_dung` gồm `ma_diem_dung`, `ten_diem_dung`, `dia_chi`, `loai_diem` (`DON`/`TRA`/`TRUNG_CHUYEN`), `thu_tu_dung`.

`Seat` gồm `ma_ghe`, `ky_hieu_ghe`, `tang`, `hang`, `cot`, `loai_cho` (`THUONG`/`VIP`), `trang_thai` (`TRONG`/`DANG_GIU`/`DA_DAT`).

### 5.3. Giữ ghế và đặt vé

| Method | Endpoint | Ghi chú |
|---|---|---|
| `POST` | `/bookings/quote` | Body `ma_chuyen`, `danh_sach_ghe`; không cần đăng nhập; trả `{ bao_gia }` |
| `POST` | `/bookings` | Cần Bearer + `owner_ref` + `Idempotency-Key`; trả `{ don_dat_ve, payment_url? }` |
| `GET` | `/bookings/:id` | Chủ đơn hoặc nhân viên có quyền; trả `{ don_dat_ve }` |
| `POST` | `/bookings/:id/cancel` | Chỉ đơn `CHO_THANH_TOAN`; trả `{ don_dat_ve }` |
| `POST` | `/payments/vnpay/create-url` | Gia hạn/tạo URL thanh toán cho đơn VNPAY; trả `{ thanh_toan }` |

Body tạo đơn:

```json
{
  "ma_chuyen": 12,
  "danh_sach_ghe": ["A01", "A02"],
  "owner_ref": "owner_abc123",
  "ma_diem_don": 1,
  "ma_diem_tra": 4,
  "phuong_thuc_thanh_toan": "VNPAY"
}
```

### 5.4. Vé và soát vé

| Method | Endpoint | Vai trò |
|---|---|---|
| `GET` | `/tickets/my` | `KHACH_HANG` |
| `GET` | `/tickets/:id` | Chủ vé / quản lý / tài xế được phân công |
| `GET` | `/tickets/:id/qr` | Chủ vé; trả `qr_data_url` |
| `POST` | `/tickets/check-in` | `TAI_XE`, body `{ ma_qr }` |
| `GET` | `/tickets/trips/:tripId/passengers` | `TAI_XE`, quản lý; trả `{ chuyen_xe }`, danh sách ở `chuyen_xe.danh_sach` |
| `GET` | `/driver/trips` | `TAI_XE`; query `trang_thai`, `tu_ngay`, `den_ngay`, `page`, `limit` |

`check-in` trả `{ already_checked_in, ve }`; quét lại vé đã lên xe là idempotent và không ghi đè thời gian/tài xế.

---

## 6. Socket.IO

Kết nối tới `EXPO_PUBLIC_SOCKET_URL` + path, gửi access token qua `auth.token`.

| Hướng | Event | Payload |
|---|---|---|
| C→S | `trip:join` | `{ ma_chuyen }`; ack `{ success, data: { so_do_ghe } }` |
| C→S | `trip:leave` | `{ ma_chuyen }` |
| C→S | `seat:hold` | `{ ma_chuyen, danh_sach_ghe, owner_ref }` |
| C→S | `seat:extend` | `{ ma_chuyen, owner_ref }` |
| C→S | `seat:release` | `{ ma_chuyen, danh_sach_ghe?, owner_ref }` |
| S→C | `seat:held` | `{ ma_chuyen, danh_sach_ghe, expires_at, ttl_seconds }` |
| S→C | `seat:released` | `{ ma_chuyen, danh_sach_ghe, reason }` |
| S→C | `seat:booked` | `{ ma_chuyen, danh_sach_ghe, ma_don_ve, trang_thai_don }` |

Quy ước:

- `owner_ref` sinh một lần cho mỗi phiên giữ ghế, khớp `^[A-Za-z0-9_-]{8,50}$`.
- Giữ ghế all-or-nothing: nếu một ghế bị người khác giữ, toàn bộ thao tác thất bại.
- Cùng `owner_ref` giữ lại ghế là idempotent (gia hạn TTL).
- Tự động `seat:extend` trước khi TTL hết; dừng khi rời màn hình hoặc tạo đơn thành công.
- Khi rời màn hình, gọi `seat:release` và `trip:leave`.
- Khi mất kết nối: hiển thị trạng thái, thử kết nối lại; refetch REST `/trips/:id/seat-map` để đồng bộ.
- Không dựa vào event để xác nhận đặt vé; chỉ dùng REST và trạng thái đơn.

---

## 7. Redux Toolkit

### 7.1. Store

```ts
configureStore({
  reducer: {
    auth: authReducer,
    trips: tripsReducer,
  },
});
```

### 7.2. `authSlice`

State:

```ts
{
  status: 'bootstrapping' | 'guest' | 'authenticated';
  user: PublicUser | null;
  isSubmitting: boolean;
  isUpdatingProfile: boolean;
  isLoggingOut: boolean;
  error: string | null;
  warning: string | null;
  fieldErrors: Record<string, string>;
}
```

Thunk:

- `bootstrapAuth`: đọc SecureStore, gọi `/auth/me`, dùng cache không nhạy cảm khi mất mạng.
- `login`: gọi API, lưu access token + refresh token/cookie, cập nhật user.
- `register`: đăng ký khách hàng, auto login.
- `updateProfile`: gọi `PATCH /auth/me`, cập nhật user và cache.
- `logout`: gọi API logout, xóa SecureStore/AsyncStorage, reset state.

Chỉ role `KHACH_HANG` và `TAI_XE` được vào app. Vai trò khác hiển thị màn hình từ chối và đăng xuất.

### 7.3. `tripsSlice`

State:

```ts
{
  search: {
    tinh_di: string;
    tinh_den: string;
    ngay: string;
    items: Trip[];
    meta: PaginationMeta | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
  detail: {
    ma_chuyen: number | null;
    trip: TripDetail | null;
    status: ...;
    error: string | null;
  };
  seatMap: {
    ma_chuyen: number | null;
    data: SeatMap | null;
    status: ...;
    error: string | null;
  };
}
```

### 7.4. Dữ liệu tài xế và vé

- Không dùng slice riêng cho tài xế/vé; màn hình gọi trực tiếp `driverApi`, `ticketsApi` và giữ state cục bộ.
- Danh sách chuyến, hành khách và kết quả check-in được refetch khi màn hình focus để phản ánh dữ liệu mới.
- Vé của tôi nhóm theo `ma_don_ve` bằng `groupTicketsByOrder`; tổng tiền tính từ `gia_ve` của từng vé.

---

## 8. Luồng điều hướng

```text
Bootstrap
  ├─ Chưa đăng nhập
  │   ├─ Search (công khai)
  │   │    └─ TripDetail → SeatSelection → yêu cầu đăng nhập
  │   ├─ Login
  │   └─ Register
  ├─ KHACH_HANG
  │   └─ PassengerTabs: Search | MyTickets | Profile
  │        └─ Root stack dùng chung:
  │           TripDetail → SeatSelection → BookingCheckout
  │           → PaymentWebView → BookingDetail
  │           MyTickets → TicketDetail (QR)
  │           Profile → EditProfile | ChangePassword
  ├─ TAI_XE
  │   └─ DriverTabs: DriverHome | DriverProfile
  │        └─ Root stack:
  │           DriverTripDetail → DriverScan
  │           Profile → EditProfile | ChangePassword
  └─ Vai trò khác
      └─ UnsupportedRole (đăng xuất)
```

Quy tắc:

- `RootNavigator` đọc `auth.status` và `auth.user.ten_vai_tro` để chọn nhánh.
- Đăng nhập thành công tự động chuyển sang đúng nhánh; không cần điều hướng thủ công.
- Đăng xuất/hết phiên hoặc đổi mật khẩu thành công đưa về nhánh khách.
- Guest dùng chung `SearchScreen` và `TripDetailScreen`; chỉ màn hình chọn ghế yêu cầu đăng nhập.
- Tab Vé của tôi và các màn hình tài xế đã hoàn thiện ở Phase 3–4.

---

## 9. Luồng Hành khách (`KHACH_HANG`)

### 9.1. Đăng nhập / Đăng ký

1. Nhập số điện thoại/mật khẩu hoặc thông tin đăng ký.
2. Validate client: số điện thoại Việt Nam, mật khẩu 8–72 ký tự, xác nhận khớp.
3. Gọi API; lưu access token + refresh cookie vào SecureStore.
4. Cập nhật Redux; RootNavigator chuyển sang PassengerTabs.

### 9.2. Tìm chuyến

1. Nhập điểm đi, điểm đến, chọn ngày trong 7 ngày tới.
2. Gọi `GET /trips` với `tinh_di`, `tinh_den`, `ngay`.
3. Hiển thị danh sách: giờ chạy, tuyến, loại xe, giá, số ghế trống.
4. Kéo để làm mới; phân trang tải thêm khi cuộn.
5. Không có kết quả: gợi ý đổi ngày/tuyến.

### 9.3. Chi tiết chuyến

1. Gọi `GET /trips/:id`.
2. Hiển thị tuyến, giờ đi/đến, xe, tài xế, giá, điểm đón/trả theo thứ tự.
3. Nút “Chọn ghế” mở sơ đồ.

### 9.4. Sơ đồ ghế 2 tầng và giữ chỗ realtime

1. Gọi REST `/trips/:id/seat-map` để có snapshot ban đầu.
2. Kết nối Socket.IO (nếu chưa), `trip:join`.
3. Render hai khu vực:
   - **Tầng dưới (A)**: `tang = 1`.
   - **Tầng trên (B)**: `tang = 2`.
   - Ghế sắp theo `hang`, `cot`; ghế VIP có màu/ nhãn riêng.
4. Chạm ghế `TRONG`:
   - Nếu đã chọn tối đa 5 ghế thì báo giới hạn.
   - Gọi `seat:hold` với toàn bộ danh sách ghế đang chọn + ghế mới + `owner_ref`.
   - Thành công: cập nhật selected và trạng thái hiển thị; lưu `expires_at`.
   - Thất bại: hiển thị ghế xung đột, refetch snapshot.
5. Chạm ghế đang chọn: gọi `seat:release` cho ghế đó.
6. Lắng nghe:
   - `seat:held`: ghế của người khác chuyển `DANG_GIU`.
   - `seat:released`: ghế về `TRONG` nếu không phải của mình.
   - `seat:booked`: ghế chuyển `DA_DAT`.
7. Tự động `seat:extend` mỗi 60 giây khi còn ghế đang giữ.
8. Rời màn hình: release toàn bộ ghế của mình, `trip:leave`, ngắt timer.
9. Hiển thị tổng tiền tạm tính theo giá vé; báo giá chính xác bằng `/bookings/quote` trước khi đặt.

### 9.5. Đặt vé và VNPAY Sandbox (Phase 3)

1. `BookingCheckout` tải chi tiết chuyến và `POST /bookings/quote` để lấy giá/ghế từ backend.
2. Chọn điểm đón (`DON`) và điểm trả (`TRA`) có thứ tự sau điểm đón; mặc định điểm đầu và điểm cuối phù hợp.
3. Xác nhận thông tin hành khách lấy từ hồ sơ.
4. Gọi `POST /bookings` với `owner_ref`, `danh_sach_ghe`, điểm đón/trả, `VNPAY`, `Idempotency-Key`.
5. Mở `payment_url` trong WebView; nếu chưa có URL thì gọi `/payments/vnpay/create-url`.
6. Bắt URL chứa `/payments/vnpay/return`, gọi lại URL để backend xử lý; không tin query params của VNPAY.
7. Poll `GET /bookings/:id` đến khi đơn rời `CHO_THANH_TOAN`, sau đó mở `BookingDetail`.
8. `BookingDetail` cho thanh toán lại hoặc hủy đơn chờ; `MyTickets` cũng cho thanh toán/hủy và mở QR khi đã thanh toán.
9. WebView có fallback mở trình duyệt hệ thống và nút kiểm tra lại khi quay về ứng dụng.

### 9.6. Vé của tôi (Phase 3)

1. `GET /tickets/my` với `limit=100`, gộp vé theo `ma_don_ve`.
2. Lọc theo trạng thái đơn: tất cả, chờ thanh toán, đã thanh toán, đã hủy.
3. Mỗi đơn hiển thị tuyến, giờ, tổng tiền, trạng thái và từng ghế/hành khách.
4. Đơn chờ thanh toán có nút thanh toán VNPAY và hủy đơn; đơn đã thanh toán mở được vé.
5. `TicketDetail` gọi `/tickets/:id` và `/tickets/:id/qr`, hiển thị ảnh QR từ `qr_data_url`, trạng thái soát vé, tài xế và biển số.
6. Chưa hỗ trợ lưu ảnh QR vào thư viện; mã QR và token dạng text vẫn xem được trong ứng dụng.

---

## 10. Luồng Tài xế (`TAI_XE`)

### 10.1. Danh sách chuyến được phân công (Phase 4)

- `GET /driver/trips` trả chuyến của chính tài xế; hỗ trợ lọc `trang_thai`, `tu_ngay`, `den_ngay`.
- `DriverHome` tải tối đa 100 chuyến, hiển thị thống kê tổng/đang chạy/sắp chạy và lọc cục bộ theo trạng thái.
- Chỉ cho mở chuyến thuộc `ma_tai_xe` của tài khoản; backend vẫn kiểm tra quyền khi xem hành khách/check-in.

### 10.2. Danh sách hành khách

- `GET /tickets/trips/:tripId/passengers`.
- Hiển thị tổng khách, đã lên xe, chưa lên xe.
- Mỗi khách: ghế, họ tên, số điện thoại, trạng thái soát vé.

### 10.3. Quét QR soát vé

1. Mở `CameraView` của `expo-camera`, chỉ quét barcode loại `qr`.
2. Có nút bật/tắt đèn và ô nhập token thủ công dự phòng khi camera không đọc được.
3. Gọi `POST /tickets/check-in` với `{ ma_qr }`; dùng `X-Client-Type: mobile`.
4. Xử lý kết quả:
   - Thành công: hiện thông tin vé, ghế, khách, tuyến, thời gian soát.
   - `already_checked_in: true`: cảnh báo vé đã soát, không ghi nhận thêm.
   - Sai chuyến/tài xế hoặc vé không hợp lệ: hiển thị message từ backend.
5. Khóa quét trong lúc gọi API và sau khi có kết quả; lỗi có nút “Thử quét lại”.
6. Không lưu token QR vào log hoặc AsyncStorage.
7. Khi mở từ một chuyến, `DriverTripDetail` tự refetch danh sách hành khách sau khi quay lại.

---

## 11. Silent refresh và lưu trữ

### 11.1. Access token

- Lưu SecureStore key `futa.access_token`.
- Giữ bản in-memory trong module API để không đọc SecureStore mỗi request.
- Xóa khi logout, refresh thất bại hoặc tài khoản bị khóa.

### 11.2. Refresh cookie

- Sau login/register/refresh, đọc `set-cookie`, tách `futa_refresh_token=...`.
- Lưu chuỗi cookie trong SecureStore key `futa.refresh_cookie`.
- Mobile gửi `X-Client-Type: mobile` để nhận thêm `refresh_token` trong body; lưu token trong key `futa.refresh_token`.
- Khi gọi refresh/logout, gửi cả header `Cookie` (nếu có) và body `refresh_token` (nếu có).
- Refresh thành công: cập nhật cookie/token mới theo rotation; nếu response không có token mới thì xóa token cũ.
- Không gửi cookie cho domain khác.

### 11.3. AsyncStorage

Chỉ dùng cho:

- Bộ lọc tìm chuyến gần nhất.
- Cờ onboarding.
- Cache không nhạy cảm (nếu có).

Không lưu token, mật khẩu, QR token hoặc thông tin thanh toán.

### 11.4. Luồng 401

1. Request nhận 401 (trừ login/register/refresh).
2. Nếu chưa có refresh đang chạy, bắt đầu một promise refresh.
3. Các request 401 khác chờ cùng promise.
4. Refresh thành công: cập nhật token, phát lại request gốc một lần.
5. Refresh thất bại: xóa phiên, dispatch logout, về Login.
6. Không retry vô hạn; mỗi request chỉ thử lại tối đa một lần.

---

## 12. Xử lý lỗi và UX

- Chuẩn hóa lỗi backend `{ success:false, code, message, details?, trace_id? }` thành `ApiError`.
- Validation `422`: map `details` theo `field` để hiển thị dưới input.
- Lỗi mạng: thông báo “Không kết nối được máy chủ” + nút thử lại.
- Loading: skeleton/ActivityIndicator; tránh nhấp nhiều lần.
- Empty state: hướng dẫn đổi bộ lọc/ngày.
- Ghế conflict: thông báo rõ ghế nào vừa bị giữ; refetch sơ đồ.
- Không hiển thị stack trace hoặc trace_id cho người dùng; chỉ log ở dev.

---

## 13. Lộ trình Phase

### Phase 1 — Khởi tạo, Auth và Điều hướng (đã hoàn thành)

- Khởi tạo Expo TypeScript strict, ESLint, Prettier, Jest.
- Cấu hình env, Redux store, Axios client, SecureStore/AsyncStorage.
- Silent refresh + cookie jar thủ công.
- Màn hình Login, Register, Profile.
- RootNavigator theo vai trò `KHACH_HANG` / `TAI_XE`; chặn vai trò khác.
- Unit test auth slice, validation, format.

**DoD:** đăng nhập/đăng ký/đăng xuất hoạt động; phân luồng đúng; typecheck/lint/test pass.

### Phase 2 — Tìm chuyến, Chi tiết và Sơ đồ ghế realtime (đã hoàn thành)

- Tìm chuyến công khai, lọc ngày, phân trang.
- Chi tiết chuyến và điểm dừng.
- Sơ đồ ghế 2 tầng, trạng thái realtime.
- Giữ/nhả/gia hạn ghế qua Socket.IO; giới hạn 5 ghế.
- Guest search trước khi đăng nhập.
- Unit test seat layout, SeatMap, trips slice.

**DoD:** tìm chuyến, xem chi tiết, giữ ghế đồng bộ giữa hai thiết bị; mất kết nối có cảnh báo/refetch; test pass.

**Trạng thái:** đã triển khai tìm kiếm + tải thêm, chi tiết chuyến, sơ đồ ghế hai tầng, giữ/nhả/gia hạn ghế, countdown và refetch khi reconnect. Toàn bộ mobile hiện có 53 test pass, typecheck/lint sạch, Expo Doctor 20/20.

### Phase 3 — Đặt vé, VNPAY và Vé của tôi (đã hoàn thành)

- Chọn điểm đón/trả, quote, tạo đơn idempotent.
- WebView VNPAY Sandbox, polling trạng thái đơn.
- Danh sách vé, chi tiết vé, ảnh QR.
- Hủy đơn chờ thanh toán.
- Cập nhật hồ sơ và đổi mật khẩu (bổ sung trong quá trình hoàn thiện).

**DoD:** đặt vé thành công, thanh toán sandbox, vé QR hiển thị; không bán trùng ghế.

**Trạng thái:** `BookingCheckout`, `PaymentWebView`, `BookingDetail`, `MyTickets`, `TicketDetail`, `EditProfile`, `ChangePassword` đã triển khai; API booking/payment/ticket/profile có test contract.

### Phase 4 — Tài xế và soát vé (đã hoàn thành)

- Bổ sung/ kết nối endpoint chuyến được phân công.
- Danh sách hành khách đón/trả.
- Quét QR bằng camera + nhập token dự phòng.
- Chống quét trùng, hiển thị lỗi vé giả/sai chuyến/ngoài giờ.

**DoD:** tài xế chỉ thấy chuyến của mình; check-in đúng; quét lại idempotent.

**Trạng thái:** backend có `GET /driver/trips`; mobile có `DriverHome`, `DriverTripDetail`, `ScanTicket` với camera, đèn, nhập token thủ công, khóa quét và xử lý `already_checked_in`.

### Phase 5 — Hardening và phát hành (đã hoàn thành)

- Offline/retry, xử lý app background, refresh socket.
- Accessibility, responsive tablet.
- EAS build, app icon/splash, cấu hình deep link.
- Kiểm thử trên Android/iOS thật; tài liệu vận hành.

**Trạng thái:** đã bổ sung lifecycle dùng chung: khi app trở lại foreground, các Socket.IO đang mở được reconnect và màn hình đang focus tự refetch dữ liệu (`Search`, `TripDetail`, `SeatSelection`, `BookingCheckout`, `BookingDetail`, `MyTickets`, `TicketDetail`, `DriverHome`, `DriverTripDetail`). Đã thêm `eas.json` với profile `development`/`preview`/`production`, cấu hình `versionCode`/`buildNumber`, giữ scheme `futaapp`, bundle/package `com.futa.bus`; README có hướng dẫn build và vận hành. Typecheck/lint/format/test mobile pass **53 test / 12 suite**, Expo Doctor 20/20 và export Android thành công. Build EAS thực tế và kiểm thử thiết bị thật vẫn cần tài khoản Expo/Apple/Google và backend public tương ứng.

---

## 14. Kiểm thử

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npx expo-doctor
```

Phạm vi test:

- Reducer auth: bootstrap, login, register, update profile, logout và lỗi validation.
- Validation: số điện thoại, mật khẩu, xác nhận mật khẩu, email.
- Format: tiền VND, ngày giờ GMT+7, thời lượng.
- Seat layout: nhóm tầng 1/2, sắp theo hàng/cột, đánh dấu ghế đã chọn.
- Component: LoginScreen render và submit; SeatMap nhận trạng thái và gọi callback.
- Contract API Phase 3–4: unwrap quote/booking/payment/QR/passengers, gửi đúng `Idempotency-Key` và payload check-in.
- Nhóm vé theo đơn, cộng tổng tiền và sắp xếp theo giờ khởi hành.
- Lifecycle: chỉ phát resume khi chuyển từ background/inactive sang active, dùng chung một AppState subscription và không chặn các listener khác khi một listener lỗi.
- Socket tracker: reconnect socket đang mở, ép handshake mới nếu socket báo vẫn connected, bỏ qua socket đã untrack.
- Hiện có **53 test / 12 suite** phía mobile; backend **130 test / 22 file**.

Không dùng snapshot rộng; ưu tiên hành vi và reducer thuần.

---

## 15. Rủi ro và điểm cần theo dõi

| Rủi ro | Giảm thiểu |
|---|---|
| RN không tự quản lý cookie HttpOnly | Cookie jar SecureStore kết hợp refresh token body cho mobile; test refresh rotation |
| Refresh token bị lộ nếu lưu sai chỗ | Chỉ SecureStore; không AsyncStorage/log |
| Socket lệch trạng thái | REST snapshot + broadcast + refetch khi reconnect; reconnect và resync khi app foreground |
| App bị suspend làm socket chết nhưng client vẫn báo connected | Ép handshake lại khi resume; màn hình đang focus refetch REST |
| Giữ ghế quá TTL | Gia hạn định kỳ, hiển thị countdown, release khi rời màn hình |
| VNPAY return trả JSON | WebView bắt URL return + polling trạng thái đơn; fallback trình duyệt |
| WebView không mở được ứng dụng ngân hàng | Nút mở trình duyệt + kiểm tra lại trạng thái đơn |
| Android emulator không gọi được localhost | Dùng `10.0.2.2`; test trên thiết bị thật |
| CORS/socket chặn Expo | Cấu hình origin/IP phù hợp môi trường dev |
| Camera không khả dụng/không cấp quyền | Nút cấp quyền, mở cài đặt và nhập token thủ công |

---

## 16. Tiêu chí hoàn thành toàn app

- Hành khách đăng ký/đăng nhập, tìm chuyến, xem chi tiết, giữ ghế realtime, đặt và thanh toán VNPAY sandbox, xem vé QR.
- Tài xế đăng nhập, xem chuyến được phân công, danh sách khách, quét QR và nhận kết quả chống trùng.
- Không bán trùng ghế trong mọi tình huống race.
- Access token/refresh cookie không bị lộ; silent refresh hoạt động.
- Typecheck, lint, test pass; build EAS thành công.
