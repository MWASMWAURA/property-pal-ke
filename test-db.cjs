const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
    const db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await db.connect();
        console.log('✅ Database connection successful!');

        // Test a simple query
        const result = await db.query('SELECT NOW()');
        console.log('✅ Query executed successfully:', result.rows[0]);

        await db.end();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('\nTo fix this:');
        console.log('1. Go to your Supabase project dashboard');
        console.log('2. Navigate to Settings > Database');
        console.log('3. Copy the connection string');
        console.log('4. Replace [YOUR-PASSWORD] in .env with your actual database password');
        process.exit(1);
    }
}

testConnection();