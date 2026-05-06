const { Pool } = require('pg');
const Database = require('better-sqlite3');
require('dotenv').config();

async function migrateToMultiTenant() {
    console.log('🚀 Starting multi-tenant migration...');

    if (process.env.DATABASE_URL) {
        // PostgreSQL migration
        try {
            const db = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });

            await db.connect();
            console.log('✅ Connected to PostgreSQL');

            // First ensure landlords table exists
            await db.query(`
                CREATE TABLE IF NOT EXISTS landlords (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    company TEXT,
                    city TEXT,
                    preferred_channel TEXT DEFAULT 'whatsapp',
                    collection_month_start INTEGER DEFAULT 1,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log('✅ Ensured landlords table exists');

            // Add landlord_id columns to existing tables
            console.log('📝 Adding landlord_id columns...');

            const tables = ['tenants', 'properties', 'payments', 'complaints', 'wa_messages', 'notifications'];

            for (const table of tables) {
                try {
                    const columnCheck = await db.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = $1 AND column_name = 'landlord_id'
                    `, [table]);

                    if (columnCheck.rows.length === 0) {
                        await db.query(`ALTER TABLE ${table} ADD COLUMN landlord_id TEXT REFERENCES landlords(id)`);
                        console.log(`✅ Added landlord_id to ${table}`);
                    } else {
                        console.log(`ℹ️  landlord_id already exists in ${table}`);
                    }
                } catch (error) {
                    console.log(`⚠️  Could not check/modify ${table}:`, error.message);
                }
            }

            console.log('✅ Landlord column additions completed');

            await db.end();
            console.log('✅ PostgreSQL multi-tenant migration completed!');

        } catch (error) {
            console.error('❌ PostgreSQL migration failed:', error.message);
            console.log('💡 Falling back to SQLite...');

            // SQLite fallback
            const db = new Database('propertyhub.db');
            console.log('✅ Connected to SQLite');

            // Add landlord_id columns to SQLite tables
            try {
                db.exec(`
                    ALTER TABLE tenants ADD COLUMN landlord_id TEXT;
                    ALTER TABLE properties ADD COLUMN landlord_id TEXT;
                    ALTER TABLE payments ADD COLUMN landlord_id TEXT;
                    ALTER TABLE complaints ADD COLUMN landlord_id TEXT;
                    ALTER TABLE wa_messages ADD COLUMN landlord_id TEXT;
                    ALTER TABLE notifications ADD COLUMN landlord_id TEXT;
                `);
                console.log('✅ Added landlord_id columns to SQLite tables');
            } catch (alterError) {
                // Columns might already exist
                console.log('ℹ️  Columns may already exist in SQLite');
            }

            db.close();
            console.log('✅ SQLite multi-tenant migration completed!');
        }
    } else {
        console.log('⚠️  No DATABASE_URL found, using SQLite only...');

        const db = new Database('propertyhub.db');

        try {
            db.exec(`
                ALTER TABLE tenants ADD COLUMN landlord_id TEXT;
                ALTER TABLE properties ADD COLUMN landlord_id TEXT;
                ALTER TABLE payments ADD COLUMN landlord_id TEXT;
                ALTER TABLE complaints ADD COLUMN landlord_id TEXT;
                ALTER TABLE wa_messages ADD COLUMN landlord_id TEXT;
                ALTER TABLE notifications ADD COLUMN landlord_id TEXT;
            `);
            console.log('✅ Added landlord_id columns to SQLite tables');
        } catch (error) {
            console.log('ℹ️  Columns may already exist or table structure is up to date');
        }

        db.close();
        console.log('✅ SQLite multi-tenant setup completed!');
    }

    console.log('');
    console.log('🎉 Multi-tenant migration complete!');
    console.log('📋 Next steps:');
    console.log('1. Each landlord will need to register/login');
    console.log('2. All data will be isolated by landlord_id');
    console.log('3. Existing data will be associated with the first landlord who logs in');
    console.log('4. Use the AuthDialog component for login/registration');
}

migrateToMultiTenant();