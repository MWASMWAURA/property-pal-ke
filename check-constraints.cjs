const { Pool } = require('pg');
const Database = require('better-sqlite3');
require('dotenv').config();

async function checkConstraints() {
  if (process.env.DATABASE_URL) {
    const db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      const result = await db.query(`
        SELECT conname, conkey, confkey, conrelid::regclass, confrelid::regclass
        FROM pg_constraint
        WHERE conrelid = 'password_reset_tokens'::regclass;
      `);
      console.log('PostgreSQL constraints on password_reset_tokens:');
      console.log(result.rows);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      await db.end();
    }
  } else {
    const db = new Database('propertyhub.db');
    try {
      const result = db.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='password_reset_tokens';
      `).get();
      console.log('SQLite table schema:');
      console.log(result.sql);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      db.close();
    }
  }
}

checkConstraints();