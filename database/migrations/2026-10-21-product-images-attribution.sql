-- Preserve source attribution for Commons images and identify seller-uploaded photos.
-- Run once against the existing ShopNova database before deploying the updated Data API.
ALTER TABLE product_images
  ADD COLUMN source_page_url VARCHAR(1024) NULL COMMENT 'Trang tệp nguồn cần ghi công, NULL nếu do seller tải lên' AFTER sort_order,
  ADD COLUMN author VARCHAR(400) NULL COMMENT 'Tác giả theo metadata tệp hoặc người cung cấp ảnh' AFTER source_page_url,
  ADD COLUMN license_name VARCHAR(100) NULL COMMENT 'Giấy phép nguồn hoặc ảnh do seller cung cấp' AFTER author,
  ADD COLUMN license_url VARCHAR(1024) NULL COMMENT 'Liên kết tới điều khoản giấy phép nguồn' AFTER license_name;
