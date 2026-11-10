import { executeQuery, closeDatabase } from '../data-api/src/config/database.js';
import bcrypt from '../data-api/node_modules/bcryptjs/index.js';

async function run() {
  try {
    const users = await executeQuery('SELECT id, username, password_hash, role FROM users');
    for (const u of users) {
      const passDemoAdmin = await bcrypt.compare('DemoAdmin2026', u.password_hash);
      const passAdmin123 = await bcrypt.compare('Admin@123', u.password_hash);
      const passDemoSeller = await bcrypt.compare('DemoSeller2026', u.password_hash);
      const passSeller123 = await bcrypt.compare('Seller@123', u.password_hash);
      console.log(u.id, u.username, u.role, {
        passDemoAdmin, passAdmin123, passDemoSeller, passSeller123
      });
    }
  } catch(e) {
    console.error('DB ERROR:', e.message);
  } finally {
    await closeDatabase();
  }
}
run();
