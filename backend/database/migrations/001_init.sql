-- =============================================================================
-- 001_init.sql
-- Khởi tạo 13 bảng gốc cho hệ thống đặt vé xe FUTA Bus.
-- Nguồn: database/schema.sql (đã tách phần DDL, không bao gồm seed).
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. PHÂN HỆ CHI NHÁNH, PHÂN QUYỀN & NGƯỜI DÙNG
-- -----------------------------------------------------------------------------

CREATE TABLE `vai_tro` (
    `ma_vai_tro` INT AUTO_INCREMENT PRIMARY KEY,
    `ten_vai_tro` VARCHAR(50) NOT NULL UNIQUE COMMENT 'QUAN_TRI_VIEN, QUAN_LY_CHI_NHANH, NHAN_VIEN_PHONG_VE, DIEU_HANH, TAI_XE, KHACH_HANG',
    `mo_ta` VARCHAR(255) NULL
) ENGINE=InnoDB COMMENT='Bảng phân quyền người dùng';

CREATE TABLE `chi_nhanh` (
    `ma_chi_nhanh` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_dinh_danh` VARCHAR(20) NOT NULL UNIQUE COMMENT 'Ví dụ: PV_MIEN_DONG, PV_DA_LAT',
    `ten_chi_nhanh` VARCHAR(150) NOT NULL,
    `so_dien_thoai` VARCHAR(15) NOT NULL,
    `dia_chi` VARCHAR(255) NOT NULL,
    `tinh_thanh` VARCHAR(100) NOT NULL,
    `trang_thai_hoat_dong` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Danh sách phòng vé và chi nhánh trực thuộc';

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

CREATE TABLE `loai_xe` (
    `ma_loai_xe` INT AUTO_INCREMENT PRIMARY KEY,
    `ten_loai_xe` VARCHAR(100) NOT NULL COMMENT 'Ví dụ: Limousine 34 phòng, Giường nằm 40 chỗ, Ghế ngồi 29 chỗ',
    `so_tang` INT DEFAULT 2 COMMENT '1: Một tầng, 2: Hai tầng',
    `tong_so_ghe` INT NOT NULL
) ENGINE=InnoDB COMMENT='Danh mục cấu hình mẫu xe';

CREATE TABLE `xe` (
    `ma_xe` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_loai_xe` INT NOT NULL,
    `bien_so_xe` VARCHAR(20) NOT NULL UNIQUE,
    `hang_san_xuat` VARCHAR(50) NULL,
    `trang_thai` VARCHAR(30) DEFAULT 'HOAT_DONG' COMMENT 'HOAT_DONG, BAO_DUONG, DANG_CHAY',
    CONSTRAINT `fk_xe_loaixe` FOREIGN KEY (`ma_loai_xe`) REFERENCES `loai_xe` (`ma_loai_xe`)
) ENGINE=InnoDB COMMENT='Danh sách phương tiện xe thực tế';

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

CREATE TABLE `tuyen_duong` (
    `ma_tuyen` INT AUTO_INCREMENT PRIMARY KEY,
    `ten_tuyen` VARCHAR(150) NOT NULL COMMENT 'Ví dụ: Sài Gòn - Đà Lạt',
    `tinh_di` VARCHAR(100) NOT NULL,
    `tinh_den` VARCHAR(100) NOT NULL,
    `khoang_cach_km` DECIMAL(6,2) NOT NULL,
    `thoi_gian_chay_du_kien` INT NOT NULL COMMENT 'Tính theo phút',
    `trang_thai` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Tuyến đường xe chạy';

CREATE TABLE `diem_dung` (
    `ma_diem_dung` INT AUTO_INCREMENT PRIMARY KEY,
    `ma_tuyen` INT NOT NULL,
    `ten_diem_dung` VARCHAR(150) NOT NULL COMMENT 'Ví dụ: Bến xe Miền Tây, Ngã tư Hàng Xanh, Bến xe Đà Lạt',
    `dia_chi` VARCHAR(255) NULL,
    `loai_diem` VARCHAR(20) NOT NULL COMMENT 'DON, TRA, TRUNG_CHUYEN',
    `thu_tu_dung` INT NOT NULL,
    CONSTRAINT `fk_diemdung_tuyen` FOREIGN KEY (`ma_tuyen`) REFERENCES `tuyen_duong` (`ma_tuyen`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Các điểm đón, trả và trung chuyển dọc hành trình';

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
-- 5. PHÂN HỆ KHÓA GHẾ TẠM THỜI
-- -----------------------------------------------------------------------------

CREATE TABLE `giu_cho_tam_thoi` (
    `ma_chuyen` BIGINT NOT NULL,
    `ky_hieu_ghe` VARCHAR(10) NOT NULL,
    `ma_nguoi_dung` VARCHAR(50) NOT NULL COMMENT 'owner_ref hoặc socket.id nếu khách vãng lai',
    `thoi_gian_het_han` DATETIME NOT NULL,
    `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`ma_chuyen`, `ky_hieu_ghe`)
) ENGINE=InnoDB COMMENT='Bảng đồng bộ giữ ghế thời gian thực (Dự phòng cho Redis)';

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 6. TỐI ƯU HÓA CHỈ MỤC (INDEXES)
-- -----------------------------------------------------------------------------

CREATE INDEX `idx_nguoidung_sdt` ON `nguoi_dung` (`so_dien_thoai`);
CREATE INDEX `idx_chuyenxe_thoigian` ON `chuyen_xe` (`thoi_gian_xuat_ben`, `trang_thai`);
CREATE INDEX `idx_chitietve_chuyen` ON `chi_tiet_ve` (`ma_chuyen`);
CREATE INDEX `idx_dondatve_madinhdanh` ON `don_dat_ve` (`ma_dinh_danh_don`);
CREATE INDEX `idx_giuchotamthoi_hethan` ON `giu_cho_tam_thoi` (`thoi_gian_het_han`);
