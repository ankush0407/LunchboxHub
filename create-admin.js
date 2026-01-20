import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const username = "admin";
    const email = "admin@lunchboxhub.com";
    const password = "Admin@123";
    const role = "admin";

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      console.log('❌ Admin user already exists!');
      console.log('Username:', existingUser.rows[0].username);
      console.log('Email:', existingUser.rows[0].email);
      console.log('Role:', existingUser.rows[0].role);
      
      // Update to admin role if not already
      if (existingUser.rows[0].role !== 'admin') {
        await pool.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['admin', existingUser.rows[0].id]
        );
        console.log('✅ User role updated to admin');
      }
    } else {
      // Create new admin user
      const result = await pool.query(
        `INSERT INTO users (username, email, password, role, profile_complete, email_verified, full_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [username, email, hashedPassword, role, true, true, 'Administrator']
      );

      console.log('✅ Admin user created successfully!');
      console.log('\n📋 Login Credentials:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Username:', username);
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('Role:', role);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n⚠️  Please change the password after first login!');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await pool.end();
  }
}

createAdminUser();
