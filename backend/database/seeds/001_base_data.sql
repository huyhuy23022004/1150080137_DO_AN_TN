-- =============================================================================
-- 001_base_data.sql
-- Seed dữ liệu nền, idempotent: vai trò, chi nhánh, loại xe, sơ đồ ghế,
-- xe, tuyến đường và điểm dừng mẫu.
-- =============================================================================

SET NAMES utf8mb4;

-- 1. Vai trò
INSERT IGNORE INTO `vai_tro` (`ten_vai_tro`, `mo_ta`) VALUES
('QUAN_TRI_VIEN', 'Quản trị viên toàn hệ thống (Super Admin)'),
('QUAN_LY_CHI_NHANH', 'Trưởng chi nhánh văn phòng vé'),
('NHAN_VIEN_PHONG_VE', 'Nhân viên bán vé và xuất hóa đơn tại quầy'),
('DIEU_HANH', 'Điều phối phương tiện và tài xế'),
('TAI_XE', 'Tài xế lái xe kiêm quét QR soát vé'),
('KHACH_HANG', 'Hành khách đặt vé qua Ứng dụng di động');

-- 2. Chi nhánh
INSERT IGNORE INTO `chi_nhanh`
(`ma_dinh_danh`, `ten_chi_nhanh`, `so_dien_thoai`, `dia_chi`, `tinh_thanh`) VALUES
('PV_MIEN_TAY', 'Phòng vé Bến xe Miền Tây', '02838752875', '395 Kinh Dương Vương, An Lạc, Bình Tân', 'TP. Hồ Chí Minh'),
('PV_LE_HONG_PHONG', 'Phòng vé Lê Hồng Phong', '02838323456', '272 Đề Thám, Quận 1', 'TP. Hồ Chí Minh'),
('PV_DA_LAT', 'Chi nhánh Bến xe Liên tỉnh Đà Lạt', '02633585858', '01 Tô Hiến Thành, Phường 3', 'Lâm Đồng');

-- 3. Loại xe & sơ đồ ghế mẫu (Limousine 34 phòng, 2 tầng)
INSERT INTO `loai_xe` (`ten_loai_xe`, `so_tang`, `tong_so_ghe`)
SELECT 'Limousine 34 Phòng', 2, 34
WHERE NOT EXISTS (
    SELECT 1 FROM `loai_xe` WHERE `ten_loai_xe` = 'Limousine 34 Phòng'
);

SET @ma_loai_xe := (
    SELECT `ma_loai_xe` FROM `loai_xe`
    WHERE `ten_loai_xe` = 'Limousine 34 Phòng'
    LIMIT 1
);

-- Ghế tầng 1: A01 -> A17
INSERT IGNORE INTO `so_do_ghe` (`ma_loai_xe`, `ky_hieu_ghe`, `tang`, `hang`, `cot`, `loai_cho`) VALUES
(@ma_loai_xe, 'A01', 1, 1, 1, 'VIP'), (@ma_loai_xe, 'A02', 1, 1, 2, 'VIP'),
(@ma_loai_xe, 'A03', 1, 2, 1, 'THUONG'), (@ma_loai_xe, 'A04', 1, 2, 2, 'THUONG'),
(@ma_loai_xe, 'A05', 1, 3, 1, 'THUONG'), (@ma_loai_xe, 'A06', 1, 3, 2, 'THUONG'),
(@ma_loai_xe, 'A07', 1, 4, 1, 'THUONG'), (@ma_loai_xe, 'A08', 1, 4, 2, 'THUONG'),
(@ma_loai_xe, 'A09', 1, 5, 1, 'THUONG'), (@ma_loai_xe, 'A10', 1, 5, 2, 'THUONG'),
(@ma_loai_xe, 'A11', 1, 6, 1, 'THUONG'), (@ma_loai_xe, 'A12', 1, 6, 2, 'THUONG'),
(@ma_loai_xe, 'A13', 1, 7, 1, 'THUONG'), (@ma_loai_xe, 'A14', 1, 7, 2, 'THUONG'),
(@ma_loai_xe, 'A15', 1, 8, 1, 'THUONG'), (@ma_loai_xe, 'A16', 1, 8, 2, 'THUONG'),
(@ma_loai_xe, 'A17', 1, 9, 1, 'THUONG');

-- Ghế tầng 2: B01 -> B17
INSERT IGNORE INTO `so_do_ghe` (`ma_loai_xe`, `ky_hieu_ghe`, `tang`, `hang`, `cot`, `loai_cho`) VALUES
(@ma_loai_xe, 'B01', 2, 1, 1, 'VIP'), (@ma_loai_xe, 'B02', 2, 1, 2, 'VIP'),
(@ma_loai_xe, 'B03', 2, 2, 1, 'THUONG'), (@ma_loai_xe, 'B04', 2, 2, 2, 'THUONG'),
(@ma_loai_xe, 'B05', 2, 3, 1, 'THUONG'), (@ma_loai_xe, 'B06', 2, 3, 2, 'THUONG'),
(@ma_loai_xe, 'B07', 2, 4, 1, 'THUONG'), (@ma_loai_xe, 'B08', 2, 4, 2, 'THUONG'),
(@ma_loai_xe, 'B09', 2, 5, 1, 'THUONG'), (@ma_loai_xe, 'B10', 2, 5, 2, 'THUONG'),
(@ma_loai_xe, 'B11', 2, 6, 1, 'THUONG'), (@ma_loai_xe, 'B12', 2, 6, 2, 'THUONG'),
(@ma_loai_xe, 'B13', 2, 7, 1, 'THUONG'), (@ma_loai_xe, 'B14', 2, 7, 2, 'THUONG'),
(@ma_loai_xe, 'B15', 2, 8, 1, 'THUONG'), (@ma_loai_xe, 'B16', 2, 8, 2, 'THUONG'),
(@ma_loai_xe, 'B17', 2, 9, 1, 'THUONG');

-- 4. Xe cụ thể
INSERT IGNORE INTO `xe` (`ma_loai_xe`, `bien_so_xe`, `hang_san_xuat`, `trang_thai`) VALUES
(@ma_loai_xe, '51B-289.45', 'Thaco Universe', 'HOAT_DONG'),
(@ma_loai_xe, '51B-312.88', 'Hyundai Universe', 'HOAT_DONG');

-- 5. Tuyến đường Sài Gòn - Đà Lạt
INSERT INTO `tuyen_duong`
(`ten_tuyen`, `tinh_di`, `tinh_den`, `khoang_cach_km`, `thoi_gian_chay_du_kien`)
SELECT 'Sài Gòn - Đà Lạt', 'TP. Hồ Chí Minh', 'Lâm Đồng', 305.00, 390
WHERE NOT EXISTS (
    SELECT 1 FROM `tuyen_duong` WHERE `ten_tuyen` = 'Sài Gòn - Đà Lạt'
);

SET @ma_tuyen := (
    SELECT `ma_tuyen` FROM `tuyen_duong`
    WHERE `ten_tuyen` = 'Sài Gòn - Đà Lạt'
    LIMIT 1
);

-- 6. Điểm dừng
INSERT INTO `diem_dung` (`ma_tuyen`, `ten_diem_dung`, `dia_chi`, `loai_diem`, `thu_tu_dung`)
SELECT @ma_tuyen, 'Bến xe Miền Tây', '395 Kinh Dương Vương, An Lạc, Bình Tân', 'DON', 1
WHERE NOT EXISTS (
    SELECT 1 FROM `diem_dung` WHERE `ma_tuyen` = @ma_tuyen AND `ten_diem_dung` = 'Bến xe Miền Tây'
);

INSERT INTO `diem_dung` (`ma_tuyen`, `ten_diem_dung`, `dia_chi`, `loai_diem`, `thu_tu_dung`)
SELECT @ma_tuyen, 'Trạm Hàng Xanh', 'Điện Biên Phủ, Phường 21, Bình Thạnh', 'DON', 2
WHERE NOT EXISTS (
    SELECT 1 FROM `diem_dung` WHERE `ma_tuyen` = @ma_tuyen AND `ten_diem_dung` = 'Trạm Hàng Xanh'
);

INSERT INTO `diem_dung` (`ma_tuyen`, `ten_diem_dung`, `dia_chi`, `loai_diem`, `thu_tu_dung`)
SELECT @ma_tuyen, 'Trạm dừng chân Madagui', 'Đạ Huoai, Lâm Đồng', 'TRUNG_CHUYEN', 3
WHERE NOT EXISTS (
    SELECT 1 FROM `diem_dung` WHERE `ma_tuyen` = @ma_tuyen AND `ten_diem_dung` = 'Trạm dừng chân Madagui'
);

INSERT INTO `diem_dung` (`ma_tuyen`, `ten_diem_dung`, `dia_chi`, `loai_diem`, `thu_tu_dung`)
SELECT @ma_tuyen, 'Bến xe Liên tỉnh Đà Lạt', '01 Tô Hiến Thành, Phường 3, Đà Lạt', 'TRA', 4
WHERE NOT EXISTS (
    SELECT 1 FROM `diem_dung` WHERE `ma_tuyen` = @ma_tuyen AND `ten_diem_dung` = 'Bến xe Liên tỉnh Đà Lạt'
);
