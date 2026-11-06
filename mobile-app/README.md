# FUTA Bus Mobile App

Ứng dụng Expo/React Native cho hành khách đặt vé và tài xế soát vé của hệ thống FUTA Bus.

## Yêu cầu

- Node.js và npm
- Backend tại [`../backend`](../backend) đang chạy
- Expo Go hoặc development build cho thiết bị thật

## Cài đặt

```bash
npm install
cp .env.example .env
```

Chỉnh `.env` theo môi trường chạy:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
EXPO_PUBLIC_SOCKET_PATH=/socket.io
EXPO_PUBLIC_APP_NAME=FUTA Bus
EXPO_PUBLIC_VNPAY_RETURN_PATH=/payments/vnpay/return
```

- Android Emulator: dùng `http://10.0.2.2:3000`.
- iOS Simulator: dùng `http://localhost:3000`.
- Thiết bị thật: dùng IP LAN của máy chạy backend.

## Chạy ứng dụng

```bash
npm start
npm run android
npm run ios
```

## Kiểm tra chất lượng

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npx expo-doctor
```

## Build và phát hành (EAS)

`eas.json` cung cấp ba profile:

- `development`: build nội bộ dạng APK, iOS Simulator, `APP_ENV=development`.
- `preview`: build nội bộ dạng APK để kiểm thử trên thiết bị.
- `production`: build để phát hành, tự tăng `versionCode`/`buildNumber` từ cấu hình local.

Profile `development` hiện chưa dùng `expo-dev-client` để giữ bộ dependency hiện tại. Nếu cần dev client, cài `expo-dev-client` và bật `developmentClient: true` trong profile tương ứng.

Trước khi build, cấu hình biến môi trường trên EAS (hoặc trong profile) cho `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_SOCKET_PATH`, `EXPO_PUBLIC_APP_NAME`, `EXPO_PUBLIC_VNPAY_RETURN_PATH`. Backend phải dùng HTTPS và reachable từ thiết bị thật.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform android --profile production
```

Deep link của ứng dụng dùng scheme `futaapp` (ví dụ `futaapp://`). Bundle identifier/package hiện tại là `com.futa.bus`.

## Chức năng

### Hành khách (`KHACH_HANG`)

- Đăng ký, đăng nhập, silent refresh và đăng xuất.
- Tìm chuyến theo tuyến/ngày, tải thêm và xem chi tiết.
- Sơ đồ ghế hai tầng realtime: giữ, nhả, gia hạn ghế qua Socket.IO.
- Đặt vé với điểm đón/trả, báo giá và `Idempotency-Key`.
- Thanh toán VNPAY Sandbox trong WebView, có fallback trình duyệt và polling trạng thái đơn.
- Xem đơn vé, hủy đơn chờ thanh toán.
- Vé của tôi: nhóm theo đơn, xem QR điện tử, trạng thái soát vé.
- Cập nhật hồ sơ và đổi mật khẩu.

### Tài xế (`TAI_XE`)

- Danh sách chuyến được phân công, lọc theo trạng thái.
- Chi tiết chuyến, lịch trình và danh sách hành khách.
- Quét QR bằng `expo-camera` hoặc nhập mã thủ công.
- Hiển thị kết quả check-in, bao gồm trường hợp vé đã được soát trước đó.

## Cấu trúc chính

```text
src/
├─ api/            # Axios client, silent refresh, endpoint modules
├─ components/     # UI dùng chung
├─ config/         # Biến môi trường
├─ features/       # Màn hình theo nghiệp vụ
│  ├─ auth/
│  ├─ bookings/
│  ├─ driver/
│  ├─ profile/
│  ├─ search/
│  ├─ seats/
│  ├─ tickets/
│  └─ trips/
├─ navigation/     # RootNavigator và route params
├─ hooks/          # Hook dùng chung (resume app, refetch màn hình đang focus)
├─ services/       # SecureStore, AsyncStorage, lifecycle, Socket.IO
├─ store/          # Redux Toolkit slices
├─ theme/          # Màu sắc, spacing, radius
├─ types/          # Contract TypeScript
└─ utils/          # Format, trạng thái, nhóm vé, layout ghế
```

## Ghi chú kỹ thuật

- Backend là nguồn sự thật cho giá, ghế, trạng thái đơn và kết quả soát vé.
- Access token và refresh token được lưu trong `expo-secure-store`; không lưu token trong AsyncStorage.
- Mobile gửi header `X-Client-Type: mobile`; backend trả thêm `refresh_token` trong body cho mobile và vẫn set cookie `HttpOnly`.
- Request 401 được refresh một lần theo cơ chế single-flight rồi phát lại.
- VNPAY Return URL được WebView chặn để backend xử lý; ứng dụng chỉ tin trạng thái đơn khi polling `GET /bookings/:id`.
- QR vé lấy từ `GET /tickets/:id/qr` dưới dạng `qr_data_url`; check-in gửi `{ ma_qr }` và xử lý `already_checked_in`.
- Thời gian backend là UTC; giao diện hiển thị theo GMT+7.
- Khi app trở lại foreground, socket đang mở được reconnect và màn hình đang focus tự refetch dữ liệu; chỉ áp dụng cho màn hình đang hiển thị để tránh tải lại nền không cần thiết.

## Tài liệu

- [`../docs/MOBILE_APP_PLAN.md`](../docs/MOBILE_APP_PLAN.md)
- [`../docs/ARCHITECTURE_PLAN.md`](../docs/ARCHITECTURE_PLAN.md)
- [`../backend/README.md`](../backend/README.md)
