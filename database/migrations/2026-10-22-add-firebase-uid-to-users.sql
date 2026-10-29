-- Persist verified Firebase identities without changing existing user rows.
-- Run once against the existing ShopNova database before deploying Google login.
ALTER TABLE users
  ADD COLUMN firebase_uid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL
    COMMENT 'UID Firebase đã xác minh; NULL với tài khoản mật khẩu' AFTER password_hash,
  ADD UNIQUE KEY uq_users_firebase_uid (firebase_uid);
