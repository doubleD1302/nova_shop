-- Preflight: resolve any returned duplicate phone numbers before applying this index.
SELECT phone, COUNT(*) AS account_count
FROM users
WHERE phone IS NOT NULL AND phone <> ''
GROUP BY phone
HAVING COUNT(*) > 1;

-- Phone is optional; MySQL permits multiple NULL values in this unique index.
ALTER TABLE users ADD UNIQUE KEY uq_users_phone (phone);
