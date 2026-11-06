# Kế hoạch và trạng thái Web Admin FUTA Bus

Tài liệu này mô tả phạm vi, kiến trúc, phân quyền, hướng dẫn vận hành và trạng thái triển khai của `frontend-admin/`. Hướng dẫn cài đặt chi tiết nằm tại [`frontend-admin/README.md`](../frontend-admin/README.md).

## 1. Mục tiêu

Xây dựng ứng dụng quản trị độc lập tại `frontend-admin/`, kết nối backend FUTA Bus, phục vụ bốn nhóm người dùng:

- `QUAN_TRI_VIEN`: toàn hệ thống.
- `DIEU_HANH`: nghiệp vụ và báo cáo toàn hệ thống; không xác nhận thanh toán tiền mặt.
- `QUAN_LY_CHI_NHANH`: dữ liệu và đơn vé trong chi nhánh.
- `NHAN_VIEN_PHONG_VE`: bán vé, tra cứu đơn trong chi nhánh.

Ứng dụng chạy tại `http://localhost:5174`.

## 2. Phạm vi chức năng

| Nhóm | Chức năng | Trạng thái |
| --- | --- | --- |
| Dashboard | KPI doanh thu, vé, chuyến, tỷ lệ lấp đầy, doanh thu theo ngày, tuyến bán chạy | Hoàn thành |
| Chi nhánh | CRUD, trạng thái hoạt động | Hoàn thành |
| Tài khoản | CRUD, vai trò, gán chi nhánh, khóa/mở, đổi mật khẩu | Hoàn thành |
| Loại xe | CRUD, cấu hình số tầng, thiết kế sơ đồ ghế thường/VIP | Hoàn thành |
| Đội xe | CRUD, biển số, loại xe, trạng thái | Hoàn thành |
| Tuyến đường | CRUD, điểm đi/đến, điểm dừng, thứ tự, khoảng cách, thời gian | Hoàn thành |
| Chuyến xe | CRUD, tuyến, xe, tài xế, giờ chạy, giá vé, trạng thái | Hoàn thành |
| Phòng vé | Chọn tuyến/chuyến, sơ đồ ghế realtime, giữ ghế, báo giá, tạo đơn, tiền mặt/VNPAY | Hoàn thành |
| Đơn vé | Danh sách, lọc, tìm kiếm, chi tiết, hủy, xác nhận tiền mặt | Hoàn thành |
| Hồ sơ | Thông tin cá nhân, đổi mật khẩu | Hoàn thành |
| Hardening | Lazy route, tách chunk, test bổ sung, tài liệu vận hành | Hoàn thành |

## 3. Công nghệ

- React 18.3.1 + TypeScript + Vite 7.
- Ant Design 5 và Ant Design Icons.
- React Router 6 với lazy route và `Suspense`.
- TanStack Query 5 cho server state.
- Zustand 5 cho phiên đăng nhập.
- Axios với refresh token single-flight.
- Recharts cho dashboard.
- Day.js cho thời gian.
- Socket.IO client cho trạng thái ghế.
- Vitest + Testing Library cho unit/component test.

## 4. Cài đặt nhanh

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

```powershell
cd frontend-admin
npm install
```

Tạo `frontend-admin/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
VITE_SOCKET_PATH=/socket.io
VITE_APP_NAME=FUTA Bus Admin
```

```powershell
npm run dev
```

Backend cần cấu hình:

```dotenv
CORS_ORIGINS=http://localhost:5174
SOCKET_CORS_ORIGINS=http://localhost:5174
SEED_DEMO_DATA=true
```

## 5. Biến môi trường frontend

| Biến | Bắt buộc | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Không | `http://localhost:3000/api/v1` | Base URL REST API |
| `VITE_SOCKET_URL` | Không | `http://localhost:3000` | Origin Socket.IO |
| `VITE_SOCKET_PATH` | Không | `/socket.io` | Path Socket.IO |
| `VITE_APP_NAME` | Không | `FUTA Bus Admin` | Tên ứng dụng |

Không commit `.env.local` hoặc secret. Access token chỉ nằm trong bộ nhớ; refresh token nằm trong cookie HttpOnly.

## 6. Tài khoản demo

Seed backend tạo tài khoản quản trị từ `ADMIN_PHONE` / `ADMIN_PASSWORD`; khi `SEED_DEMO_DATA=true`, seed tạo thêm tài khoản demo dùng chung mật khẩu `ADMIN_PASSWORD`.

| Số điện thoại | Vai trò | Chi nhánh | Mật khẩu mặc định |
| --- | --- | --- | --- |
| `0900000000` | `QUAN_TRI_VIEN` | Toàn hệ thống | `Admin@123456` |
| `0901000003` | `QUAN_LY_CHI_NHANH` | `PV_MIEN_TAY` | `Admin@123456` |
| `0901000001` | `TAI_XE` | `PV_MIEN_TAY` | `Admin@123456` |
| `0901000002` | `TAI_XE` | `PV_DA_LAT` | `Admin@123456` |

Lưu ý:

- Tài xế và khách hàng không vào được Web Admin.
- Seed mặc định không có `DIEU_HANH` và `NHAN_VIEN_PHONG_VE`; tạo bằng tài khoản quản trị.
- Đổi mật khẩu demo trước khi triển khai thật.

## 7. Kiến trúc

```text
frontend-admin/
  src/
    api/
      endpoints/          # REST client theo module
      http.ts             # Axios, refresh single-flight, chuẩn hóa lỗi
      query-keys.ts       # Query key tập trung
      token.ts            # Access token in-memory
    app/
      providers.tsx       # QueryClient, AntD, Router, auth bootstrap
      router.tsx          # Lazy route + Suspense + RBAC
      route-meta.tsx      # Menu, tiêu đề, quyền theo route
    components/
      common/             # PageHeader, StatusTag, TableToolbar...
      feedback/           # Loading, 403, 404
      guards/             # AuthGuard, RoleGuard
      layout/             # AdminLayout
    features/
      auth/
      dashboard/
      branches/
      users/
      vehicle-types/      # Gồm SeatDesigner
      vehicles/
      routes/
      trips/
      counter/            # Phòng vé, sơ đồ ghế realtime
      orders/             # Tra cứu và xử lý đơn vé
    lib/
      format.ts           # Tiền, ngày giờ GMT+7, số, khoảng cách
      roles.ts            # RBAC helper
      socket.ts           # Socket.IO client
    styles/global.css
    types/                # DTO TypeScript theo miền nghiệp vụ
  tests/
    setup.ts              # Polyfill jsdom cho Ant Design
    test-utils.tsx        # Provider test dùng chung
```

Quy ước:

- Component không gọi Axios trực tiếp; dùng endpoint client + hook TanStack Query.
- Query key tập trung tại `src/api/query-keys.ts`.
- Tiền và BIGINT nhận dạng string; định dạng qua `src/lib/format.ts`.
- Thời gian backend là UTC; UI hiển thị GMT+7.
- Route bảo vệ bằng `AuthGuard` và `RoleGuard`; menu lọc theo vai trò.
- Mỗi trang là lazy chunk để giảm bundle tải ban đầu.

## 8. Xác thực và phân quyền

- Access token chỉ lưu trong bộ nhớ, không dùng localStorage.
- Refresh token nằm trong cookie HttpOnly do backend set.
- Axios dùng `withCredentials: true`.
- Gặp 401: gọi `/auth/refresh` một lần; các request đồng thời dùng chung một promise.
- Không refresh cho `/auth/login`, `/auth/register`, `/auth/refresh`.
- Khởi động ứng dụng gọi refresh để khôi phục phiên; thất bại thì hiện trang đăng nhập.
- `AuthGuard` chặn chưa đăng nhập; `RoleGuard` chặn sai vai trò.

Ma trận quyền:

| Route | ADMIN | QLCN | DIEU_HANH | NVPV |
| --- | --- | --- | --- | --- |
| `/dashboard` | Có | Có | Có | Không |
| `/branches` | Có | Không | Không | Không |
| `/users` | Có | Có | Có | Không |
| `/vehicle-types` | Có | Có | Có | Không |
| `/vehicles` | Có | Có | Có | Không |
| `/routes` | Có | Có | Có | Không |
| `/trips` | Có | Có | Có | Không |
| `/counter` | Có | Có | Không | Có |
| `/orders` | Có | Có | Có | Có |
| `/profile` | Có | Có | Có | Có |

Phân quyền dữ liệu:

- ADMIN và DIEU_HANH xem toàn hệ thống.
- QLCN và NVPV bị backend ép theo `ma_chi_nhanh`.
- Danh sách đơn của QLCN/NVPV gồm đơn có `ma_chi_nhanh_ban` bằng chi nhánh mình và đơn online chưa gán chi nhánh (`NULL`).
- Không tin tham số chi nhánh do client gửi cho tài khoản cấp chi nhánh.

## 9. Quy ước dữ liệu

- API prefix: `/api/v1`.
- Envelope thành công: `{ success: true, data, meta? }`.
- Envelope lỗi: `{ success: false, code, message, details?, trace_id? }`.
- Tiền và BIGINT trả về dạng string.
- Thời gian backend là UTC; UI hiển thị `Asia/Ho_Chi_Minh` (GMT+7).
- Phân trang mặc định 20, tối đa 100.
- Ngày lọc gửi dạng `YYYY-MM-DD`; backend chuyển sang khoảng UTC theo ngày Việt Nam.

## 10. API chính

### Xác thực

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/change-password`

### Danh mục

- `/branches`
- `/users`
- `/vehicle-types`
- `/vehicles`
- `/routes`
- `/routes/:id/stops`
- `/trips`
- `/admin/trips`

### Nghiệp vụ

- `GET /bookings`: danh sách đơn, lọc `q`, `ma_dinh_danh_don`, `so_dien_thoai_khach`, `ma_chuyen`, `ma_chi_nhanh`, `trang_thai_don`, `tu_ngay`, `den_ngay`, `page`, `limit`.
- `GET /bookings/by-code/:code`: tra cứu theo mã đặt vé.
- `GET /bookings/:id`: chi tiết đơn.
- `POST /bookings/quote`: báo giá ghế.
- `POST /bookings`: tạo đơn; hỗ trợ `Idempotency-Key`.
- `POST /bookings/:id/cancel`: hủy đơn chờ thanh toán.
- `POST /bookings/:id/confirm-cash`: xác nhận tiền mặt, chỉ ADMIN/QLCN/NVPV.
- `GET /statistics/*`: dashboard.

## 11. Realtime phòng vé

- Client kết nối Socket.IO kèm access token.
- Chọn chuyến: `trip:join`, nhận snapshot sơ đồ ghế.
- Giữ ghế: `seat:hold`; gia hạn: `seat:extend`; nhả ghế: `seat:release`.
- Server phát `seat:held`, `seat:released`, `seat:booked` tới room của chuyến.
- UI cập nhật trạng thái `TRONG`, `DANG_GIU`, `DA_DAT`; mất kết nối thì cảnh báo và refetch REST.
- REST vẫn là nguồn xác thực cuối cùng khi tạo đơn.

## 12. Lộ trình và trạng thái

### Phase 0 - Khung dự án: Hoàn thành

- Khởi tạo Vite, TypeScript, ESLint, Prettier, Vitest.
- Cấu hình alias, biến môi trường.

### Phase 1 - Xác thực: Hoàn thành

- Axios client, refresh single-flight, token store.
- Trang đăng nhập, khôi phục phiên, đăng xuất.
- Guard và xử lý 401/403.

### Phase 2 - Layout và Dashboard: Hoàn thành

- Admin layout, menu theo vai trò, header, breadcrumb.
- Dashboard KPI, biểu đồ doanh thu, tuyến bán chạy.

### Phase 3 - Danh mục: Hoàn thành

- Chi nhánh, tài khoản.
- Loại xe và sơ đồ ghế hai tầng.
- Đội xe, tuyến đường và điểm dừng.

### Phase 4 - Chuyến xe: Hoàn thành

- CRUD chuyến, gán xe/tài xế, giá vé, trạng thái.
- Kiểm tra trùng giờ, trạng thái xe/tài xế.

### Phase 5 - Phòng vé: Hoàn thành

- Chọn tuyến/ngày/chuyến, sơ đồ ghế realtime.
- Giữ/nhả/gia hạn ghế, báo giá, tạo đơn.
- Tiền mặt tại quầy hoặc VNPAY.
- Giới hạn 5 ghế mỗi đơn.

### Phase 6 - Đơn vé: Hoàn thành

- Danh sách, bộ lọc, tra cứu theo mã/số điện thoại.
- Chi tiết, hủy, xác nhận tiền mặt.

### Phase 7 - Hardening và Polish: Hoàn thành

- `React.lazy` + `Suspense` cho toàn bộ route.
- Tách chunk `antd`, `antd-icons`, `recharts`, `charts-vendor`, `socket`, `react-vendor`, `query-vendor`, `app-vendor`.
- Không còn cảnh báo chunk > 500 kB.
- Bổ sung component test cho `OrdersPage`, `CounterPage`, `SeatDesigner`, `SeatMapPreview`.
- Hoàn thiện README và tài liệu kế hoạch.

## 13. Kiểm thử và chất lượng

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Phạm vi test hiện tại:

- Định dạng tiền, ngày giờ, số.
- Phân quyền và helper RBAC.
- Chuyển đổi dữ liệu biểu đồ dashboard.
- `OrdersPage`: danh sách, mở chi tiết, nút thu tiền mặt.
- `CounterPage`: trạng thái realtime, chọn chuyến, giữ/nhả ghế.
- `SeatDesigner` và `SeatMapPreview`: đổi VIP, chuyển tầng, hiển thị hai tầng.

Tiêu chí hoàn thành:

- Typecheck, lint, Prettier, test và build đều pass.
- Build không còn cảnh báo kích thước chunk.
- Không có secret trong mã nguồn hoặc tài liệu.

## 14. Rủi ro và lưu ý vận hành

- Sơ đồ ghế realtime phụ thuộc Redis và Socket.IO; cần kiểm tra health backend.
- Khi mất kết nối, UI refetch REST nhưng vẫn có thể lệch ngắn hạn; thao tác tạo đơn được backend xác thực lại.
- Không hiển thị hoặc ghi log access token, refresh token, thông tin thanh toán nhạy cảm.
- Mọi thao tác hủy/xác nhận thanh toán phải xác nhận lại và xử lý lỗi cạnh tranh.
- Thay mật khẩu demo và secret trước khi triển khai ngoài local.
- Cấu hình CORS/socket đúng origin khi đổi domain hoặc cổng.
