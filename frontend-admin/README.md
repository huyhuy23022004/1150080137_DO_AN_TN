# FUTA Bus Admin

Web quản trị cho hệ thống đặt vé xe FUTA Bus. Ứng dụng dành cho nhân viên vận hành, quản lý chi nhánh và quản trị viên; không dành cho tài xế hoặc khách hàng.

## 1. Công nghệ

- React 18.3 + TypeScript + Vite 7
- Ant Design 5 + Ant Design Icons
- React Router 6 với route-level `React.lazy` + `Suspense`
- TanStack Query 5 cho server state
- Zustand 5 cho phiên đăng nhập
- Axios với refresh token single-flight
- Socket.IO client cho sơ đồ ghế realtime
- Recharts cho dashboard
- Day.js cho thời gian
- Vitest + Testing Library

## 2. Yêu cầu môi trường

- Node.js **20.19+**
- npm 10+
- Backend FUTA Bus đang chạy (mặc định `http://localhost:3000`)
- MySQL 8 và Redis 7 cho backend
- Trình duyệt hiện đại hỗ trợ ES2022

Trên Windows PowerShell, nếu bị chặn `npm.ps1`, dùng `npm.cmd`.

## 3. Cài đặt

```powershell
# 1. Chuẩn bị backend
cd backend
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev

# 2. Chạy Web Admin ở terminal khác
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

Chạy development:

```powershell
npm run dev
```

Ứng dụng mở tại `http://localhost:5174`.

Backend phải cho phép origin này qua `CORS_ORIGINS` và `SOCKET_CORS_ORIGINS`, ví dụ:

```dotenv
CORS_ORIGINS=http://localhost:5174
SOCKET_CORS_ORIGINS=http://localhost:5174
```

## 4. Biến môi trường

| Biến                | Bắt buộc | Mặc định                       | Mô tả             |
| ------------------- | -------- | ------------------------------ | ----------------- |
| `VITE_API_BASE_URL` | Không    | `http://localhost:3000/api/v1` | Base URL REST API |
| `VITE_SOCKET_URL`   | Không    | `http://localhost:3000`        | Origin Socket.IO  |
| `VITE_SOCKET_PATH`  | Không    | `/socket.io`                   | Path Socket.IO    |
| `VITE_APP_NAME`     | Không    | `FUTA Bus Admin`               | Tên ứng dụng      |

Không commit `.env.local` hoặc bất kỳ tệp chứa secret. Access token chỉ lưu trong bộ nhớ; refresh token nằm trong cookie HttpOnly do backend quản lý.

## 5. Tài khoản demo

Seed backend tạo tài khoản quản trị từ `ADMIN_PHONE` / `ADMIN_PASSWORD`. Khi `SEED_DEMO_DATA=true`, seed tạo thêm tài khoản demo; mật khẩu dùng chung `ADMIN_PASSWORD`.

Giá trị mặc định trong `backend/.env.example`:

| Số điện thoại | Vai trò             | Chi nhánh     | Mật khẩu       |
| ------------- | ------------------- | ------------- | -------------- |
| `0900000000`  | `QUAN_TRI_VIEN`     | Toàn hệ thống | `Admin@123456` |
| `0901000003`  | `QUAN_LY_CHI_NHANH` | `PV_MIEN_TAY` | `Admin@123456` |
| `0901000001`  | `TAI_XE`            | `PV_MIEN_TAY` | `Admin@123456` |
| `0901000002`  | `TAI_XE`            | `PV_DA_LAT`   | `Admin@123456` |

Lưu ý:

- Chỉ `QUAN_TRI_VIEN`, `QUAN_LY_CHI_NHANH`, `DIEU_HANH`, `NHAN_VIEN_PHONG_VE` được vào Web Admin.
- Seed mặc định không tạo sẵn `DIEU_HANH` và `NHAN_VIEN_PHONG_VE`; dùng tài khoản quản trị để tạo trong mục **Tài khoản**.
- Thay toàn bộ mật khẩu demo trước khi triển khai ngoài môi trường local.

## 6. Kiến trúc

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
      feedback/           # Loading, 403, 404, placeholder
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
      socket.ts           # Socket.IO client, join/hold/release/extend
    styles/global.css
    types/                # DTO TypeScript theo miền nghiệp vụ
  tests/
    setup.ts              # Polyfill jsdom cho Ant Design
    test-utils.tsx        # Provider test dùng chung
```

Quy ước chính:

- Component không gọi Axios trực tiếp; dùng endpoint client + hook TanStack Query.
- Query key khai báo tại `src/api/query-keys.ts`.
- Tiền và BIGINT nhận dạng string, định dạng bằng `src/lib/format.ts`.
- Thời gian backend là UTC, UI hiển thị GMT+7.
- Route bảo vệ bằng `AuthGuard` và `RoleGuard`; menu lọc theo vai trò.
- Mỗi trang là một lazy chunk, giảm bundle tải ban đầu.

## 7. Chức năng và phân quyền

| Route            | Chức năng              | ADMIN | QLCN  | ĐIỀU HÀNH | NVPV  |
| ---------------- | ---------------------- | ----- | ----- | --------- | ----- |
| `/dashboard`     | KPI, biểu đồ doanh thu | Có    | Có    | Có        | Không |
| `/branches`      | Chi nhánh              | Có    | Không | Không     | Không |
| `/users`         | Tài khoản              | Có    | Có    | Có        | Không |
| `/vehicle-types` | Loại xe, sơ đồ ghế     | Có    | Có    | Có        | Không |
| `/vehicles`      | Đội xe                 | Có    | Có    | Có        | Không |
| `/routes`        | Tuyến và điểm dừng     | Có    | Có    | Có        | Không |
| `/trips`         | Chuyến xe              | Có    | Có    | Có        | Không |
| `/counter`       | Bán vé tại quầy        | Có    | Có    | Không     | Có    |
| `/orders`        | Tra cứu đơn vé         | Có    | Có    | Có        | Có    |
| `/profile`       | Hồ sơ cá nhân          | Có    | Có    | Có        | Có    |

Quy tắc nghiệp vụ đáng chú ý:

- QLCN và NVPV bị backend giới hạn theo chi nhánh.
- Chỉ ADMIN, QLCN, NVPV được xác nhận thanh toán tiền mặt.
- Phòng vé giữ tối đa 5 ghế mỗi đơn; ghế được giữ qua Socket.IO và tự gia hạn khi còn chọn.
- Thanh toán tiền mặt do nhân viên tạo đơn được ghi nhận đã thanh toán ngay.
- Đơn chờ thanh toán có thể hủy; thao tác hủy/xác nhận đều yêu cầu xác nhận lại.

## 8. Realtime sơ đồ ghế

- Client kết nối Socket.IO kèm access token.
- Khi chọn chuyến: gửi `trip:join`, nhận snapshot sơ đồ ghế.
- Giữ ghế: `seat:hold`; gia hạn: `seat:extend`; nhả ghế: `seat:release`.
- Server phát `seat:held`, `seat:released`, `seat:booked` tới room của chuyến.
- Khi mất kết nối, UI cảnh báo và refetch REST để tránh trạng thái cũ.
- REST vẫn là nguồn xác thực cuối cùng khi tạo đơn.

## 9. Kiểm thử và kiểm tra chất lượng

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Hiện có test cho:

- Định dạng tiền, ngày giờ, số.
- Phân quyền và helper RBAC.
- Chuyển đổi dữ liệu biểu đồ dashboard.
- `OrdersPage`: render danh sách, mở drawer chi tiết, nút thu tiền mặt.
- `CounterPage`: render trạng thái realtime, chọn chuyến, giữ/nhả ghế qua Socket.IO.
- `SeatDesigner` và `SeatMapPreview`: đổi VIP, chuyển tầng, hiển thị hai tầng.

## 10. Tối ưu bundle

`vite.config.ts` áp dụng:

- Route-level code splitting bằng `React.lazy` + `Suspense`.
- `manualChunks` tách `antd` thành 4 nhóm ổn định, tách riêng `antd-icons`, `recharts`, `charts-vendor`, `socket`, `react-vendor`, `query-vendor`, `app-vendor`.
- Cảnh báo `CIRCULAR_CHUNK` của Rollup được bỏ qua vì việc chia nhỏ antd theo module tạo phụ thuộc vòng có chủ đích; không ảnh hưởng runtime.
- Sau tối ưu, mọi chunk đều dưới 500 kB và build không còn cảnh báo kích thước chunk.

## 11. Xử lý sự cố

| Hiện tượng             | Kiểm tra                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| Không đăng nhập được   | Backend chạy đúng port, tài khoản đúng vai trò admin                  |
| Lỗi CORS               | Thêm `http://localhost:5174` vào `CORS_ORIGINS`                       |
| Realtime không kết nối | Kiểm tra `VITE_SOCKET_URL`, `VITE_SOCKET_PATH`, `SOCKET_CORS_ORIGINS` |
| 401 liên tục           | Cookie refresh bị chặn; kiểm tra `COOKIE_SAME_SITE`, domain và HTTPS  |
| Không thấy chi nhánh   | UI gửi `trang_thai_hoat_dong=all`; kiểm tra quyền tài khoản           |
| Ghế không cập nhật     | Kiểm tra Redis/backend socket; dùng nút Làm mới để refetch REST       |
