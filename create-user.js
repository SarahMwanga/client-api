import pg from 'pg';
import bcrypt from 'bcryptjs';

const [email, password, role = 'viewer'] = process.argv.slice(2);
if (!email || !password || !['admin', 'viewer'].includes(role)) {
  console.error('Usage: node seed-user.js <email> <password> [admin|viewer]');
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:mwanga@localhost:5000/clients_db',
});
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
  [email.toLowerCase(), hash, role]
);
console.log(`Saved ${role}: ${email}`);
await pool.end();