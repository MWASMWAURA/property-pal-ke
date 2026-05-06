const Database = require('better-sqlite3');
require('dotenv').config();

console.log('Testing SQLite fallback...');

try {
    const db = new Database('propertyhub.db');

    // Test basic operations
    db.exec(`
        CREATE TABLE IF NOT EXISTS test_table (
            id TEXT PRIMARY KEY,
            data TEXT,
            created_at TEXT
        );
    `);

    // Insert test data
    const stmt = db.prepare('INSERT INTO test_table (id, data, created_at) VALUES (?, ?, ?)');
    stmt.run('test_1', 'Hello SQLite!', new Date().toISOString());

    // Query test data
    const result = db.prepare('SELECT * FROM test_table WHERE id = ?').get('test_1');

    console.log('✅ SQLite database working!');
    console.log('✅ Test data inserted and retrieved:', result);

    db.close();
    console.log('✅ SQLite test completed successfully');

} catch (error) {
    console.error('❌ SQLite test failed:', error);
}