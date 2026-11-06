-- =============================================================================
-- 002_optional_constraints.sql
-- Bổ sung theo quyết định kiến trúc:
--   - Hủy vé mềm bằng trang_thai_ve, giải phóng ghế qua generated column.
--   - Chống trùng giao dịch VNPAY.
--   - Index phục vụ IPN, job hết hạn đơn và tra cứu chuyến.
-- =============================================================================

ALTER TABLE `chi_tiet_ve`
    ADD COLUMN `trang_thai_ve` VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC'
    COMMENT 'HIEU_LUC, DA_HUY' AFTER `trang_thai_soat_ve`;

ALTER TABLE `chi_tiet_ve`
    ADD COLUMN `ma_ghe_hieu_luc` INT
    GENERATED ALWAYS AS (
        CASE WHEN `trang_thai_ve` = 'HIEU_LUC' THEN `ma_ghe` ELSE NULL END
    ) STORED
    COMMENT 'NULL khi vé đã hủy để giải phóng unique ghế';

ALTER TABLE `chi_tiet_ve`
    DROP INDEX `uk_chuyen_ghe`;

ALTER TABLE `chi_tiet_ve`
    ADD UNIQUE KEY `uk_chuyen_ghe_hieu_luc` (`ma_chuyen`, `ma_ghe_hieu_luc`);

ALTER TABLE `chi_tiet_ve`
    ADD INDEX `idx_chitietve_ghe` (`ma_ghe`);

ALTER TABLE `thanh_toan`
    ADD UNIQUE KEY `uk_thanhtoan_vnpay` (`ma_giao_dich_vnpay`);

ALTER TABLE `thanh_toan`
    ADD INDEX `idx_thanhtoan_don_trangthai` (`ma_don_ve`, `trang_thai`);

ALTER TABLE `don_dat_ve`
    ADD INDEX `idx_dondatve_trangthai_thoigian` (`trang_thai_don`, `thoi_gian_tao`);

ALTER TABLE `chuyen_xe`
    ADD INDEX `idx_chuyenxe_tuyen_thoigian` (`ma_tuyen`, `thoi_gian_xuat_ben`);
