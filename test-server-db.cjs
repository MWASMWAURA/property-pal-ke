const { Pool } = require('pg');
require('dotenv').config();

async function testServerDatabase() {
    console.log('🔍 Testing server database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

    if (process.env.DATABASE_URL) {
        try {
            const db = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });

            await db.connect();
            console.log('✅ Supabase connection successful');

            // Test table creation
            await db.query(`
                CREATE TABLE IF NOT EXISTS connection_test (
                    id SERIAL PRIMARY KEY,
                    message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log('✅ Table creation successful');

            // Test data insertion
            const result = await db.query(
                'INSERT INTO connection_test (message) VALUES ($1) RETURNING id',
                ['Database connection test']
            );
            console.log('✅ Data insertion successful, ID:', result.rows[0].id);

            // Test data retrieval
            const data = await db.query('SELECT * FROM connection_test ORDER BY created_at DESC LIMIT 1');
            console.log('✅ Data retrieval successful:', data.rows[0]);

            await db.end();
            console.log('✅ Full database test completed successfully!');

        } catch (error) {
            console.error('❌ Supabase test failed:', error.message);
            console.log('💡 Falling back to SQLite test...');

            // Test SQLite fallback
            const Database = require('better-sqlite3');
            const db = new Database('propertyhub.db');

            db.exec(`
                CREATE TABLE IF NOT EXISTS connection_test (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message TEXT,
                    created_at TEXT
                )
            `);

            const stmt = db.prepare('INSERT INTO connection_test (message, created_at) VALUES (?, ?)');
            const result = stmt.run('SQLite connection test', new Date().toISOString());
            console.log('✅ SQLite fallback working, inserted ID:', result.lastInsertRowid);

            const data = db.prepare('SELECT * FROM connection_test ORDER BY created_at DESC LIMIT 1').get();
            console.log('✅ SQLite data retrieval:', data);

            db.close();
            console.log('✅ SQLite fallback test completed successfully!');
        }
    } else {
        console.log('⚠️  No DATABASE_URL found, testing SQLite only...');
        const Database = require('better-sqlite3');
        const db = new Database('propertyhub.db');

        db.exec(`
            CREATE TABLE IF NOT EXISTS connection_test (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT,
                created_at TEXT
            )
        `);

        const stmt = db.prepare('INSERT INTO connection_test (message, created_at) VALUES (?, ?)');
        const result = stmt.run('SQLite connection test', new Date().toISOString());
        console.log('✅ SQLite working, inserted ID:', result.lastInsertRowid);

        db.close();
        console.log('✅ SQLite test completed successfully!');
    }
}

testServerDatabase();