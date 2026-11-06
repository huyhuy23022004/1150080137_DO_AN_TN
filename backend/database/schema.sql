-- =============================================================================
-- HỆ THỐNG QUẢN LÝ ĐẶT VÉ XE TRỰC TUYẾN (CHUẨN FUTA BUS)
-- Cơ sở dữ liệu: MySQL 8.0 (Bảng mã: utf8mb4_unicode_ci)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `quan_ly_ve_xe` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `quan_ly_ve_xe`;

-- Tắt kiểm tra khóa ngoại để khởi tạo bảng thuận tiện
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. PHÂN HỆ CHI NHÁNH, PHÂN QUYỀN & NGƯỜI DÙNG
-- -----------------------------------------------------------------------------

-- Bảng vai_tro: Quản lý danh mục quyền hạn
DROP TABLE IF EXISTS `vai_tro`;
CREATE TABLE `vai_tro` (
    `ma_vai_tro` INT AUTO_INCREMENT PRIMARY KEY,
    `ten_vai_tro` VARCHAR(50) NOT NULL UNIQUE COMMENT 'QUAN_TRI_VIEN, QUAN_LY_CHI_NHANH, NHAN_VIEN_PHONG_VE, DIEU_HANH, TAI_XE, KHACH_HANG',
    `mo_ta` VARCHAR(255) NULL
) ENGINE=InnoDB COMMENT='Bảng phân quyền người dùng';

-- Bảng chi_nhanh: Văn phòng đại diện, bến bãi theo các tỉnh thành
DROP TABLE IF EXISTS `chi_nhanh`;
CREATE TABLE `chi_nhanh` (
    `ma_chi_nhanh` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_dinh_danh` VARCHAR(20) NOT NULL UNIQUE COMMENT 'Ví dụ: PV_MIEN_DONG, PV_DA_LAT',
    `ten_chi_nhanh` VARCHAR(150) NOT NULL,
    `so_dien_thoai` VARCHAR(15) NOT NULL,
    `dia_chi` VARCHAR(255) NOT NULL,
    `tinh_thanh` VARCHAR(100) NOT NULL,
    `trang_thai_hoat_dong` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Danh sách phòng vé và chi nhánh trực thuộc';

-- Bảng nguoi_dung: Tài khoản toàn hệ thống
DROP TABLE IF EXISTS `nguoi_dung`;
CREATE TABLE `nguoi_dung` (
    `ma_nguoi_dung` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ma_vai_tro` INT NOT NULL,
    `ma_chi_nhanh` INT NULL COMMENT 'NULL nếu là Quản trị viên cấp cao hoặc Khách hàng',
    `ho_va_ten` VARCHAR(100) NOT NULL,
    `so_dien_thoai` VARCHAR(15) NOT NULL UNIQUE,
    `email` VARCHAR(100) NULL UNIQUE,
    `mat_khau_ma_hoa` VARCHAR(255) NOT NULL COMMENT 'Mật khẩu băm BCrypt',
    `trang_thai_tai_khoan` VARCHAR(20) DEFAULT 'HOAT_DONG' COMMENT 'HOAT_DONG, KHOA',
    `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_nguoidung_vaitro` FOREIGN KEY (`ma_vai_tro`) REFERENCES `vai_tro` (`ma_vai_tro`),
    CONSTRAINT `fk_nguoidung_chinhanh` FOREIGN KEY (`ma_chi_nhanh`) REFERENCES `chi_nhanh` (`ma_chi_nhanh`) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Tài khoản người dùng và nhân viên toàn chuỗi';

-- -----------------------------------------------------------------------------
-- 2. PHÂN HỆ ĐỘI XE & CẤU HÌNH SƠ ĐỒ GHẾ
-- -----------------------------------------------------------------------------

-- Bảng loai_xe: Danh mục cấu hình mẫu xe
DROP TABLE IF EXISTS `loai_xe`;
CREATE TABLE `loai_xe` (
    `ma_loai_xe` INT AUTO_INCREMENT PRIMARY KEY,
    `ten_loai_xe` VARCHAR(100) NOT NULL COMMENT 'Ví dụ: Limousine 34 phòng, Giường nằm 40 chỗ, Ghế ngồi 29 chỗ',
    `so_tang` INT DEFAULT 2 COMMENT '1: Một tầng, 2: Hai tầng',
    `tong_so_ghe` INT NOT NULL
) ENGINE=InnoDB COMMENT='Danh mục cấu hình mẫu xe';

-- Bảng xe: Phương tiện vật lý cụ thể
DROP TABLE IF EXISTS `xe`;
CREATE TABLE `xe` (
    `ma_xe` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_loai_xe` INT NOT NULL,
    `bien_so_xe` VARCHAR(20) NOT NULL UNIQUE,
    `hang_san_xuat` VARCHAR(50) NULL,
    `trang_thai` VARCHAR(30) DEFAULT 'HOAT_DONG' COMMENT 'HOAT_DONG, BAO_DUONG, DANG_CHAY',
    CONSTRAINT `fk_xe_loaixe` FOREIGN KEY (`ma_loai_xe`) REFERENCES `loai_xe` (`ma_loai_xe`)
) ENGINE=InnoDB COMMENT='Danh sách phương tiện xe thực tế';

-- Bảng so_do_ghe: Định vị tọa độ ghế theo loại xe
DROP TABLE IF EXISTS `so_do_ghe`;
CREATE TABLE `so_do_ghe` (
    `ma_ghe` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_loai_xe` INT NOT NULL,
    `ky_hieu_ghe` VARCHAR(10) NOT NULL COMMENT 'Ví dụ: A01, A02 (Tầng dưới) - B01, B02 (Tầng trên)',
    `tang` INT NOT NULL DEFAULT 1 COMMENT '1: Tầng 1, 2: Tầng 2',
    `hang` INT NOT NULL,
    `cot` INT NOT NULL,
    `loai_cho` VARCHAR(20) DEFAULT 'THUONG' COMMENT 'THUONG, VIP',
    UNIQUE KEY `uk_loai_xe_ky_hieu` (`ma_loai_xe`, `ky_hieu_ghe`),
    CONSTRAINT `fk_sodoghe_loaixe` FOREIGN KEY (`ma_loai_xe`) REFERENCES `loai_xe` (`ma_loai_xe`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Cấu hình tọa độ sơ đồ ghế theo loại xe';

-- -----------------------------------------------------------------------------
-- 3. PHÂN HỆ TUYẾN ĐƯỜNG, ĐIỂM ĐÓN TRẢ & LỊCH TRÌNH CHUYẾN XE
-- -----------------------------------------------------------------------------

-- Bảng tuyen_duong: Lộ trình liên tỉnh
DROP TABLE IF EXISTS `tuyen_duong`;
CREATE TABLE `tuyen_duong` (
    `ma_tuyen` INT AUTO_INCREMENT PRIMARY KEY,
    `ten_tuyen` VARCHAR(150) NOT NULL COMMENT 'Ví dụ: Sài Gòn - Đà Lạt',
    `tinh_di` VARCHAR(100) NOT NULL,
    `tinh_den` VARCHAR(100) NOT NULL,
    `khoang_cach_km` DECIMAL(6,2) NOT NULL,
    `thoi_gian_chay_du_kien` INT NOT NULL COMMENT 'Tính theo phút',
    `trang_thai` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Tuyến đường xe chạy';

-- Bảng diem_dung: Các trạm đón/trả và trung chuyển dọc tuyến
DROP TABLE IF EXISTS `diem_dung`;
CREATE TABLE `diem_dung` (
    `ma_diem_dung` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_tuyen` INT NOT NULL,
    `ten_diem_dung` VARCHAR(150) NOT NULL COMMENT 'Ví dụ: Bến xe Miền Tây, Ngã tư Hàng Xanh, Bến xe Đà Lạt',
    `dia_chi` VARCHAR(255) NULL,
    `loai_diem` VARCHAR(20) NOT NULL COMMENT 'DON, TRA, TRUNG_CHUYEN',
    `thu_tu_dung` INT NOT NULL,
    CONSTRAINT `fk_diemdung_tuyen` FOREIGN KEY (`ma_tuyen`) REFERENCES `tuyen_duong` (`ma_tuyen`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Các điểm đón, trả và trung chuyển dọc hành trình';

-- Bảng chuyen_xe: Lịch khởi hành cụ thể
DROP TABLE IF EXISTS `chuyen_xe`;
CREATE TABLE `chuyen_xe` (
    `ma_chuyen` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ma_tuyen` INT NOT NULL,
    `ma_xe` INT NOT NULL,
    `ma_tai_xe` BIGINT NOT NULL,
    `thoi_gian_xuat_ben` DATETIME NOT NULL,
    `thoi_gian_den_du_kien` DATETIME NOT NULL,
    `gia_ve_co_ban` DECIMAL(12,2) NOT NULL,
    `trang_thai` VARCHAR(30) DEFAULT 'SAP_CHAY' COMMENT 'SAP_CHAY, DANG_CHAY, HOAN_THANH, HUY',
    CONSTRAINT `fk_chuyenxe_tuyen` FOREIGN KEY (`ma_tuyen`) REFERENCES `tuyen_duong` (`ma_tuyen`),
    CONSTRAINT `fk_chuyenxe_xe` FOREIGN KEY (`ma_xe`) REFERENCES `xe` (`ma_xe`),
    CONSTRAINT `fk_chuyenxe_taixe` FOREIGN KEY (`ma_tai_xe`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`)
) ENGINE=InnoDB COMMENT='Lịch trình chuyến xe xuất bến';

-- -----------------------------------------------------------------------------
-- 4. PHÂN HỆ ĐẶT VÉ, VÉ ĐIỆN TỬ & THANH TOÁN
-- -----------------------------------------------------------------------------

-- Bảng don_dat_ve: Đơn hàng tổng thể
DROP TABLE IF EXISTS `don_dat_ve`;
CREATE TABLE `don_dat_ve` (
    `ma_don_ve` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ma_dinh_danh_don` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Mã hóa đơn hiển thị (Ví dụ: FUTA26081001)',
    `ma_khach_hang` BIGINT NULL COMMENT 'Khóa ngoại nếu khách có tài khoản',
    `ho_ten_khach` VARCHAR(100) NOT NULL,
    `so_dien_thoai_khach` VARCHAR(15) NOT NULL,
    `email_khach` VARCHAR(100) NULL,
    `ma_nhan_vien_ban` BIGINT NULL COMMENT 'NULL nếu khách đặt qua App; có giá trị nếu nhân viên quầy xuất vé',
    `ma_chi_nhanh_ban` INT NULL COMMENT 'Ghi nhận chi nhánh bán vé phục vụ tính doanh thu quầy',
    `ma_diem_don` INT NOT NULL,
    `ma_diem_tra` INT NOT NULL,
    `tong_tien` DECIMAL(12,2) NOT NULL,
    `trang_thai_don` VARCHAR(30) DEFAULT 'CHO_THANH_TOAN' COMMENT 'CHO_THANH_TOAN, DA_THANH_TOAN, DA_HUY',
    `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_dondatve_khachhang` FOREIGN KEY (`ma_khach_hang`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`) ON DELETE SET NULL,
    CONSTRAINT `fk_dondatve_nhanvien` FOREIGN KEY (`ma_nhan_vien_ban`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`) ON DELETE SET NULL,
    CONSTRAINT `fk_dondatve_chinhanh` FOREIGN KEY (`ma_chi_nhanh_ban`) REFERENCES `chi_nhanh` (`ma_chi_nhanh`) ON DELETE SET NULL,
    CONSTRAINT `fk_dondatve_diemdon` FOREIGN KEY (`ma_diem_don`) REFERENCES `diem_dung` (`ma_diem_dung`),
    CONSTRAINT `fk_dondatve_diemtra` FOREIGN KEY (`ma_diem_tra`) REFERENCES `diem_dung` (`ma_diem_dung`)
) ENGINE=InnoDB COMMENT='Đơn đặt vé tổng thể';

-- Bảng chi_tiet_ve: Chi tiết từng chỗ ngồi và mã QR soát vé
DROP TABLE IF EXISTS `chi_tiet_ve`;
CREATE TABLE `chi_tiet_ve` (
    `ma_ve` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ma_don_ve` BIGINT NOT NULL,
    `ma_chuyen` BIGINT NOT NULL,
    `ma_ghe` INT NOT NULL,
    `ky_hieu_ghe` VARCHAR(10) NOT NULL,
    `gia_ve` DECIMAL(12,2) NOT NULL,
    `ma_qr_kiem_tra` VARCHAR(255) NOT NULL UNIQUE COMMENT 'Chuỗi mã hóa định danh để tài xế quét soát vé',
    `trang_thai_soat_ve` VARCHAR(30) DEFAULT 'CHUA_LEN_XE' COMMENT 'CHUA_LEN_XE, DA_LEN_XE',
    `thoi_gian_soat_ve` DATETIME NULL,
    `tai_xe_soat_ve` BIGINT NULL,
    UNIQUE KEY `uk_chuyen_ghe` (`ma_chuyen`, `ma_ghe`),
    CONSTRAINT `fk_chitietve_don` FOREIGN KEY (`ma_don_ve`) REFERENCES `don_dat_ve` (`ma_don_ve`) ON DELETE CASCADE,
    CONSTRAINT `fk_chitietve_chuyen` FOREIGN KEY (`ma_chuyen`) REFERENCES `chuyen_xe` (`ma_chuyen`),
    CONSTRAINT `fk_chitietve_ghe` FOREIGN KEY (`ma_ghe`) REFERENCES `so_do_ghe` (`ma_ghe`),
    CONSTRAINT `fk_chitietve_taixe` FOREIGN KEY (`tai_xe_soat_ve`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Chi tiết vé từng ghế và thông tin soát vé QR';

-- Bảng thanh_toan: Nhật ký giao dịch tài chính
DROP TABLE IF EXISTS `thanh_toan`;
CREATE TABLE `thanh_toan` (
    `ma_thanh_toan` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ma_don_ve` BIGINT NOT NULL,
    `phuong_thuc` VARCHAR(30) NOT NULL COMMENT 'VNPAY, TIEN_MAT',
    `ma_giao_dich_vnpay` VARCHAR(100) NULL,
    `so_tien` DECIMAL(12,2) NOT NULL,
    `trang_thai` VARCHAR(30) NOT NULL COMMENT 'THANH_CONG, THAT_BAI, CHO_XU_LY',
    `thong_tin_phan_hoi` TEXT NULL,
    `thoi_gian_thanh_toan` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_thanhtoan_don` FOREIGN KEY (`ma_don_ve`) REFERENCES `don_dat_ve` (`ma_don_ve`)
) ENGINE=InnoDB COMMENT='Nhật ký thanh toán đơn vé';

-- -----------------------------------------------------------------------------
-- 5. PHÂN HỆ KHÓA GHẾ TẠM THỜI (HỖ TRỢ SOCKET.IO & DỰ PHÒNG REDIS)
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS `giu_cho_tam_thoi`;
CREATE TABLE `giu_cho_tam_thoi` (
    `ma_chuyen` BIGINT NOT NULL,
    `ky_hieu_ghe` VARCHAR(10) NOT NULL,
    `ma_nguoi_dung` VARCHAR(50) NOT NULL COMMENT 'ID khách hoặc socket.id nếu là khách vãng lai',
    `thoi_gian_het_han` DATETIME NOT NULL,
    `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`ma_chuyen`, `ky_hieu_ghe`)
) ENGINE=InnoDB COMMENT='Bảng đồng bộ giữ ghế thời gian thực (Dự phòng cho Redis)';

-- Bật lại kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 6. TỐI ƯU HÓA CHỈ MỤC (INDEXES)
-- -----------------------------------------------------------------------------
CREATE INDEX `idx_nguoidung_sdt` ON `nguoi_dung` (`so_dien_thoai`);
CREATE INDEX `idx_chuyenxe_thoigian` ON `chuyen_xe` (`thoi_gian_xuat_ben`, `trang_thai`);
CREATE INDEX `idx_chitietve_chuyen` ON `chi_tiet_ve` (`ma_chuyen`);
CREATE INDEX `idx_dondatve_madinhdanh` ON `don_dat_ve` (`ma_dinh_danh_don`);
CREATE INDEX `idx_giuchotamthoi_hethan` ON `giu_cho_tam_thoi` (`thoi_gian_het_han`);

-- -----------------------------------------------------------------------------
-- 7. BỘ DỮ LIỆU KHỞI TẠO BAN ĐẦU (SEED DATA MẪU)
-- -----------------------------------------------------------------------------

-- 7.1. Chèn vai trò
INSERT INTO `vai_tro` (`ten_vai_tro`, `mo_ta`) VALUES
('QUAN_TRI_VIEN', 'Quản trị viên toàn hệ thống (Super Admin)'),
('QUAN_LY_CHI_NHANH', 'Trưởng chi nhánh văn phòng vé'),
('NHAN_VIEN_PHONG_VE', 'Nhân viên bán vé và xuất hóa đơn tại quầy'),
('DIEU_HANH', 'Điều phối phương tiện và tài xế'),
('TAI_XE', 'Tài xế lái xe kiêm quét QR soát vé'),
('KHACH_HANG', 'Hành khách đặt vé qua Ứng dụng di động');

-- 7.2. Chèn chi nhánh
INSERT INTO `chi_nhanh` (`ma_dinh_danh`, `ten_chi_nhanh`, `so_dien_thoai`, `dia_chi`, `tinh_thanh`) VALUES
('PV_MIEN_TAY', 'Phòng vé Bến xe Miền Tây', '02838752875', '395 Kinh Dương Vương, An Lạc, Bình Tân', 'TP. Hồ Chí Minh'),
('PV_LE_HONG_PHONG', 'Phòng vé Lê Hồng Phong', '02838323456', '272 Đề Thám, Quận 1', 'TP. Hồ Chí Minh'),
('PV_DA_LAT', 'Chi nhánh Bến xe Liên tỉnh Đà Lạt', '02633585858', '01 Tô Hiến Thành, Phường 3', 'Lâm Đồng');

-- 7.3. Chèn loại xe & Sơ đồ ghế mẫu (Limousine 34 phòng 2 tầng)
INSERT INTO `loai_xe` (`ten_loai_xe`, `so_tang`, `tong_so_ghe`) VALUES
('Limousine 34 Phòng', 2, 34);

-- Ghế Tầng 1 (A01 -> A17)
INSERT INTO `so_do_ghe` (`ma_loai_xe`, `ky_hieu_ghe`, `tang`, `hang`, `cot`, `loai_cho`) VALUES
(1, 'A01', 1, 1, 1, 'VIP'), (1, 'A02', 1, 1, 2, 'VIP'), (1, 'A03', 1, 2, 1, 'THUONG'), (1, 'A04', 1, 2, 2, 'THUONG'),
(1, 'A05', 1, 3, 1, 'THUONG'), (1, 'A06', 1, 3, 2, 'THUONG'), (1, 'A07', 1, 4, 1, 'THUONG'), (1, 'A08', 1, 4, 2, 'THUONG'),
(1, 'A09', 1, 5, 1, 'THUONG'), (1, 'A10', 1, 5, 2, 'THUONG'), (1, 'A11', 1, 6, 1, 'THUONG'), (1, 'A12', 1, 6, 2, 'THUONG'),
(1, 'A13', 1, 7, 1, 'THUONG'), (1, 'A14', 1, 7, 2, 'THUONG'), (1, 'A15', 1, 8, 1, 'THUONG'), (1, 'A16', 1, 8, 2, 'THUONG'),
(1, 'A17', 1, 9, 1, 'THUONG');

-- Ghế Tầng 2 (B01 -> B17)
INSERT INTO `so_do_ghe` (`ma_loai_xe`, `ky_hieu_ghe`, `tang`, `hang`, `cot`, `loai_cho`) VALUES
(1, 'B01', 2, 1, 1, 'VIP'), (1, 'B02', 2, 1, 2, 'VIP'), (1, 'B03', 2, 2, 1, 'THUONG'), (1, 'B04', 2, 2, 2, 'THUONG'),
(1, 'B05', 2, 3, 1, 'THUONG'), (1, 'B06', 2, 3, 2, 'THUONG'), (1, 'B07', 2, 4, 1, 'THUONG'), (1, 'B08', 2, 4, 2, 'THUONG'),
(1, 'B09', 2, 5, 1, 'THUONG'), (1, 'B10', 2, 5, 2, 'THUONG'), (1, 'B11', 2, 6, 1, 'THUONG'), (1, 'B12', 2, 6, 2, 'THUONG'),
(1, 'B13', 2, 7, 1, 'THUONG'), (1, 'B14', 2, 7, 2, 'THUONG'), (1, 'B15', 2, 8, 1, 'THUONG'), (1, 'B16', 2, 8, 2, 'THUONG'),
(1, 'B17', 2, 9, 1, 'THUONG');

-- 7.4. Chèn xe cụ thể
INSERT INTO `xe` (`ma_loai_xe`, `bien_so_xe`, `hang_san_xuat`, `trang_thai`) VALUES
(1, '51B-289.45', 'Thaco Universe', 'HOAT_DONG'),
(1, '51B-312.88', 'Hyundai Universe', 'HOAT_DONG');

-- 7.5. Chèn tuyến đường & Điểm dừng (Sài Gòn - Đà Lạt)
INSERT INTO `tuyen_duong` (`ten_tuyen`, `tinh_di`, `tinh_den`, `khoang_cach_km`, `thoi_gian_chay_du_kien`) VALUES
('Sài Gòn - Đà Lạt', 'TP. Hồ Chí Minh', 'Lâm Đồng', 305.00, 390);

INSERT INTO `diem_dung` (`ma_tuyen`, `ten_diem_dung`, `dia_chi`, `loai_diem`, `thu_tu_dung`) VALUES
(1, 'Bến xe Miền Tây', '395 Kinh Dương Vương, An Lạc, Bình Tân', 'DON', 1),
(1, 'Trạm Hàng Xanh', 'Điện Biên Phủ, Phường 21, Bình Thạnh', 'DON', 2),
(1, 'Trạm dừng chân Madagui', 'Đạ Huoai, Lâm Đồng', 'TRUNG_CHUYEN', 3),
(1, 'Bến xe Liên tỉnh Đà Lạt', '01 Tô Hiến Thành, Phường 3, Đà Lạt', 'TRA', 4);