const { Pool } = require('pg');
const Database = require('better-sqlite3');
require('dotenv').config();

async function migrate() {
    let db;

    try {
        console.log('Starting database migration...');

        if (process.env.DATABASE_URL) {
            // Try PostgreSQL first
            try {
                db = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false }
                });
                await db.connect();
                console.log('✅ Connected to PostgreSQL (Supabase)');

                // Create tables for PostgreSQL
                await db.query(`
                    CREATE TABLE IF NOT EXISTS properties (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        address TEXT,
                        type TEXT,
                        status TEXT,
                        monthlyrent INTEGER,
                        taxrate INTEGER,
                        units TEXT,
                        recurringbills TEXT,
                        createdat TEXT,
                        updatedat TEXT
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS tenants (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        phone TEXT,
                        unit TEXT,
                        property TEXT,
                        rent INTEGER,
                        status TEXT,
                        method TEXT,
                        due_date TEXT,
                        lease_end TEXT,
                        assigned_unit TEXT,
                        created_at TEXT
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS payments (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT,
                        tenant_name TEXT,
                        amount INTEGER,
                        period TEXT,
                        method TEXT,
                        reference TEXT,
                        paid_at TEXT,
                        created_at TEXT,
                        status TEXT,
                        due_date TEXT,
                        property_id TEXT
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS complaints (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT,
                        tenant_name TEXT,
                        unit TEXT,
                        property TEXT,
                        category TEXT,
                        description TEXT,
                        priority TEXT,
                        status TEXT,
                        source TEXT,
                        created_at TEXT
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS wa_messages (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT,
                        direction TEXT,
                        body TEXT,
                        timestamp TEXT,
                        channel TEXT,
                        meta_message_id TEXT,
                        from_phone TEXT,
                        to_phone TEXT,
                        status TEXT
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS notifications (
                        id TEXT PRIMARY KEY,
                        type TEXT,
                        title TEXT,
                        body TEXT,
                        created_at TEXT,
                        read BOOLEAN DEFAULT false,
                        recipient TEXT,
                        message TEXT,
                        sentat TEXT,
                        status TEXT
                    );
                `);

                console.log('✅ PostgreSQL migration completed successfully');
            } catch (pgError) {
                console.error('❌ PostgreSQL migration failed:', pgError.message);
                console.log('💡 Falling back to SQLite...');

                // Fallback to SQLite
                db = new Database('propertyhub.db');
                console.log('✅ Connected to SQLite (fallback)');

                // Create tables for SQLite
                db.exec(`
                    CREATE TABLE IF NOT EXISTS properties (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        address TEXT,
                        type TEXT,
                        status TEXT,
                        monthlyrent INTEGER,
                        taxrate INTEGER,
                        units TEXT,
                        recurringbills TEXT,
                        createdat TEXT,
                        updatedat TEXT
                    );

                    CREATE TABLE IF NOT EXISTS tenants (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        phone TEXT,
                        unit TEXT,
                        property TEXT,
                        rent INTEGER,
                        status TEXT,
                        method TEXT,
                        due_date TEXT,
                        lease_end TEXT,
                        assigned_unit TEXT,
                        created_at TEXT
                    );

                    CREATE TABLE IF NOT EXISTS payments (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT,
                        tenant_name TEXT,
                        amount INTEGER,
                        period TEXT,
                        method TEXT,
                        reference TEXT,
                        paid_at TEXT,
                        created_at TEXT,
                        status TEXT,
                        due_date TEXT,
                        property_id TEXT
                    );

                    CREATE TABLE IF NOT EXISTS complaints (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT,
                        tenant_name TEXT,
                        unit TEXT,
                        property TEXT,
                        category TEXT,
                        description TEXT,
                        priority TEXT,
                        status TEXT,
                        source TEXT,
                        created_at TEXT
                    );

                    CREATE TABLE IF NOT EXISTS wa_messages (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT,
                        direction TEXT,
                        body TEXT,
                        timestamp TEXT,
                        channel TEXT,
                        meta_message_id TEXT,
                        from_phone TEXT,
                        to_phone TEXT,
                        status TEXT
                    );

                    CREATE TABLE IF NOT EXISTS notifications (
                        id TEXT PRIMARY KEY,
                        type TEXT,
                        title TEXT,
                        body TEXT,
                        created_at TEXT,
                        read INTEGER DEFAULT 0,
                        recipient TEXT,
                        message TEXT,
                        sentat TEXT,
                        status TEXT
                    );
                `);

                console.log('✅ SQLite migration completed successfully');
            }
        } else {
            console.log('⚠️  No DATABASE_URL found, using SQLite...');

            // Use SQLite
            db = new Database('propertyhub.db');
            console.log('✅ Connected to SQLite');

            // Create tables for SQLite
            db.exec(`
                CREATE TABLE IF NOT EXISTS properties (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    address TEXT,
                    type TEXT,
                    status TEXT,
                    monthlyrent INTEGER,
                    taxrate INTEGER,
                    units TEXT,
                    recurringbills TEXT,
                    createdat TEXT,
                    updatedat TEXT
                );

                CREATE TABLE IF NOT EXISTS tenants (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    phone TEXT,
                    unit TEXT,
                    property TEXT,
                    rent INTEGER,
                    status TEXT,
                    method TEXT,
                    due_date TEXT,
                    lease_end TEXT,
                    assigned_unit TEXT,
                    created_at TEXT
                );

                CREATE TABLE IF NOT EXISTS payments (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT,
                    tenant_name TEXT,
                    amount INTEGER,
                    period TEXT,
                    method TEXT,
                    reference TEXT,
                    paid_at TEXT,
                    created_at TEXT,
                    status TEXT,
                    due_date TEXT,
                    property_id TEXT
                );

                CREATE TABLE IF NOT EXISTS complaints (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT,
                    tenant_name TEXT,
                    unit TEXT,
                    property TEXT,
                    category TEXT,
                    description TEXT,
                    priority TEXT,
                    status TEXT,
                    source TEXT,
                    created_at TEXT
                );

                CREATE TABLE IF NOT EXISTS wa_messages (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT,
                    direction TEXT,
                    body TEXT,
                    timestamp TEXT,
                    channel TEXT,
                    meta_message_id TEXT,
                    from_phone TEXT,
                    to_phone TEXT,
                    status TEXT
                );

                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    type TEXT,
                    title TEXT,
                    body TEXT,
                    created_at TEXT,
                    read INTEGER DEFAULT 0,
                    recipient TEXT,
                    message TEXT,
                    sentat TEXT,
                    status TEXT
                );
            `);

            console.log('✅ SQLite migration completed successfully');
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        if (db && db.constructor.name !== 'Database') {
            await db.end();
        }
    }
}

migrate();