const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { Resend } = require('resend');

// Load environment variables
dotenv.config();

// Initialize Resend for email
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['https://property.mwasmwaura.co.ke','https://property-pal-ke.onrender.com', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path} - Origin: ${req.headers.origin} - User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
    next();
});

// Meta WhatsApp Cloud API client (only initialize if credentials exist)
let metaClient = null;
let metaPhoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
let metaAccessToken = process.env.META_ACCESS_TOKEN || '';

if (metaPhoneNumberId && metaAccessToken) {
    const axios = require('axios');
    metaClient = axios.create({
        baseURL: 'https://graph.facebook.com/v19.0',
        headers: {
            'Authorization': `Bearer ${metaAccessToken}`,
            'Content-Type': 'application/json'
        }
    });
    console.log('✅ Meta WhatsApp Cloud API client initialized');
} else {
    console.log('⚠️  Meta credentials not found. WhatsApp messaging will be simulated.');
}

// Database connection - supports both Supabase and local PostgreSQL
const { Pool } = require('pg');
let db;
let isSQLite = false;



// JWT and bcrypt for authentication
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const createOtpPolicy = require('./otp-policy.cjs');
let otpPolicy;

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'propertyhub_kenya_secret_2026';

// SMS API client
const sendSMS = async (to, message) => {
  const formattedPhone = kenyaUtils.formatPhone(to).replace('+', '');
  console.log(`📱 Attempting to send SMS to ${formattedPhone}`);

  if (!process.env.SMS_API_TOKEN) {
    console.log(`[SIMULATED SMS] To: ${formattedPhone}, Message: ${message}`);
    return { success: true, simulated: true };
  }

  try {
    console.log(`📤 Sending real SMS via Talksasa API...`);
    
    const response = await fetch('https://bulksms.talksasa.com/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMS_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        recipient: formattedPhone,
        sender_id: process.env.SMS_SENDER_ID || 'TALK-SASA',
        type: 'plain',
        message: message
      })
    });

    console.log(`📥 SMS API Response Status: ${response.status}`);
    const result = await response.json();
    console.log(`📥 SMS API Response:`, JSON.stringify(result, null, 2));

    return { success: result.status === 'success', ...result };
  } catch (error) {
    console.error('❌ SMS send error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return { success: false, error: error.message };
  }
};

// Generate OTP code
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP for phone verification
const sendOTP = async (phone, purpose = 'registration') => {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const normalizedPhone = kenyaUtils.formatPhone(phone);

  console.log(`📤 Sending OTP to phone: ${phone} -> ${normalizedPhone}, code: ${code}`);

  try {
    // Store OTP in database
    const otpId = generateId();
    if (isSQLite) {
      db.prepare(`
        INSERT INTO otp_codes (id, phone, code, purpose, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(otpId, normalizedPhone, code, purpose, expiresAt.toISOString());
    } else {
      await db.query(`
        INSERT INTO otp_codes (id, phone, code, purpose, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [otpId, normalizedPhone, code, purpose, expiresAt]);
    }

    console.log(`💾 OTP stored in database for ${normalizedPhone}`);

    // Send SMS
    const message = `PropertyHub Kenya: Your verification code is ${code}. Valid for 10 minutes.`;
    const smsResult = await sendSMS(phone, message);

    await otpPolicy.recordOtpRequest({ phone: normalizedPhone, purpose, success: smsResult.success });

    return { success: smsResult.success, code: smsResult.simulated ? code : undefined };
  } catch (error) {
    console.error('❌ OTP send error:', error);
    return { success: false, error: error.message };
  }
};

// Verify OTP code
const verifyOTP = async (phone, code) => {
  try {
    const normalizedPhone = kenyaUtils.formatPhone(phone);
    const now = new Date().toISOString();

    console.log(`🔍 Verifying OTP: phone=${normalizedPhone}, code=${code}, dbType=${isSQLite ? 'SQLite' : 'PostgreSQL'}`);

    let otpRecord;
    if (isSQLite) {
      otpRecord = db.prepare(`
        SELECT * FROM otp_codes
        WHERE phone = ? AND code = ? AND expires_at > ? AND used = 0
        ORDER BY created_at DESC LIMIT 1
      `).get(normalizedPhone, code, now);
    } else {
      const result = await db.query(`
        SELECT * FROM otp_codes
        WHERE phone = $1 AND code = $2 AND expires_at > $3 AND used = false
        ORDER BY created_at DESC LIMIT 1
      `, [normalizedPhone, code, now]);
      otpRecord = result.rows[0];
    }

    console.log(`📋 OTP Record found:`, otpRecord ? 'Yes' : 'No');

    if (!otpRecord) {
      console.log(`❌ No valid OTP found for phone ${normalizedPhone}`);
      return { success: false, error: 'Invalid or expired code' };
    }

    console.log(`✅ OTP verified for phone ${normalizedPhone}`);

    // Mark as used
    if (isSQLite) {
      db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otpRecord.id);
    } else {
      await db.query('UPDATE otp_codes SET used = true WHERE id = $1', [otpRecord.id]);
    }

    console.log(`🔄 OTP marked as used`);
    return { success: true };
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    return { success: false, error: error.message };
  }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.landlord = user;
        next();
    });
};

// Secure API middleware: protect all /api routes except public auth/webhook/info endpoints
const publicApiPaths = [
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/register',
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/whatsapp/webhook',
    '/localization',
    '/support',
    '/support/ticket'
];

app.use('/api', (req, res, next) => {
    if (publicApiPaths.some(path => req.path === path || req.path.startsWith(path + '/'))) {
        return next();
    }
    return authenticateToken(req, res, next);
});

// Generate JWT token
const generateToken = (landlord) => {
    return jwt.sign(
        {
            id: landlord.id,
            email: landlord.email,
            name: landlord.name
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const initDatabase = async () => {
    try {
        if (db.constructor.name === 'Database') {
            // SQLite initialization with landlord_id
            db.exec(`
                CREATE TABLE IF NOT EXISTS landlords (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    company TEXT,
                    city TEXT,
                    preferred_channel TEXT DEFAULT 'whatsapp',
                    collection_month_start INTEGER DEFAULT 1,
                    wallet_balance INTEGER DEFAULT 0,
                    whatsapp_balance INTEGER DEFAULT 0,
                    sms_balance INTEGER DEFAULT 0,
                    current_plan TEXT,
                    last_top_up TEXT,
                    password_hash TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS properties (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL,
                    name TEXT,
                    address TEXT,
                    type TEXT,
                    status TEXT,
                    monthly_rent INTEGER,
                    tax_rate INTEGER,
                    units TEXT,
                    recurring_bills TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    FOREIGN KEY (landlord_id) REFERENCES landlords(id)
                );

                CREATE TABLE IF NOT EXISTS tenants (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL,
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
                    created_at TEXT,
                    FOREIGN KEY (landlord_id) REFERENCES landlords(id)
                );

                CREATE TABLE IF NOT EXISTS payments (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL,
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
                    property_id TEXT,
                    FOREIGN KEY (landlord_id) REFERENCES landlords(id)
                );

                CREATE TABLE IF NOT EXISTS complaints (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL,
                    tenant_id TEXT,
                    tenant_name TEXT,
                    unit TEXT,
                    property TEXT,
                    category TEXT,
                    description TEXT,
                    priority TEXT,
                    status TEXT,
                    source TEXT,
                    created_at TEXT,
                    FOREIGN KEY (landlord_id) REFERENCES landlords(id)
                );

                CREATE TABLE IF NOT EXISTS wa_messages (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL,
                    tenant_id TEXT,
                    direction TEXT,
                    body TEXT,
                    timestamp TEXT,
                    channel TEXT,
                    meta_message_id TEXT,
                    from_phone TEXT,
                    to_phone TEXT,
                    status TEXT,
                    FOREIGN KEY (landlord_id) REFERENCES landlords(id)
                );

                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL,
                    type TEXT,
                    title TEXT,
                    body TEXT,
                    created_at TEXT,
                    read INTEGER DEFAULT 0,
                    recipient TEXT,
                    message TEXT,
                    sent_at TEXT,
                    status TEXT,
                    FOREIGN KEY (landlord_id) REFERENCES landlords(id)
                );

                CREATE TABLE IF NOT EXISTS otp_codes (
                    id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    code TEXT NOT NULL,
                    purpose TEXT NOT NULL, -- 'registration' or 'verification'
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    expires_at TEXT NOT NULL,
                    used INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS otp_request_logs (
                    id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    success INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TEXT NOT NULL,
                    used INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `);

            try {
                db.exec(`
                    ALTER TABLE landlords ADD COLUMN wallet_balance INTEGER DEFAULT 0;
                    ALTER TABLE landlords ADD COLUMN whatsapp_balance INTEGER DEFAULT 0;
                    ALTER TABLE landlords ADD COLUMN sms_balance INTEGER DEFAULT 0;
                    ALTER TABLE landlords ADD COLUMN current_plan TEXT;
                    ALTER TABLE landlords ADD COLUMN last_top_up TEXT;
                `);
            } catch (error) {
                // Existing schema already has billing columns or SQLite ALTER TABLE not supported
            }
            console.log('✅ SQLite database tables created/verified with landlord support');
        } else {
            // PostgreSQL initialization with landlord_id
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
                    wallet_balance INTEGER DEFAULT 0,
                    whatsapp_balance INTEGER DEFAULT 0,
                    sms_balance INTEGER DEFAULT 0,
                    current_plan TEXT,
                    last_top_up TEXT,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);

            await db.query(`
                ALTER TABLE landlords ADD COLUMN IF NOT EXISTS wallet_balance INTEGER DEFAULT 0;
                ALTER TABLE landlords ADD COLUMN IF NOT EXISTS whatsapp_balance INTEGER DEFAULT 0;
                ALTER TABLE landlords ADD COLUMN IF NOT EXISTS sms_balance INTEGER DEFAULT 0;
                ALTER TABLE landlords ADD COLUMN IF NOT EXISTS current_plan TEXT;
                ALTER TABLE landlords ADD COLUMN IF NOT EXISTS last_top_up TEXT;
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS properties (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL REFERENCES landlords(id),
                    name TEXT,
                    address TEXT,
                    type TEXT,
                    status TEXT,
                    monthly_rent INTEGER,
                    tax_rate INTEGER,
                    units TEXT,
                    recurring_bills TEXT,
                    created_at TEXT,
                    updated_at TEXT
                );
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS tenants (
                    id TEXT PRIMARY KEY,
                    landlord_id TEXT NOT NULL REFERENCES landlords(id),
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
                    landlord_id TEXT NOT NULL REFERENCES landlords(id),
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
                    landlord_id TEXT NOT NULL REFERENCES landlords(id),
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
                    landlord_id TEXT NOT NULL REFERENCES landlords(id),
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
                    landlord_id TEXT NOT NULL REFERENCES landlords(id),
                    type TEXT,
                    title TEXT,
                    body TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    read BOOLEAN DEFAULT false,
                    recipient TEXT,
                    message TEXT,
                    sent_at TEXT,
                    status TEXT
                );
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS otp_codes (
                    id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    code TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT false
                );

                CREATE TABLE IF NOT EXISTS otp_request_logs (
                    id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    success BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            // Remove duplicates by email, keeping the most recent
            await db.query(`
                DELETE FROM password_reset_tokens
                WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
                        FROM password_reset_tokens
                    ) t WHERE rn = 1
                );
            `);
            try {
                await db.query(`ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_email_unique UNIQUE (email);`);
                console.log('✅ Added unique constraint on email');
            } catch (e) {
                console.log('ℹ️  Unique constraint on email already exists or failed to add');
            }
            console.log('✅ Password reset tokens table created/verified');

            console.log('✅ PostgreSQL database tables created/verified with landlord support');
        }
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        console.log('💡 The application will continue with limited functionality');
    }
};

// Initialize database and load data
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing PropertyHub Kenya server...');
    console.log(`📱 SMS Token configured: ${process.env.SMS_API_TOKEN ? '✅ Yes' : '❌ No'}`);
    console.log(`📱 SMS Sender ID: ${process.env.SMS_SENDER_ID || 'TALK-SASA'}`);

    if (process.env.DATABASE_URL) {
      // Try Supabase connection first
      const testPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: {
              rejectUnauthorized: false // Required for Supabase
          }
      });

      // Test connection
      await testPool.connect();
      console.log('✅ Supabase PostgreSQL database connected');
      db = testPool;
      isSQLite = false;
    } else {
      // Local SQLite fallback
      console.log('⚠️  No DATABASE_URL found, using local SQLite storage');
      const Database = require('better-sqlite3');
      db = new Database('propertyhub.db');
      isSQLite = true;
      console.log('✅ SQLite database initialized');
    }

    await initDatabase();
    await loadDatabaseData();

    otpPolicy = createOtpPolicy({ db, isSQLite, query });

    // Start server only after database is ready
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🏠 PropertyHub Kenya running on http://localhost:${PORT}`);
      console.log(`📱 WhatsApp Integration: ${metaClient ? '✅ Active' : '⚠️  Simulated (no credentials)'}`);
      console.log(`📱 SMS OTP: ${process.env.SMS_API_TOKEN ? '✅ Active' : '⚠️  Simulated (no token)'}`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
};

initializeApp();

const loadJson = (value, fallback) => {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const normalizePropertyRow = (row) => ({
  ...row,
  location: row.address,
  unitNames: loadJson(row.units, []),
  monthlyRent: row.monthly_rent != null ? Number(row.monthly_rent) : row.monthly_rent,
  taxRate: row.tax_rate != null ? Number(row.tax_rate) : row.tax_rate,
  recurringBills: loadJson(row.recurring_bills, []),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Helper functions for database queries (works with both PostgreSQL and SQLite)
const query = async (sql, params = []) => {
    try {
        if (isSQLite) {
            // SQLite mode
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return { rows: db.prepare(sql).all(params) };
            } else {
                const stmt = db.prepare(sql);
                const result = stmt.run(params);
                return { rowCount: result.changes };
            }
        } else {
            // PostgreSQL mode
            return await db.query(sql, params);
        }
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

const queryOne = async (sql, params = []) => {
    try {
        if (isSQLite) {
            // SQLite mode
            return db.prepare(sql).get(params) || null;
        } else {
            // PostgreSQL mode
            const result = await query(sql, params);
            return result.rows[0] || null;
        }
    } catch (error) {
        console.error('Database queryOne error:', error);
        throw error;
    }
};

const queryAll = async (sql, params = []) => {
    try {
        if (isSQLite) {
            // SQLite mode
            return db.prepare(sql).all(params);
        } else {
            // PostgreSQL mode
            const result = await query(sql, params);
            return result.rows;
        }
    } catch (error) {
        console.error('Database queryAll error:', error);
        throw error;
    }
};

// Normalization functions for PostgreSQL column names
const normalizeTenantRow = (row) => ({
  ...row,
  rent: row.rent != null ? Number(row.rent) : row.rent,
  assignedUnit: loadJson(row.assigned_unit, null),
  createdAt: row.created_at,
  dueDate: row.due_date,
  leaseEnd: row.lease_end
});

const normalizePaymentRow = (row) => ({
  ...row,
  tenantId: row.tenant_id,
  tenantName: row.tenant_name,
  paidAt: row.paid_at,
  createdAt: row.created_at,
  dueDate: row.due_date,
  propertyId: row.property_id
});

const normalizeComplaintRow = (row) => ({
  ...row,
  createdAt: row.created_at
});

const normalizeWaMessageRow = (row) => ({
  ...row,
  from: row.from_phone,
  to: row.to_phone,
  metaMessageId: row.meta_message_id
});

const normalizeNotificationRow = (row) => ({
  ...row,
  createdAt: row.created_at,
  sentAt: row.sent_at
});



const persistProperty = (property) => db.prepare(
  `INSERT OR REPLACE INTO properties (id, name, address, type, status, monthly_rent, tax_rate, units, recurring_bills, created_at, updated_at)
   VALUES (@id, @name, @address, @type, @status, @monthly_rent, @tax_rate, @units, @recurring_bills, @created_at, @updated_at)`
).run({
  ...property,
  units: JSON.stringify(property.units || []),
  recurring_bills: JSON.stringify(property.recurringBills || []),
  monthly_rent: property.monthlyRent,
  tax_rate: property.taxRate,
  created_at: property.createdAt || new Date().toISOString(),
  updated_at: property.updatedAt || new Date().toISOString()
});

const deleteProperty = (propertyId) => db.prepare('DELETE FROM properties WHERE id = ?').run(propertyId);

const persistTenant = (tenant) => db.prepare(
  `INSERT OR REPLACE INTO tenants (id, name, phone, unit, property, rent, status, method, due_date, lease_end, assigned_unit, created_at)
   VALUES (@id, @name, @phone, @unit, @property, @rent, @status, @method, @due_date, @lease_end, @assigned_unit, @created_at)`
).run({
  ...tenant,
  tenantId: undefined,
  tenantName: undefined,
  assigned_unit: tenant.assignedUnit ? JSON.stringify(tenant.assignedUnit) : null,
  created_at: tenant.createdAt || new Date().toISOString()
});

const persistPayment = (payment) => db.prepare(
  `INSERT OR REPLACE INTO payments (id, tenant_id, tenant_name, amount, period, method, reference, paid_at, created_at, status, due_date, property_id)
   VALUES (@id, @tenant_id, @tenant_name, @amount, @period, @method, @reference, @paid_at, @created_at, @status, @due_date, @property_id)`
).run({
  id: payment.id,
  tenant_id: payment.tenantId,
  tenant_name: payment.tenantName,
  amount: payment.amount,
  period: payment.period,
  method: payment.method,
  reference: payment.reference || null,
  paid_at: payment.paidAt || null,
  created_at: payment.createdAt || new Date().toISOString(),
  status: payment.status || 'pending',
  due_date: payment.dueDate || null,
  property_id: payment.propertyId || null
});

const persistComplaint = async (complaint) => {
    await query(
        `INSERT INTO complaints (id, tenant_id, tenant_name, unit, property, category, description, priority, status, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         tenant_name = EXCLUDED.tenant_name,
         unit = EXCLUDED.unit,
         property = EXCLUDED.property,
         category = EXCLUDED.category,
         description = EXCLUDED.description,
         priority = EXCLUDED.priority,
         status = EXCLUDED.status,
         source = EXCLUDED.source,
         created_at = EXCLUDED.created_at`,
        [
            complaint.id,
            complaint.tenantId,
            complaint.tenantName,
            complaint.unit,
            complaint.property,
            complaint.category || null,
            complaint.description,
            complaint.priority || 'medium',
            complaint.status || 'pending',
            complaint.source || 'tenant',
            complaint.createdAt || new Date().toISOString()
        ]
    );
};

const persistWaMessage = (message) => db.prepare(
  `INSERT OR REPLACE INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, meta_message_id, from_phone, to_phone, status)
   VALUES (@id, @tenant_id, @direction, @body, @timestamp, @channel, @meta_message_id, @from_phone, @to_phone, @status)`
).run({
  id: message.id,
  tenant_id: message.tenantId || null,
  direction: message.direction,
  body: message.body,
  timestamp: message.timestamp,
  channel: message.channel || 'bot',
  meta_message_id: message.metaMessageId || null,
  from_phone: message.from || null,
  to_phone: message.to || null,
  status: message.status || 'sent'
});

const persistNotification = (notification) => db.prepare(
  `INSERT OR REPLACE INTO notifications (id, type, title, body, created_at, read, recipient, message, sent_at, status)
   VALUES (@id, @type, @title, @body, @created_at, @read, @recipient, @message, @sent_at, @status)`
).run({
  ...notification,
  created_at: notification.createdAt || new Date().toISOString(),
  read: notification.read ? 1 : 0,
  message: notification.message || null,
  sent_at: notification.sentAt || null,
  status: notification.status || 'sent'
});

// Initialize in-memory arrays (will be populated from database after init)
let properties = [];
let tenants = [];
let payments = [];
let complaints = [];
let whatsappMessages = [];
let notifications = [];

// Load data from database after initialization
const loadDatabaseData = async () => {
  try {
    console.log('📥 Loading data from database...');
    properties = (await queryAll('SELECT * FROM properties')).map(normalizePropertyRow);
    tenants = (await queryAll('SELECT * FROM tenants')).map(normalizeTenantRow);
    payments = (await queryAll('SELECT * FROM payments')).map(normalizePaymentRow);
    complaints = (await queryAll('SELECT * FROM complaints')).map(normalizeComplaintRow);
    whatsappMessages = (await queryAll('SELECT * FROM wa_messages')).map(normalizeWaMessageRow);
    notifications = (await queryAll('SELECT * FROM notifications')).map(normalizeNotificationRow);
    console.log(`✅ Loaded ${properties.length} properties, ${tenants.length} tenants, ${payments.length} payments, ${complaints.length} complaints`);
  } catch (error) {
    console.log('⚠️  Database load failed, using empty arrays:', error.message);
  }
};

// New data models for enhanced features
let maintenanceRequests = [];
let relocationRequests = [];
let receiptRequests = [];

// Generate unique IDs
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ==================== KENYAN LOCALIZATION UTILITIES ====================

const kenyaUtils = {
    // Format currency to KES
    formatKES: (amount) => {
        const kesAmount = typeof amount === 'number' ? amount : 0;
        return `KSh ${kesAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    // Format Kenyan phone number to international format
    formatPhone: (phone) => {
        if (!phone) return '';
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('254') && cleaned.length === 12) {
            return `+${cleaned}`;
        } else if (cleaned.startsWith('07') && cleaned.length === 10) {
            return `+254${cleaned.substring(1)}`;
        } else if (cleaned.startsWith('01') && cleaned.length === 10) {
            return `+254${cleaned.substring(1)}`;
        } else if (cleaned.startsWith('7') && cleaned.length === 9) {
            return `+254${cleaned}`;
        } else if (cleaned.startsWith('1') && cleaned.length === 9) {
            return `+254${cleaned}`;
        } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
            return `+${cleaned}`;
        }
        return phone;
    },

    // Validate Kenyan phone number
    isValidKenyanPhone: (phone) => {
        if (!phone) return false;
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.startsWith('254') && cleaned.length === 12 ||
               cleaned.startsWith('07') && cleaned.length === 10 ||
               cleaned.startsWith('01') && cleaned.length === 10 ||
               cleaned.startsWith('7') && cleaned.length === 9 ||
               cleaned.startsWith('1') && cleaned.length === 9;
    },

    // Get default currency symbol
    getCurrencySymbol: () => 'KES',

    // Format date for Kenyan users (DD/MM/YYYY)
    formatDate: (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-KE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
};

// ==================== WHATSAPP MESSAGE PROCESSOR ====================

class WhatsAppCommandProcessor {
    constructor() {
        this.commands = {
            'MENU': this.showMenu.bind(this),
            'HELP': this.showMenu.bind(this),
            'START': this.showMenu.bind(this),
            'BALANCE': this.checkBalance.bind(this),
            'BAL': this.checkBalance.bind(this),
            'RECEIPT': this.requestReceipt.bind(this),
            'RECEIPTS': this.requestReceipt.bind(this),
            'COMPLAINT': this.fileComplaint.bind(this),
            'COMPLAIN': this.fileComplaint.bind(this),
            'MAINTENANCE': this.requestMaintenance.bind(this),
            'MAINTAIN': this.requestMaintenance.bind(this),
            'RENOVATE': this.requestMaintenance.bind(this),
            'FIX': this.requestMaintenance.bind(this),
            'RELOCATE': this.requestRelocation.bind(this),
            'MOVE': this.requestRelocation.bind(this),
            'TRANSFER': this.requestRelocation.bind(this),
            'PAY': this.getPaymentInfo.bind(this),
            'PAYMENT': this.getPaymentInfo.bind(this),
            'DETAILS': this.getAccountDetails.bind(this),
            'INFO': this.getAccountDetails.bind(this)
        };
    }

    async process(sender, message, tenantData) {
        const cleanedMsg = message.trim().toUpperCase();
        const parts = cleanedMsg.split(' ');

        // Check for command
        const command = parts[0];
        const args = parts.slice(1);

        if (this.commands[command]) {
            return await this.commands[command](sender, args, tenantData);
        }

        // If no known command, provide help
        return {
            message: `Unrecognized command. Send *MENU* or *HELP* to see available options.`
        };
    }

    async showMenu(sender, args, tenantData) {
        const menu = `
🏠 *PropertyHub Kenya - Tenant Menu*

Please choose an option by sending the keyword:

💰 *BALANCE* - Check your rent balance & payment status
🧾 *RECEIPT* - Request a payment receipt
📝 *COMPLAINT* - File a maintenance complaint
🔧 *MAINTENANCE* - Request repairs/renovations
🏡 *RELOCATE* - Request unit transfer
💳 *PAY* - Get payment information
ℹ️ *INFO* - View your account details

*Example:* Send "BALANCE" to check your account.

Need help? Contact your landlord directly.
`.trim();
        return { message: menu, type: 'menu' };
    }

    async checkBalance(sender, args, tenantData) {
        if (!tenantData) {
            return { message: '⚠️ Your phone number is not registered in our system. Please contact your landlord to register you as a tenant.' };
        }

        const tenantPayments = payments.filter(p => p.tenantId === tenantData.id);
        const totalDue = tenantPayments.reduce((sum, p) => {
            if (p.status === 'pending' || p.status === 'overdue') return sum + p.amount;
            return sum;
        }, 0);
        const totalPaid = tenantPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
        const overdueCount = tenantPayments.filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.dueDate) < new Date())).length;

        let response = `📊 *Account Balance for ${tenantData.name}*\n\n`;
        response += `Total Rent Paid: ${kenyaUtils.formatKES(totalPaid)}\n`;
        response += `Current Balance Due: ${kenyaUtils.formatKES(totalDue)}\n`;
        response += `Overdue Payments: ${overdueCount}\n\n`;

        if (totalDue > 0) {
            response += `💡 To make payment, use M-Pesa:\n`;
            response += `Paybill: ${process.env.MPESA_SHORTCODE || 'TBA'}\n`;
            response += `Account: ${tenantData.name}\n`;
            response += `Amount: ${kenyaUtils.formatKES(totalDue)}`;
        } else {
            response += `✅ Your account is up to date!`;
        }

        return { message: response };
    }

    async requestReceipt(sender, args, tenantData) {
        if (!tenantData) {
            return { message: '⚠️ Please register with your landlord first to access receipts.' };
        }

        const paidPayments = payments.filter(p => p.tenantId === tenantData.id && p.status === 'paid');

        if (paidPayments.length === 0) {
            return { message: '📭 No payment receipts found for your account.' };
        }

        // Show last 3 payments
        const recent = paidPayments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)).slice(0, 3);

        let response = `🧾 *Your Recent Payment Receipts*\n\n`;
        recent.forEach((p, i) => {
            response += `${i + 1}. ${kenyaUtils.formatKES(p.amount)} - Paid on ${kenyaUtils.formatDate(p.paidAt)} (${p.period})\n`;
        });

        response += `\n📄 Need an official receipt? Contact your landlord or send "COMPLAINT" to request one be sent to your email.`;

        // Log receipt request
        receiptRequests.push({
            id: generateId(),
            tenantId: tenantData.id,
            requestedAt: new Date().toISOString(),
            status: 'fulfilled_auto'
        });

        return { message: response };
    }

    async fileComplaint(sender, args, tenantData) {
        if (!tenantData) {
            return { message: '⚠️ Please register with your landlord first to file complaints.' };
        }

        if (args.length === 0) {
            return { message: '📝 To file a complaint, please describe the issue.\n\n*Example:* COMPLAINT Water tank is leaking\n\nWe will notify your landlord immediately.' };
        }

        const complaintText = args.join(' ');
        const complaint = {
            id: generateId(),
            tenantId: tenantData.id,
            tenantName: tenantData.name,
            propertyId: tenantData.assignedUnit?.propertyId,
            unitNumber: tenantData.assignedUnit?.unitNumber || tenantData.assignedUnit?.unitId,
            complaint: complaintText,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        complaints.push(complaint);

        // Notify landlord via WhatsApp (background)
        await this.notifyLandlord(`🚨 *New Complaint*\n\nTenant: ${tenantData.name}\nUnit: ${complaint.unitNumber}\nIssue: ${complaintText}`);

        return { message: `✅ Complaint logged successfully!\n\nReference: #${complaint.id.substr(0, 8).toUpperCase()}\nStatus: Pending\n\nWe will address this as soon as possible.` };
    }

    async requestMaintenance(sender, args, tenantData) {
        if (!tenantData) {
            return { message: '⚠️ Please register with your landlord first to request maintenance.' };
        }

        if (args.length === 0) {
            return { message: '🔧 To request maintenance/renovation, please describe what\'s needed.\n\n*Example:* MAINTENANCE Fix kitchen faucet\n\nOr send "COMPLAINT" for urgent issues.' };
        }

        const description = args.join(' ');
        const maintenance = {
            id: generateId(),
            tenantId: tenantData.id,
            tenantName: tenantData.name,
            propertyId: tenantData.assignedUnit?.propertyId,
            unitNumber: tenantData.assignedUnit?.unitNumber || tenantData.assignedUnit?.unitId,
            description: description,
            type: this.detectMaintenanceType(description),
            priority: 'normal',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        maintenanceRequests.push(maintenance);

        await this.notifyLandlord(`🔧 *Maintenance Request*\n\nTenant: ${tenantData.name}\nUnit: ${maintenance.unitNumber}\nType: ${maintenance.type}\nRequest: ${description}`);

        return { message: `✅ Maintenance request submitted!\n\nReference: #${maintenance.id.substr(0, 8).toUpperCase()}\nStatus: Pending\n\nOur team will review and respond shortly.` };
    }

    async requestRelocation(sender, args, tenantData) {
        if (!tenantData) {
            return { message: '⚠️ Please register with your landlord first to request relocation.' };
        }

        if (args.length < 2) {
            return { message: '🏡 To request relocation, please specify your preferred unit type or property.\n\n*Example:* RELOCATE 2 bedroom apartment\n\nWe will check availability and get back to you.' };
        }

        const preferences = args.join(' ');
        const relocation = {
            id: generateId(),
            tenantId: tenantData.id,
            tenantName: tenantData.name,
            currentUnit: tenantData.assignedUnit?.unitNumber || tenantData.assignedUnit?.unitId,
            preferences: preferences,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        relocationRequests.push(relocation);

        await this.notifyLandlord(`🏡 *Relocation Request*\n\nTenant: ${tenantData.name}\nCurrent Unit: ${relocation.currentUnit}\nPreferred: ${preferences}`);

        return { message: `✅ Relocation request received!\n\nReference: #${relocation.id.substr(0, 8).toUpperCase()}\nStatus: Under Review\n\nWe will check availability and contact you soon.` };
    }

    async getPaymentInfo(sender, args, tenantData) {
        if (!tenantData) {
            return { message: `💳 *Payment Information*\n\nTo make rent payments via M-Pesa:\n\nPaybill: ${process.env.MPESA_SHORTCODE || 'TBA'}\nAccount Name: Please register as a tenant\n\n*Note:* You must be registered as a tenant to receive personalized account details.` };
        }

        const totalDue = payments.filter(p => p.tenantId === tenantData.id && (p.status === 'pending' || p.status === 'overdue')).reduce((sum, p) => sum + p.amount, 0);

        let response = `💳 *Payment Information*\n\n`;
        response += `Paybill Number: *${process.env.MPESA_SHORTCODE || 'TBA'}*\n`;
        response += `Account Name: *${tenantData.name}*\n`;
        response += `Amount Due: ${kenyaUtils.formatKES(totalDue)}\n\n`;
        response += `📌 Instructions:\n1. Go to M-Pesa\n2. Select Paybill\n3. Enter business number above\n4. Enter your name as account\n5. Enter amount and confirm\n\n`;
        response += `Send "BALANCE" to view your current balance.`;

        return { message: response };
    }

    async getAccountDetails(sender, args, tenantData) {
        if (!tenantData) {
            return { message: '⚠️ Your phone number is not registered. Please contact your landlord to add you as a tenant.' };
        }

        const unit = tenantData.assignedUnit;
        const property = unit ? properties.find(p => p.id === unit.propertyId) : null;

        let response = `ℹ️ *Your Account Details*\n\n`;
        response += `Name: ${tenantData.name}\n`;
        response += `Phone: ${kenyaUtils.formatPhone(sender)}\n`;
        response += `Property: ${property ? property.name : 'N/A'}\n`;
        response += `Unit: ${unit ? (unit.unitNumber || unit.unitId) : 'Unassigned'}\n`;
        response += `Move-in: ${kenyaUtils.formatDate(tenantData.moveInDate)}\n`;

        return { message: response };
    }

    detectMaintenanceType(description) {
        const desc = description.toLowerCase();
        if (desc.includes('leak') || desc.includes('water') || desc.includes('plumbing') || desc.includes('tap') || desc.includes('shower')) return 'Plumbing';
        if (desc.includes('electric') || desc.includes('light') || desc.includes('power') || desc.includes('socket') || desc.includes('switch')) return 'Electrical';
        if (desc.includes('door') || desc.includes('lock') || desc.includes('window') || desc.includes('glass')) return 'Carpentry';
        if (desc.includes('paint') || desc.includes('wall') || desc.includes('ceiling')) return 'Painting';
        if (desc.includes('furniture') || desc.includes('cabinet') || desc.includes('cupboard')) return 'Furniture';
        return 'General';
    }

    async notifyLandlord(message) {
        // Store notification for landlord dashboard
        const notification = {
            id: generateId(),
            type: 'whatsapp',
            recipient: 'landlord',
            message: message,
            sentAt: new Date().toISOString(),
            status: 'sent',
            createdAt: new Date().toISOString(),
            title: 'WhatsApp notification',
            body: message,
            read: false
        };
        notifications.push(notification);
        persistNotification(notification);
        // In a real app, this could also send to landlord's personal WhatsApp
        console.log('📱 Landlord notification:', message);
    }

async sendWhatsAppMessage(to, message) {
        if (!metaClient) {
            console.log(`[SIMULATED] WhatsApp to ${to}: ${message}`);
            // Store in database as sent
            const outMessage = {
                id: generateId(),
                from: metaPhoneNumberId,
                to: to,
                body: message,
                direction: 'outbound',
                timestamp: new Date().toISOString(),
                status: 'sent'
            };
            whatsappMessages.push(outMessage);
            persistWaMessage(outMessage);
            return { success: true, messageId: 'simulated' };
        }

        try {
            const url = `https://graph.facebook.com/v19.0/${metaPhoneNumberId}/messages`;
            const response = await metaClient.post(url, {
                messaging_product: 'whatsapp',
                to: kenyaUtils.formatPhone(to),
                type: 'text',
                text: { body: message }
            });
            
            const messageId = response.data.messages?.[0]?.id || response.data.message_id;
            
            const outMessage = {
                id: generateId(),
                metaMessageId: messageId,
                from: metaPhoneNumberId,
                to: to,
                body: message,
                direction: 'outbound',
                timestamp: new Date().toISOString(),
                status: 'sent'
            };
            whatsappMessages.push(outMessage);
            persistWaMessage(outMessage);
            return { success: true, messageId };
        } catch (error) {
            console.error('WhatsApp send error:', error.response?.data || error.message);
            return { success: false, error: error.response?.data || error.message };
        }
    }
}

function buildReceiptMessage(payment, tenant, property, channel = 'whatsapp') {
    const bold = channel === 'whatsapp' ? '*' : '';
    const lines = [];
    lines.push(`${bold}PROPERTYHUB KENYA${bold}`);
    lines.push(`${bold}PAYMENT RECEIPT${bold}`);
    lines.push('------------------------------');
    lines.push(`Receipt No: RCP-${payment.id?.substring(0, 8).toUpperCase()}`);
    lines.push(`Tenant: ${tenant.name}`);
    lines.push(`Phone: ${tenant.phone || 'N/A'}`);
    if (property) {
        lines.push(`Property: ${property.name || property.address || 'N/A'}`);
        if (property.unitNumber) lines.push(`Unit: ${property.unitNumber}`);
    }
    lines.push('------------------------------');
    lines.push(`Amount: ${kenyaUtils.formatKES(payment.amount)}`);
    lines.push(`Period: ${payment.period}`);
    lines.push(`Paid: ${kenyaUtils.formatDate(payment.paid_at || payment.paidAt || new Date().toISOString())}`);
    lines.push(`Status: Paid`);
    lines.push('------------------------------');
    lines.push('Thank you for your payment.');
    lines.push('Contact your landlord if you need a detailed invoice.');
    return lines.join('\n');
}

async function sendTenantReceipt(landlordId, tenant, payment) {
    const landlord = await queryOne('SELECT * FROM landlords WHERE id = $1', [landlordId]);
    const property = properties.find(p => p.id === tenant.property || tenant.assignedUnit?.propertyId);
    const whatsappBalance = Number(landlord?.whatsapp_balance || landlord?.whatsappBalance || 0);
    const smsBalance = Number(landlord?.sms_balance || landlord?.smsBalance || 0);

    if (whatsappBalance > 0) {
        const receiptText = buildReceiptMessage(payment, tenant, property, 'whatsapp');
        const whatsappResult = await whatsappProcessor.sendWhatsAppMessage(tenant.phone, receiptText);
        if (whatsappResult.success) {
            return { success: true, channel: 'whatsapp' };
        }
        if (smsBalance > 0) {
            const smsText = buildReceiptMessage(payment, tenant, property, 'sms');
            await sendSMS(tenant.phone, smsText);
            return { success: true, channel: 'sms', fallback: true };
        }
        return { success: false, error: whatsappResult.error || 'whatsapp_failed' };
    }

    if (smsBalance > 0) {
        const receiptText = buildReceiptMessage(payment, tenant, property, 'sms');
        return await sendSMS(tenant.phone, receiptText);
    }

    return { success: false, error: 'no_message_balance' };
}

class LandlordWhatsAppCommandProcessor {
    constructor() {
        this.commands = {
            'MENU': this.showMenu.bind(this),
            'HELP': this.showMenu.bind(this),
            'START': this.showMenu.bind(this),
            'ADD_PROPERTY': this.addProperty.bind(this),
            'ADD_TENANT': this.addTenant.bind(this),
            'RECORD_PAYMENT': this.recordPayment.bind(this),
            'PAYMENT_HISTORY': this.getPaymentHistory.bind(this),
            'TENANT_HISTORY': this.getPaymentHistory.bind(this),
            'BALANCE': this.checkTenantBalance.bind(this),
            'STATUS': this.getSystemStatus.bind(this),
            'STATS': this.getSystemStatus.bind(this),
            'LOG_COMPLAINT': this.logComplaint.bind(this),
            'VIEW_COMPLAINTS': this.viewComplaints.bind(this),
            'RESOLVE_COMPLAINT': this.resolveComplaint.bind(this)
        };
    }

    async process(sender, message, landlordData) {
        const cleanedMsg = message.trim().toUpperCase();
        const parts = cleanedMsg.split(' ');

        // Check for command
        const command = parts[0];
        const args = parts.slice(1);

        if (this.commands[command]) {
            return await this.commands[command](sender, args, landlordData);
        }

        // If no known command, provide help
        return {
            message: `Unrecognized command. Send *MENU* or *HELP* to see available landlord options.`
        };
    }

    async showMenu(sender, args, landlordData) {
        const menu = `
🏠 *PropertyHub Kenya - Landlord Menu*

Welcome ${landlordData.name}! Manage your properties and tenant flow via WhatsApp.

📊 *STATUS* - View system stats and balances
🏢 *ADD_PROPERTY* - Add a new property
👥 *ADD_TENANT* - Register a new tenant
🔖 *LOG_COMPLAINT* - Log a complaint for a tenant
📂 *VIEW_COMPLAINTS* - View recent tenant complaints
✅ *RESOLVE_COMPLAINT* - Mark a complaint resolved
💰 *RECORD_PAYMENT* - Record a rent payment
📈 *PAYMENT_HISTORY* - Check tenant payment history
💵 *BALANCE* - Check tenant balance

*Important:* If your WhatsApp balance is 0, the bot can still accept commands, but it cannot send payment receipts or tenant notifications on your behalf.

*Examples:*
ADD_PROPERTY Riverside Apartments, Westlands, Nairobi
ADD_TENANT John Doe, +254712345678, A1
LOG_COMPLAINT John Doe, water leak in kitchen
RECORD_PAYMENT John Doe, 15000, January 2024
VIEW_COMPLAINTS John Doe

Send the command followed by details separated by commas.
`.trim();
        return { message: menu, type: 'menu' };
    }

    async buildReceiptMessage(payment, tenant, property, channel = 'whatsapp') {
        const bold = channel === 'whatsapp' ? '*': '';
        const lines = [];
        lines.push(`${bold}PROPERTYHUB KENYA${bold}`);
        lines.push(`${bold}PAYMENT RECEIPT${bold}`);
        lines.push('------------------------------');
        lines.push(`Receipt No: RCP-${payment.id.substr(0, 8).toUpperCase()}`);
        lines.push(`Tenant: ${tenant.name}`);
        lines.push(`Phone: ${tenant.phone || 'N/A'}`);
        if (property) {
            lines.push(`Property: ${property.name || property.address || 'N/A'}`);
            if (property.unitNumber) lines.push(`Unit: ${property.unitNumber}`);
        }
        lines.push('------------------------------');
        lines.push(`Amount: ${kenyaUtils.formatKES(payment.amount)}`);
        lines.push(`Period: ${payment.period}`);
        lines.push(`Paid: ${kenyaUtils.formatDate(payment.paid_at || payment.paidAt || new Date().toISOString())}`);
        lines.push(`Status: Paid`);
        lines.push('------------------------------');
        lines.push('Thank you for your payment.');
        lines.push('If you have questions, contact your landlord.');
        return lines.join('\n');
    }

    async sendReceiptToTenant(landlordData, tenant, payment) {
        const property = properties.find(p => p.id === tenant.property || tenant.assignedUnit?.propertyId);
        const receiptTextWhatsApp = await this.buildReceiptMessage(payment, tenant, property, 'whatsapp');
        const receiptTextSms = await this.buildReceiptMessage(payment, tenant, property, 'sms');
        const whatsappBalance = Number(landlordData.whatsapp_balance || landlordData.whatsappBalance || 0);
        const smsBalance = Number(landlordData.sms_balance || landlordData.smsBalance || 0);

        if (whatsappBalance > 0) {
            const whatsappResult = await whatsappProcessor.sendWhatsAppMessage(tenant.phone, receiptTextWhatsApp);
            if (whatsappResult.success) {
                return { success: true, channel: 'whatsapp' };
            }
            if (smsBalance > 0) {
                await sendSMS(tenant.phone, receiptTextSms);
                return { success: true, channel: 'sms', fallback: true };
            }
            return { success: false, reason: 'whatsapp_failed', error: whatsappResult.error };
        }

        if (smsBalance > 0) {
            await sendSMS(tenant.phone, receiptTextSms);
            return { success: true, channel: 'sms' };
        }

        return { success: false, reason: 'no_message_balance' };
    }

    async addProperty(sender, args, landlordData) {
        if (args.length < 3) {
            return { message: '🏢 To add a property, provide: name, address, type\n\n*Example:* ADD_PROPERTY Riverside Apartments, Westlands Nairobi, Residential' };
        }

        const propertyDetails = args.join(' ').split(',');
        if (propertyDetails.length < 3) {
            return { message: 'Please separate details with commas: name, address, type' };
        }

        const [name, address, type] = propertyDetails.map(s => s.trim());

        const property = {
            id: generateId(),
            landlord_id: landlordData.id,
            name: name,
            address: address,
            type: type || 'Residential',
            status: 'active',
            monthly_rent: 0,
            tax_rate: 0,
            units: JSON.stringify([]),
            recurring_bills: JSON.stringify([]),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            await persistProperty(property);
            properties.push(property);

            return { message: `✅ Property "${name}" added successfully!\n\nProperty ID: ${property.id.substr(0, 8).toUpperCase()}\nAddress: ${address}\nType: ${type}\n\nYou can now add units and tenants to this property.` };
        } catch (error) {
            console.error('Error adding property:', error);
            return { message: '❌ Failed to add property. Please try again.' };
        }
    }

    async addTenant(sender, args, landlordData) {
        if (args.length < 3) {
            return { message: '👥 To add a tenant, provide: name, phone, unit\n\n*Example:* ADD_TENANT John Doe, +254712345678, A1' };
        }

        const tenantDetails = args.join(' ').split(',');
        if (tenantDetails.length < 3) {
            return { message: 'Please separate details with commas: name, phone, unit' };
        }

        const [name, phone, unit] = tenantDetails.map(s => s.trim());

        const tenant = {
            id: generateId(),
            landlord_id: landlordData.id,
            name: name,
            phone: kenyaUtils.formatPhone(phone),
            unit: unit,
            property: '', // Will be set when assigned
            rent: 0,
            status: 'active',
            method: 'mpesa',
            due_date: new Date().toISOString(),
            lease_end: null,
            assigned_unit: null,
            created_at: new Date().toISOString()
        };

        try {
            await persistTenant(tenant);
            tenants.push(tenant);

            return { message: `✅ Tenant "${name}" added successfully!\n\nPhone: ${tenant.phone}\nUnit: ${unit}\n\nTenant can now receive WhatsApp notifications and make payments.` };
        } catch (error) {
            console.error('Error adding tenant:', error);
            return { message: '❌ Failed to add tenant. Please try again.' };
        }
    }

    async recordPayment(sender, args, landlordData) {
        if (args.length < 3) {
            return { message: '💰 To record payment, provide: tenant_name, amount, period\n\n*Example:* RECORD_PAYMENT John Doe, 15000, January 2024' };
        }

        const paymentDetails = args.join(' ').split(',');
        if (paymentDetails.length < 3) {
            return { message: 'Please separate details with commas: tenant_name, amount, period' };
        }

        const [tenantName, amountStr, period] = paymentDetails.map(s => s.trim());
        const amount = parseInt(amountStr.replace(/[^\d]/g, ''));

        if (!amount || amount <= 0) {
            return { message: 'Invalid amount. Please provide a valid number.' };
        }

        // Find tenant by name (case insensitive)
        const tenant = tenants.find(t =>
            t.landlord_id === landlordData.id &&
            t.name.toLowerCase().includes(tenantName.toLowerCase())
        );

        if (!tenant) {
            return { message: `❌ Tenant "${tenantName}" not found. Please check the name and try again.` };
        }

        const payment = {
            id: generateId(),
            landlord_id: landlordData.id,
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            amount: amount,
            period: period,
            method: 'recorded',
            reference: `WA-${Date.now()}`,
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            status: 'paid',
            due_date: tenant.due_date,
            property_id: tenant.property
        };

        try {
            await persistPayment(payment);
            payments.push(payment);

            const receiptResult = await this.sendReceiptToTenant(landlordData, tenant, payment);
            let receiptMessage = 'A receipt has been sent to the tenant.';
            if (!receiptResult.success) {
                receiptMessage = 'Payment recorded, but the receipt could not be delivered because your WhatsApp and SMS balances are both empty. Please top up to notify the tenant.';
            } else if (receiptResult.channel === 'sms') {
                receiptMessage = 'Payment recorded successfully. Receipt was sent to the tenant via SMS because your WhatsApp balance is empty.';
            }

            return { message: `✅ Payment recorded successfully!\n\nTenant: ${tenant.name}\nAmount: ${kenyaUtils.formatKES(amount)}\nPeriod: ${period}\nReference: ${payment.reference}\n\n${receiptMessage}` };
        } catch (error) {
            console.error('Error recording payment:', error);
            return { message: '❌ Failed to record payment. Please try again.' };
        }
    }

    async getPaymentHistory(sender, args, landlordData) {
        if (args.length < 1) {
            return { message: '📈 To check payment history, provide tenant name\n\n*Example:* PAYMENT_HISTORY John Doe' };
        }

        const tenantName = args.join(' ').trim();

        // Find tenant by name
        const tenant = tenants.find(t =>
            t.landlord_id === landlordData.id &&
            t.name.toLowerCase().includes(tenantName.toLowerCase())
        );

        if (!tenant) {
            return { message: `❌ Tenant "${tenantName}" not found. Please check the name and try again.` };
        }

        const tenantPayments = payments.filter(p => p.tenant_id === tenant.id);
        const paidPayments = tenantPayments.filter(p => p.status === 'paid');
        const pendingPayments = tenantPayments.filter(p => p.status === 'pending' || p.status === 'overdue');

        let response = `📊 *Payment History for ${tenant.name}*\n\n`;

        if (paidPayments.length > 0) {
            response += `✅ *Paid Payments:*\n`;
            paidPayments.slice(-5).forEach(p => {
                response += `• ${kenyaUtils.formatKES(p.amount)} - ${p.period} (${kenyaUtils.formatDate(p.paid_at)})\n`;
            });
            response += `\n`;
        }

        if (pendingPayments.length > 0) {
            response += `⏳ *Pending Payments:*\n`;
            pendingPayments.forEach(p => {
                response += `• ${kenyaUtils.formatKES(p.amount)} - ${p.period} (Due: ${kenyaUtils.formatDate(p.due_date)})\n`;
            });
            response += `\n`;
        }

        const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

        response += `💰 *Summary:*\n`;
        response += `Total Paid: ${kenyaUtils.formatKES(totalPaid)}\n`;
        response += `Total Pending: ${kenyaUtils.formatKES(totalPending)}\n`;
        response += `Payment Method: ${tenant.method}`;

        return { message: response };
    }

    async checkTenantBalance(sender, args, landlordData) {
        if (args.length < 1) {
            return { message: '💵 To check tenant balance, provide tenant name\n\n*Example:* BALANCE John Doe' };
        }

        const tenantName = args.join(' ').trim();

        // Find tenant by name
        const tenant = tenants.find(t =>
            t.landlord_id === landlordData.id &&
            t.name.toLowerCase().includes(tenantName.toLowerCase())
        );

        if (!tenant) {
            return { message: `❌ Tenant "${tenantName}" not found. Please check the name and try again.` };
        }

        const tenantPayments = payments.filter(p => p.tenant_id === tenant.id);
        const totalDue = tenantPayments.reduce((sum, p) => {
            if (p.status === 'pending' || p.status === 'overdue') return sum + p.amount;
            return sum;
        }, 0);
        const totalPaid = tenantPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

        let response = `💰 *Balance for ${tenant.name}*\n\n`;
        response += `Total Paid: ${kenyaUtils.formatKES(totalPaid)}\n`;
        response += `Current Balance Due: ${kenyaUtils.formatKES(totalDue)}\n`;
        response += `Last Payment: ${tenantPayments.filter(p => p.status === 'paid').length > 0 ? kenyaUtils.formatDate(tenantPayments.filter(p => p.status === 'paid').sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))[0].paid_at) : 'None'}\n\n`;

        if (totalDue > 0) {
            response += `📞 Send payment reminder to tenant? Reply with REMIND ${tenant.name}`;
        } else {
            response += `✅ Account is up to date!`;
        }

        return { message: response };
    }

    async getSystemStatus(sender, args, landlordData) {
        const landlordProperties = properties.filter(p => p.landlord_id === landlordData.id);
        const landlordTenants = tenants.filter(t => t.landlord_id === landlordData.id);
        const landlordPayments = payments.filter(p => p.landlord_id === landlordData.id);

        const totalRevenue = landlordPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
        const pendingRevenue = landlordPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
        const overdueCount = landlordPayments.filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.due_date) < new Date())).length;

        let response = `📊 *System Status for ${landlordData.name}*\n\n`;
        response += `🏢 Properties: ${landlordProperties.length}\n`;
        response += `👥 Tenants: ${landlordTenants.length}\n`;
        response += `💰 Total Revenue: ${kenyaUtils.formatKES(totalRevenue)}\n`;
        response += `⏳ Pending Revenue: ${kenyaUtils.formatKES(pendingRevenue)}\n`;
        response += `⚠️ Overdue Payments: ${overdueCount}\n\n`;

        response += `💳 *Billing Status:*\n`;
        response += `Wallet Balance: ${kenyaUtils.formatKES(landlordData.wallet_balance || 0)}\n`;
        response += `WhatsApp Balance: ${landlordData.whatsapp_balance || 0} messages\n`;
        response += `SMS Balance: ${landlordData.sms_balance || 0} messages\n`;
        response += `Current Plan: ${landlordData.current_plan || 'Free'}\n\n`;

        response += `📱 WhatsApp Integration: ${metaClient ? '✅ Active' : '⚠️ Simulated'}`;

        return { message: response };
    }

    async logComplaint(sender, args, landlordData) {
        if (args.length < 2) {
            return { message: '📝 To log a complaint, provide tenant name and complaint details.\n\nExample: LOG_COMPLAINT John Doe, water leak in kitchen' };
        }

        const [tenantName, ...complaintParts] = args.join(' ').split(',');
        const description = complaintParts.join(',').trim();

        if (!description) {
            return { message: 'Please include details of the complaint after the tenant name.' };
        }

        const tenant = tenants.find(t =>
            t.landlord_id === landlordData.id &&
            t.name.toLowerCase().includes(tenantName.trim().toLowerCase())
        );

        if (!tenant) {
            return { message: `❌ Tenant "${tenantName.trim()}" not found. Use the exact tenant name.` };
        }

        const complaint = {
            id: generateId(),
            tenantId: tenant.id,
            tenantName: tenant.name,
            unit: tenant.unit || 'N/A',
            property: tenant.property || 'N/A',
            category: 'General',
            description: description,
            priority: 'medium',
            status: 'pending',
            source: 'landlord',
            createdAt: new Date().toISOString()
        };

        complaints.push(complaint);
        persistComplaint(complaint);

        return { message: `✅ Complaint logged for ${tenant.name}.\nReference: #${complaint.id.slice(-6).toUpperCase()}\nStatus: pending` };
    }

    async viewComplaints(sender, args, landlordData) {
        const tenantName = args.join(' ').trim();
        let filtered = complaints.filter(c => c.tenantId && tenants.some(t => t.id === c.tenantId && t.landlord_id === landlordData.id));

        if (tenantName) {
            filtered = filtered.filter(c => c.tenantName.toLowerCase().includes(tenantName.toLowerCase()));
        }

        if (filtered.length === 0) {
            return { message: tenantName
                ? `No complaints found for tenant "${tenantName}".`
                : 'No complaints found for your tenants.'
            };
        }

        const topComplaints = filtered.slice(-5).reverse();
        let response = `📋 *Recent Complaints*\n\n`;
        topComplaints.forEach((c) => {
            response += `• ${c.tenantName}: ${c.description.slice(0, 60)}...\n  Status: ${c.status}\n  Ref: ${c.id.slice(-6).toUpperCase()}\n\n`;
        });

        response += 'Use RESOLVE_COMPLAINT <reference> to mark a complaint resolved.';
        return { message: response };
    }

    async resolveComplaint(sender, args, landlordData) {
        if (args.length < 1) {
            return { message: '✅ To resolve a complaint, provide the complaint reference.\n\nExample: RESOLVE_COMPLAINT ABC123' };
        }

        const reference = args.join(' ').trim().toUpperCase();
        const complaint = complaints.find(c => c.id.slice(-6).toUpperCase() === reference && tenants.some(t => t.id === c.tenantId && t.landlord_id === landlordData.id));

        if (!complaint) {
            return { message: `❌ Complaint reference "${reference}" not found.` };
        }

        complaint.status = 'resolved';
        await query('UPDATE complaints SET status = $1 WHERE id = $2', ['resolved', complaint.id]);

        const tenant = tenants.find(t => t.id === complaint.tenantId);
        if (tenant && tenant.phone) {
            const message = `✅ Your complaint has been resolved.\nReference: #${complaint.id.slice(-6).toUpperCase()}\nDescription: ${complaint.description}\nStatus: resolved.`;
            whatsappProcessor.sendWhatsAppMessage(tenant.phone, message).catch(err => console.error('Failed to send resolution message:', err));
        }

        return { message: `✅ Complaint ${reference} marked as resolved.` };
    }
}

function normalizePhoneForSearch(phone) {
  if (!phone) return '';
  const formatted = kenyaUtils.formatPhone(phone);
  return formatted.replace(/\D/g, '');
}

async function findTenantByPhone(phone) {
  const normalized = normalizePhoneForSearch(phone);

  // Query database for any tenant with this phone number (we'll match landlord later if needed)
  try {
    const result = await queryOne(
      `SELECT * FROM tenants WHERE replace(replace(phone,' ',''),'+','') = $1`,
      [normalized.replace(/[\s+]/g, '')]
    );
    return result ? normalizeTenantRow(result) : null;
  } catch (error) {
    console.error('Error finding tenant by phone:', error);
    return null;
  }
}

async function findLandlordByPhone(phone) {
  const normalized = normalizePhoneForSearch(phone);

  // Query database for landlord with this phone number
  try {
    const result = await queryOne(
      `SELECT * FROM landlords WHERE replace(replace(phone,' ',''),'+','') = $1`,
      [normalized.replace(/[\s+]/g, '')]
    );
    return result || null;
  } catch (error) {
    console.error('Error finding landlord by phone:', error);
    return null;
  }
}

function getPaymentsByTenant(tenantId) {
  return db.prepare('SELECT * FROM payments WHERE tenant_id = ?').all(tenantId);
}

function saveComplaint(complaint) {
  db.prepare(`
    INSERT INTO complaints (id, tenant_id, tenant_name, unit, property, category, description, priority, status, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    complaint.id, complaint.tenantId, complaint.tenantName, complaint.unitNumber,
    '', complaint.category || 'General', complaint.complaint,
    complaint.priority || 'medium', 'pending', 'tenant', new Date().toISOString()
  );
}

const whatsappProcessor = new WhatsAppCommandProcessor();
const landlordWhatsappProcessor = new LandlordWhatsAppCommandProcessor();

// ==================== PROPERTY ROUTES ====================

app.get('/api/properties', (req, res) => {
    res.json(properties);
});

app.get('/api/properties/:id', (req, res) => {
    const property = properties.find(p => p.id === req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(property);
});

app.post('/api/properties', (req, res) => {
    const property = {
        id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'vacant',
        units: req.body.units || []
    };
    properties.push(property);
    persistProperty(property);
    res.status(201).json(property);
});

app.put('/api/properties/:id', (req, res) => {
    const index = properties.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Property not found' });

    properties[index] = { ...properties[index], ...req.body, updatedAt: new Date().toISOString() };
    persistProperty(properties[index]);
    res.json(properties[index]);
});

app.delete('/api/properties/:id', (req, res) => {
    properties = properties.filter(p => p.id !== req.params.id);
    deleteProperty(req.params.id);
    res.status(204).send();
});

// ==================== UNIT ROUTES ====================

app.post('/api/properties/:propertyId/units', (req, res) => {
    const property = properties.find(p => p.id === req.params.propertyId);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const unit = {
        id: generateId(),
        ...req.body,
        propertyId: property.id,
        status: 'vacant'
    };

    property.units.push(unit);
    persistProperty(property);
    res.status(201).json(unit);
});

app.put('/api/properties/:propertyId/units/:unitId', (req, res) => {
    const property = properties.find(p => p.id === req.params.propertyId);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const unit = property.units.find(u => u.id === req.params.unitId);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    Object.assign(unit, req.body, { updatedAt: new Date().toISOString() });
    persistProperty(property);
    res.json(unit);
});

// Get all units across properties
app.get('/api/units', (req, res) => {
    const allUnits = properties.flatMap(p =>
        (p.units || []).map(u => ({
            ...u,
            propertyId: p.id,
            propertyName: p.name,
            propertyAddress: p.address
        }))
    );
    res.json(allUnits);
});

// ==================== TENANT ROUTES ====================

app.get('/api/tenants', (req, res) => {
    res.json(tenants);
});

app.get('/api/tenants/:id', (req, res) => {
    const tenant = tenants.find(t => t.id === req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
});

// Get tenant by phone number (for WhatsApp lookup)
app.get('/api/tenants/by-phone/:phone', (req, res) => {
    const normalizedPhone = kenyaUtils.formatPhone(req.params.phone);
    const tenant = tenants.find(t => kenyaUtils.formatPhone(t.phone) === normalizedPhone);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
});

app.get('/api/tenants/:id/history', (req, res) => {
    const tenant = tenants.find(t => t.id === req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const tenantPayments = payments.filter(p => p.tenantId === req.params.id);
    const tenantReceipts = tenantPayments.filter(p => p.status === 'paid');
    const overduePayments = tenantPayments.filter(p =>
        p.status === 'overdue' || new Date(p.dueDate) < new Date() && p.status === 'pending'
    );
    const tenantComplaints = complaints.filter(c => c.tenantId === req.params.id);
    const tenantMaintenance = maintenanceRequests.filter(m => m.tenantId === req.params.id);
    const tenantRelocation = relocationRequests.filter(r => r.tenantId === req.params.id);

    res.json({
        ...tenant,
        payments: tenantPayments,
        receipts: tenantReceipts,
        overduePayments,
        totalPaid: tenantReceipts.reduce((sum, p) => sum + p.amount, 0),
        totalOverdue: overduePayments.reduce((sum, p) => sum + p.amount, 0),
        complaints: tenantComplaints,
        maintenance: tenantMaintenance,
        relocation: tenantRelocation
    });
});

app.post('/api/tenants', (req, res) => {
    const tenant = {
        id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    tenants.push(tenant);
    persistTenant(tenant);
    res.status(201).json(tenant);
});

app.put('/api/tenants/:id', (req, res) => {
    const index = tenants.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Tenant not found' });

    tenants[index] = { ...tenants[index], ...req.body, updatedAt: new Date().toISOString() };
    persistTenant(tenants[index]);
    res.json(tenants[index]);
});

app.post('/api/tenants/:tenantId/assign', (req, res) => {
    const tenant = tenants.find(t => t.id === req.params.tenantId);
    const property = properties.find(p => p.id === req.body.propertyId);
    const unit = property?.units.find(u => u.id === req.body.unitId);

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!property || !unit) return res.status(404).json({ error: 'Property or unit not found' });

    tenant.assignedUnit = {
        propertyId: property.id,
        unitId: unit.id,
        unitNumber: unit.unitNumber
    };
    unit.status = 'occupied';
    unit.tenantId = tenant.id;
    property.status = 'occupied';

    persistTenant(tenant);
    persistProperty(property);

// Send welcome WhatsApp message if enabled
if (metaClient && tenant.phone) {
        whatsappProcessor.sendWhatsAppMessage(tenant.phone,
`🏠 *Welcome to ${property.name}!*\n\nHi ${tenant.name}, your account has been activated.\n\nSend *MENU* anytime to see what you can do via WhatsApp.\n\nThank you!`
        );
    }

    res.json({ tenant, unit });
});

// ==================== PAYMENT ROUTES ====================

app.get('/api/payments', (req, res) => {
    res.json(payments);
});

app.get('/api/payments/tenant/:tenantId', (req, res) => {
    const tenantPayments = payments.filter(p => p.tenantId === req.params.tenantId);
    res.json(tenantPayments);
});

app.post('/api/payments', (req, res) => {
    const payment = {
        id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: req.body.status || 'pending'
    };
    payments.push(payment);
    persistPayment(payment);
    res.status(201).json(payment);
});

app.put('/api/payments/:id/status', async (req, res) => {
    const payment = payments.find(p => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    payment.status = req.body.status;
    payment.updatedAt = new Date().toISOString();

    if (req.body.status === 'paid') {
        payment.paidAt = new Date().toISOString();

        const tenant = tenants.find(t => t.id === payment.tenantId);
        if (tenant && tenant.phone) {
            const sendResult = await sendTenantReceipt(payment.landlord_id, tenant, payment);
            if (!sendResult.success) {
                console.log(`⚠️ Cannot send receipt for payment ${payment.id}: ${sendResult.error || 'no balance'}`);
            }
        }
    }

    persistPayment(payment);
    res.json(payment);
});

app.get('/api/payments/overdue', (req, res) => {
    const now = new Date();
    const overdue = payments.filter(p =>
        (p.status === 'pending' || p.status === 'overdue') && new Date(p.dueDate) < now
    );
    res.json(overdue);
});

// Generate receipt PDF or JSON
app.get('/api/receipts/:paymentId', (req, res) => {
    const payment = payments.find(p => p.id === req.params.paymentId);
    if (!payment || payment.status !== 'paid') {
        return res.status(404).json({ error: 'Receipt not available' });
    }

    const tenant = tenants.find(t => t.id === payment.tenantId);
    const unit = tenant?.assignedUnit;
    const property = unit ? properties.find(p => p.id === unit.propertyId) : null;

    const receipt = {
        receiptNumber: `RCP-${payment.id.substr(0, 8).toUpperCase()}`,
        payment: {
            amount: payment.amount,
            period: payment.period,
            dueDate: payment.dueDate,
            paidAt: payment.paidAt
        },
        tenant: {
            name: tenant?.name,
            phone: tenant?.phone,
            email: tenant?.email
        },
        property: {
            name: property?.name,
            address: property?.address,
            unitNumber: unit?.unitNumber
        },
        generatedAt: new Date().toISOString(),
        currency: 'KES'
    };

    res.json(receipt);
});

// ==================== COMPLAINTS ROUTES ====================

app.get('/api/complaints', (req, res) => {
    const { status, tenantId } = req.query;
    let result = complaints;
    if (status) result = result.filter(c => c.status === status);
    if (tenantId) result = result.filter(c => c.tenantId === tenantId);
    res.json(result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/complaints', (req, res) => {
    const complaint = {
        id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    complaints.push(complaint);
    persistComplaint(complaint);
    res.status(201).json(complaint);
});

app.put('/api/complaints/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const newStatus = req.body.status;

        // Get current complaint
        const currentComplaint = await queryOne('SELECT * FROM complaints WHERE id = $1', [id]);
        if (!currentComplaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const oldStatus = currentComplaint.status;

        // Update complaint
        await query(
            'UPDATE complaints SET status = $1 WHERE id = $2',
            [newStatus, id]
        );

        // Get updated complaint
        const updatedComplaint = await queryOne('SELECT * FROM complaints WHERE id = $1', [id]);
        const normalizedComplaint = normalizeComplaintRow(updatedComplaint);

        // Send notification to tenant if status changed to resolved
        if (oldStatus !== 'resolved' && newStatus === 'resolved') {
            const tenantResult = await queryOne('SELECT * FROM tenants WHERE id = $1', [normalizedComplaint.tenantId]);
            const tenant = tenantResult ? normalizeTenantRow(tenantResult) : null;
            if (tenant && tenant.phone) {
                const ref = normalizedComplaint.id.slice(-6).toUpperCase();
                const message = `✅ *Complaint Resolved!*\n\nReference: #${ref}\nCategory: ${normalizedComplaint.category}\nStatus: Resolved\n\nThank you for your patience. Reply MENU for more options.`;

                // Send WhatsApp message
                whatsappProcessor.sendWhatsAppMessage(tenant.phone, message).catch(err => {
                    console.error('Failed to send resolution message:', err);
                });
            }
        }

        res.json(normalizedComplaint);
    } catch (error) {
        console.error('Error updating complaint:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== MAINTENANCE ROUTES ====================

app.get('/api/maintenance', (req, res) => {
    const { status, propertyId } = req.query;
    let result = maintenanceRequests;
    if (status) result = result.filter(m => m.status === status);
    if (propertyId) result = result.filter(m => m.propertyId === propertyId);
    res.json(result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/maintenance', (req, res) => {
    const maintenance = {
        id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'pending',
        priority: req.body.priority || 'normal'
    };
    maintenanceRequests.push(maintenance);
    res.status(201).json(maintenance);
});

app.put('/api/maintenance/:id', (req, res) => {
    const index = maintenanceRequests.findIndex(m => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Maintenance request not found' });

    maintenanceRequests[index] = { ...maintenanceRequests[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(maintenanceRequests[index]);
});

// ==================== RELOCATION ROUTES ====================

app.get('/api/relocation', (req, res) => {
    const { status, tenantId } = req.query;
    let result = relocationRequests;
    if (status) result = result.filter(r => r.status === status);
    if (tenantId) result = result.filter(r => r.tenantId === tenantId);
    res.json(result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/relocation', (req, res) => {
    const relocation = {
        id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    relocationRequests.push(relocation);
    res.status(201).json(relocation);
});

app.put('/api/relocation/:id', (req, res) => {
    const index = relocationRequests.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Relocation request not found' });

    relocationRequests[index] = { ...relocationRequests[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(relocationRequests[index]);
});

// ==================== WHATSAPP WEBHOOK ROUTES ====================

// WhatsApp verification endpoint (GET) - Meta API handshake
app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('✅ WhatsApp webhook verified');
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

// WhatsApp incoming message webhook (POST) - Meta Cloud API
app.post('/api/whatsapp/webhook', async (req, res) => {
    console.log('WHATSAPP WEBHOOK POST RECEIVED', {
        path: req.path,
        headers: {
            'x-hub-signature': req.headers['x-hub-signature'],
            'content-type': req.headers['content-type'],
        },
        body: req.body
    });

    try {
        const body = req.body;

        // Check if this is a WhatsApp message (Meta API format)
        if (body.object === 'whatsapp_business_account') {
            const entry = body.entry?.[0];
            const changes = entry?.changes;

            for (const change of changes || []) {
                const value = change.value;
                const messages = value.messages;

                if (messages && messages.length > 0) {
                    for (const message of messages) {
                        const from = message.from; // sender's phone number
                        const rawText = message.text?.body || '';
                        const text = rawText.toUpperCase();
                        const messageId = message.id;

                        const tenant = await findTenantByPhone(from);
                        const landlord = await findLandlordByPhone(from);

                        // Determine if this is a landlord or tenant message
                        const isLandlord = !!landlord;
                        const isTenant = !!tenant;

                        // Save inbound message
                        const inboundId = generateId();
                        await query(
                          `INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, meta_message_id, from_phone)
                           VALUES ($1, $2, 'in', $3, $4, 'tenant', $5, $6)`,
                          [inboundId, tenant?.id || from, rawText, new Date().toISOString(), messageId, from]
                        );

                        // Detect if this is a complaint or maintenance request (tenant only)
                        const isComplaint = !isLandlord && (text.includes('COMPLAIN') || text.includes('ISSUE') || text.includes('PROBLEM'));
                        const isMaintenance = !isLandlord && (text.includes('MAINTENANCE') || text.includes('MAINTAIN') || text.includes('FIX') || text.includes('REPAIR'));
                        
                        if (isTenant && (isComplaint || isMaintenance)) {
                          // Save as complaint/maintenance record for landlord to address
                          const complaintId = generateId();
                          const category = isMaintenance ? 'Maintenance' : 'General';

                          // Get landlord_id from tenant record
                          const landlordId = tenant?.landlord_id || 'unknown';

                          try {
                            await query(
                              `INSERT INTO complaints (id, landlord_id, tenant_id, tenant_name, unit, property, category, description, priority, status, source, created_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                              [
                                complaintId,
                                landlordId,
                                tenant?.id || from,
                                tenant?.name || 'Unknown Tenant',
                                tenant?.unit || 'N/A',
                                tenant?.property || 'N/A',
                                category,
                                rawText,
                                'medium',
                                'pending',
                                'whatsapp',
                                new Date().toISOString()
                              ]
                            );
                            console.log('Inserted complaint:', complaintId, 'for landlord:', landlordId, 'tenant:', tenant?.name || from);
                          } catch (error) {
                            console.error('Error inserting complaint:', error);
                          }
                          
                          // Send acknowledgment to tenant
                          const ackMessage = `✅ Thank you for reaching out!\n\nWe received your ${isMaintenance ? 'maintenance request' : 'complaint'}:\n"${rawText}"\n\nOur team will review and respond within 23 hours. Reference: #${complaintId.slice(-6).toUpperCase()}`;
                          await whatsappProcessor.sendWhatsAppMessage(from, ackMessage);
                          
                          const outboundId = generateId();
                          await query(
                            `INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, from_phone, to_phone)
                             VALUES ($1, $2, 'out', $3, $4, 'bot', $5, $6)`,
                            [outboundId, tenant?.id || from, ackMessage, new Date().toISOString(), metaPhoneNumberId, from]
                          );
                        } else {
                          // Process as command - route to appropriate processor
                          let response;
                          if (isLandlord) {
                            response = await landlordWhatsappProcessor.process(from, text || 'MENU', landlord);
                          } else if (isTenant) {
                            response = await whatsappProcessor.process(from, text || 'MENU', tenant);
                          } else {
                            // Unknown sender - assume tenant and show menu
                            response = await whatsappProcessor.process(from, 'MENU', null);
                          }

                          if (response.message) {
                            await whatsappProcessor.sendWhatsAppMessage(from, response.message);
                            
                            const outboundId = generateId();
                            await query(
                              `INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel)
                               VALUES ($1, $2, 'out', $3, $4, 'bot')`,
                              [outboundId, tenant?.id || landlord?.id || from, response.message, new Date().toISOString()]
                            );
                          }
                        }

                        // Push notification for landlord dashboard
                        if (isTenant && (isComplaint || isMaintenance)) {
                          await query(
                            `INSERT INTO notifications (id, landlord_id, type, title, body, created_at, read)
                             VALUES ($1, $2, $3, $4, $5, $6, false)`,
                            [
                              generateId(),
                              tenant?.landlord_id || 'unknown',
                              isMaintenance ? 'maintenance' : 'complaint',
                              `${tenant?.name || from} - ${isMaintenance ? 'Maintenance' : 'Complaint'}`,
                              `${rawText.slice(0, 80)}`,
                              new Date().toISOString()
                            ]
                          );
                        }
                    }
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        res.sendStatus(500);
    }
});

// Send WhatsApp message manually (API endpoint)
app.post('/api/whatsapp/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
    }

    const result = await whatsappProcessor.sendWhatsAppMessage(to, message);
    res.json(result);
});

// Get real tenant threads with pending complaints/maintenance
app.get('/api/whatsapp/threads', async (req, res) => {
    try {
        // Get all pending complaints/maintenance from WhatsApp
        const complaintsResult = await query(`
            SELECT * FROM complaints
            WHERE source = 'whatsapp' AND status = 'pending'
            ORDER BY created_at DESC
        `);

        const complaints = complaintsResult.rows || complaintsResult;

        const threads = await Promise.all(complaints.map(async (complaint) => {
            // Get all messages in the thread related to this complaint
            const messagesResult = await query(`
                SELECT * FROM wa_messages
                WHERE tenant_id = $1
                ORDER BY timestamp ASC
            `, [complaint.tenant_id]);

            const messages = messagesResult.rows || messagesResult;

            return {
                id: complaint.id,
                tenantId: complaint.tenant_id,
                tenantName: complaint.tenant_name,
                unit: complaint.unit,
                property: complaint.property,
                category: complaint.category,
                description: complaint.description,
                priority: complaint.priority,
                status: complaint.status,
                createdAt: complaint.created_at,
                messages: messages.map(m => ({
                    id: m.id,
                    direction: m.direction,
                    body: m.body,
                    timestamp: m.timestamp,
                    channel: m.channel
                }))
            };
        }));

        res.json(threads);
    } catch (error) {
        console.error('Error fetching threads:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get messages for a specific tenant (real thread)
app.get('/api/whatsapp/thread/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;

        // Get messages for this tenant
        const messagesResult = await query(`
            SELECT * FROM wa_messages
            WHERE tenant_id = $1
            ORDER BY timestamp ASC
        `, [tenantId]);

        const messages = messagesResult.rows || messagesResult;

        // Get related complaint/maintenance
        const complaintResult = await queryOne(`
            SELECT * FROM complaints
            WHERE tenant_id = $1 AND source = 'whatsapp'
            ORDER BY created_at DESC
            LIMIT 1
        `, [tenantId]);

        res.json({
            tenantId,
            complaint: complaintResult ? {
                id: complaintResult.id,
                category: complaintResult.category,
                description: complaintResult.description,
                priority: complaintResult.priority,
                status: complaintResult.status,
                createdAt: complaintResult.created_at
            } : null,
            messages: messages.map(m => ({
                id: m.id,
                direction: m.direction,
                body: m.body,
                timestamp: m.timestamp,
                channel: m.channel
            }))

        });
    } catch (error) {
        console.error('Error fetching thread:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send landlord reply to tenant via WhatsApp (within 23 hours)
// Send landlord reply to tenant via WhatsApp
app.post('/api/whatsapp/reply', async (req, res) => {
    try {
        const { complaintId, tenantId, message } = req.body;

        if (!tenantId || !message) {
            return res.status(400).json({ error: 'Tenant ID and message are required' });
        }

        // Look up tenant in memory first, then database
        let tenant = tenants.find(t => t.id === tenantId);
        if (!tenant) {
            try {
                const tenantResult = await queryOne('SELECT * FROM tenants WHERE id = $1', [tenantId]);
                if (tenantResult) tenant = normalizeTenantRow(tenantResult);
            } catch(e) {}
        }

        if (!tenant || !tenant.phone) {
            return res.status(404).json({ error: 'Tenant not found or no phone number' });
        }

        const result = await whatsappProcessor.sendWhatsAppMessage(tenant.phone, message);

        if (result.success) {
            const msgId = generateId();
            const timestamp = new Date().toISOString();

            // Save to memory
            whatsappMessages.push({
                id: msgId, tenantId, direction: 'out',
                body: message, timestamp, channel: 'landlord',
            });

            // Try database
            try {
                await query(`
                    INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, meta_message_id)
                    VALUES ($1, $2, 'out', $3, $4, 'landlord', $5)
                `, [msgId, tenantId, message, timestamp, result.messageId || '']);

                if (complaintId) {
                    await query('UPDATE complaints SET status = $1 WHERE id = $2', ['in_progress', complaintId]);
                }
            } catch(e) {}

            // Also update in-memory complaint status
            if (complaintId) {
                const c = complaints.find(c => c.id === complaintId);
                if (c) c.status = 'in_progress';
            }

            res.json({ success: true, messageId: msgId, sentAt: timestamp });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error sending reply:', error);
        res.status(500).json({ error: error.message });
    }
});
// app.post('/api/whatsapp/reply', async (req, res) => {
//     try {
//         const { complaintId, tenantId, message } = req.body;

//         if (!tenantId || !message) {
//             return res.status(400).json({ error: 'Tenant ID and message are required' });
//         }

//         // Get tenant phone number
//         const tenant = db.prepare('SELECT phone FROM tenants WHERE id = ?').get(tenantId);
//         if (!tenant || !tenant.phone) {
//             return res.status(404).json({ error: 'Tenant not found or no phone number' });
//         }

//         // Send the message via WhatsApp
//         const result = await whatsappProcessor.sendWhatsAppMessage(tenant.phone, message);

//         if (result.success) {
//             // Save as outbound message
//             const messageId = generateId();
//             db.prepare(`
//                 INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, meta_message_id)
//                 VALUES (?, ?, 'out', ?, ?, 'landlord', ?)
//             `).run(messageId, tenantId, message, new Date().toISOString(), result.messageId || '');

//             // Update complaint status if provided
//             if (complaintId) {
//                 db.prepare(`
//                     UPDATE complaints 
//                     SET status = 'in_progress' 
//                     WHERE id = ?
//                 `).run(complaintId);
//             }

//             res.json({ success: true, messageId, sentAt: new Date().toISOString() });
//         } else {
//             res.status(500).json({ success: false, error: result.error });
//         }
//     } catch (error) {
//         console.error('Error sending reply:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// Update complaint status
// app.put('/api/complaints/:id', (req, res) => {
//     try {
//         const { status } = req.body;
//         db.prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, req.params.id);
//         res.json({ success: true });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// Get WhatsApp conversations
app.get('/api/whatsapp/conversations', (req, res) => {
    const conversations = {};

    whatsappMessages.forEach(msg => {
        const otherParty = msg.direction === 'inbound' ? msg.from : msg.to;
        if (!conversations[otherParty]) {
            conversations[otherParty] = {
                phone: otherParty,
                lastMessage: msg.body,
                lastAt: msg.timestamp,
                unread: 0,
                messages: []
            };
        }
        conversations[otherParty].messages.push(msg);
        if (msg.direction === 'inbound' && msg.status === 'received') {
            conversations[otherParty].unread++;
        }
    });

    res.json(Object.values(conversations));
});

// Get messages for a specific conversation
app.get('/api/whatsapp/messages/:phone', (req, res) => {
    const phone = req.params.phone;
    const messages = whatsappMessages.filter(m => m.from === phone || m.to === phone)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(messages);
});

// ==================== NOTIFICATION ROUTES ====================

app.post('/api/notifications', authenticateToken, async (req, res) => {
    const { recipient, message, type = 'whatsapp' } = req.body;
    const landlordId = req.landlord.id;

    const notification = {
        id: generateId(),
        landlord_id: landlordId,
        recipient,
        message,
        type,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'queued',
        title: type === 'whatsapp' ? 'WhatsApp message' : 'Notification',
        body: message,
        read: false
    };

    notifications.push(notification);
    persistNotification(notification);

    if (type === 'whatsapp' && metaClient) {
        const result = await whatsappProcessor.sendWhatsAppMessage(recipient, message);
        notification.status = result.success ? 'sent' : 'failed';
    } else {
        notification.status = 'sent';
    }

    res.status(201).json(notification);
});

app.post('/api/notifications/bulk', authenticateToken, async (req, res) => {
    const { recipients, message, type = 'whatsapp' } = req.body;
    const landlordId = req.landlord.id;
    const sentNotifications = [];

    for (const recipient of recipients) {
        const notification = {
            id: generateId(),
            landlord_id: landlordId,
            recipient,
            message,
            type,
            sentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'queued',
            title: type === 'whatsapp' ? 'WhatsApp message' : 'Notification',
            body: message,
            read: false
        };

        if (type === 'whatsapp' && metaClient) {
            const result = await whatsappProcessor.sendWhatsAppMessage(recipient, message);
            notification.status = result.success ? 'sent' : 'failed';
        } else {
            notification.status = 'sent';
        }

        sentNotifications.push(notification);
        persistNotification(notification);
    }

    notifications.push(...sentNotifications);
    res.status(201).json({ sent: sentNotifications.length, notifications: sentNotifications });
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rows = await queryAll('SELECT * FROM notifications WHERE landlord_id = $1 ORDER BY created_at DESC', [landlordId]);
        res.json(rows.map(normalizeNotificationRow));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/properties', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rows = await queryAll('SELECT * FROM properties WHERE landlord_id = $1', [landlordId]);
        res.json(rows.map(normalizePropertyRow));
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/tenants', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rows = await queryAll('SELECT * FROM tenants WHERE landlord_id = $1', [landlordId]);
        res.json(rows.map(normalizeTenantRow));
    } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/payments', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rows = await queryAll('SELECT * FROM payments WHERE landlord_id = $1', [landlordId]);
        res.json(rows.map(normalizePaymentRow));
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get complaints for authenticated landlord
app.get('/api/sync/complaints', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rawRows = await queryAll('SELECT * FROM complaints WHERE landlord_id = $1 ORDER BY created_at DESC', [landlordId]);
        console.log(`Complaints for landlord ${landlordId}:`, rawRows.length);
        const rows = rawRows.map(normalizeComplaintRow);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/notifications', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rows = await queryAll('SELECT * FROM notifications WHERE landlord_id = $1 ORDER BY created_at DESC', [landlordId]);
        res.json(rows.map(normalizeNotificationRow));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/whatsapp', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.landlord.id;
        const rows = await queryAll('SELECT * FROM wa_messages WHERE landlord_id = $1 ORDER BY timestamp ASC', [landlordId]);
        res.json(rows.map(normalizeWaMessageRow));
    } catch (error) {
        console.error('Error fetching wa messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== OTP ROUTES ====================

// Send OTP for phone verification
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone, purpose } = req.body;
    console.log(`📨 Send OTP request: phone=${phone}, purpose=${purpose}`);

    if (!phone) {
      console.log(`❌ Phone number missing`);
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!kenyaUtils.isValidKenyanPhone(phone)) {
      console.log(`❌ Invalid Kenyan phone: ${phone}`);
      return res.status(400).json({ error: 'Invalid Kenyan phone number' });
    }

    const normalizedPhone = kenyaUtils.formatPhone(phone);
    const otpPurpose = purpose || 'registration';

    if (otpPurpose === 'registration') {
      const canSend = await otpPolicy.canSendRegistrationOtp(normalizedPhone);
      if (!canSend) {
        console.log(`⚠️ OTP rate limit reached for ${normalizedPhone}`);
        return res.status(429).json({
          error: 'OTP limit reached. Please use the code already sent or try again tomorrow.',
          retryAfter: '24 hours'
        });
      }
    }

    const result = await sendOTP(phone, otpPurpose);

    if (result.success) {
      console.log(`✅ OTP sent successfully to ${phone}`);
      res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      console.log(`❌ Failed to send OTP: ${result.error}`);
      res.status(500).json({ error: result.error || 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('❌ Send OTP endpoint error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP code
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    console.log(`📨 Verify OTP request: phone=${phone}, code=${code}`);

    if (!phone || !code) {
      console.log(`❌ Missing required fields: phone=${!!phone}, code=${!!code}`);
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    const result = await verifyOTP(phone, code);

    if (result.success) {
      console.log(`✅ OTP verification successful for ${phone}`);
      res.json({ success: true, message: 'Phone verified successfully' });
    } else {
      console.log(`❌ OTP verification failed: ${result.error}`);
      res.status(400).json({ error: result.error || 'Invalid verification code' });
    }
  } catch (error) {
    console.error('❌ Verify OTP endpoint error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Landlord registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, company, city, password, preferredChannel, collectionMonthStart } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if landlord already exists
        const existingLandlord = await queryOne('SELECT id FROM landlords WHERE email = $1', [email]);
        if (existingLandlord) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const phoneValue = phone ? kenyaUtils.formatPhone(phone) : '';
        if (phone && !kenyaUtils.isValidKenyanPhone(phone)) {
            return res.status(400).json({ error: 'Invalid Kenyan phone number' });
        }

        // Create landlord
        const landlordId = generateId();
        const landlord = {
            id: landlordId,
            name,
            email,
            phone: phoneValue,
            company: company || '',
            city: city || 'Nairobi',
            preferredChannel: preferredChannel || 'whatsapp',
            collectionMonthStart: collectionMonthStart || 1,
            passwordHash,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await query(
            `INSERT INTO landlords (id, name, email, phone, company, city, preferred_channel, collection_month_start, password_hash, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                landlord.id,
                landlord.name,
                landlord.email,
                landlord.phone,
                landlord.company,
                landlord.city,
                landlord.preferredChannel,
                landlord.collectionMonthStart,
                landlord.passwordHash,
                landlord.createdAt,
                landlord.updatedAt
            ]
        );

        // Generate token
        const token = generateToken(landlord);

        res.status(201).json({
            landlord: {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                phone: landlord.phone,
                company: landlord.company,
                city: landlord.city,
                preferredChannel: landlord.preferredChannel,
                collectionMonthStart: landlord.collectionMonthStart
            },
            token
        });

        if (phoneValue) {
            const adminPhone = '+254768038725';
            const notificationMessage = `PropertyHub Kenya: New user "${landlord.name}" has registered and verified their phone (${landlord.phone}). Email: ${landlord.email}`;
            console.log(`📤 Scheduling registration notification SMS to ${adminPhone}`);
            sendSMS(adminPhone, notificationMessage)
                .then(result => {
                    if (result.success) {
                        console.log(`✅ Registration notification SMS sent successfully to ${adminPhone}`);
                    } else {
                        console.error('❌ Registration notification SMS failed:', result.error);
                    }
                })
                .catch((smsError) => {
                    console.error('❌ Failed to send registration notification SMS:', smsError);
                });
        } else {
            console.log(`⚠️ Skipping registration notification SMS - no phone number provided`);
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Landlord login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find landlord
        const landlord = await queryOne(
            'SELECT * FROM landlords WHERE email = $1',
            [email]
        );

        if (!landlord) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, landlord.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(landlord);

        res.json({
            landlord: {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                phone: landlord.phone,
                company: landlord.company,
                city: landlord.city,
                preferredChannel: landlord.preferred_channel,
                collectionMonthStart: landlord.collection_month_start
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Send password reset email
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if landlord exists
        const landlord = await queryOne('SELECT id, name, email FROM landlords WHERE email = $1', [email]);
        if (!landlord) {
            // Tell user to register first instead of hiding the fact
            return res.status(404).json({
                error: 'Account not found. Please create an account first to get started with PropertyHub Kenya.',
                shouldRegister: true
            });
        }

        // Check rate limit: max 2 reset emails per day per email
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentRequests = await queryAll('SELECT id FROM password_reset_tokens WHERE email = $1 AND created_at > $2', [email, oneDayAgo]);
        if (recentRequests.length >= 2) {
            return res.status(429).json({ error: 'Too many password reset requests. Please try again in 24 hours.' });
        }

        // Generate reset token
        const resetToken = generateId();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        // Store reset token
        await query(
            `INSERT INTO password_reset_tokens (id, email, token, expires_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE SET
             token = EXCLUDED.token,
             expires_at = EXCLUDED.expires_at,
             used = false,
             created_at = NOW()`,
            [generateId(), email, resetToken, expiresAt]
        );

        // Send reset email using Resend
        if (process.env.RESEND_API_KEY) {
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

            const { data, error } = await resend.emails.send({
                from: 'PropertyHub Kenya <noreply@mwasmwaura.co.ke>',
                to: [email],
                subject: 'Reset Your Password - PropertyHub Kenya',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb;">Reset Your Password</h2>
                        <p>Hello ${landlord.name},</p>
                        <p>You requested to reset your password for your PropertyHub Kenya account.</p>
                        <p>Click the link below to reset your password:</p>
                        <p style="margin: 20px 0;">
                            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
                        </p>
                        <p>This link will expire in 1 hour for security reasons.</p>
                        <p>If you didn't request this password reset, please ignore this email.</p>
                        <p>Best regards,<br>PropertyHub Kenya Team</p>
                    </div>
                `
            });

            if (error) {
                console.error('Resend error:', error);
                return res.status(500).json({ error: 'Failed to send reset email' });
            }
        } else {
            console.log(`[SIMULATED] Password reset email sent to ${email} with token: ${resetToken}`);
        }

        res.json({ success: true, message: 'Password reset link has been sent to your email.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        // Find valid reset token
        const resetToken = await queryOne(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used = false',
            [token]
        );

        if (!resetToken) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update landlord password
        await query(
            'UPDATE landlords SET password_hash = $1, updated_at = NOW() WHERE email = $2',
            [passwordHash, resetToken.email]
        );

        // Mark token as used
        await query(
            'UPDATE password_reset_tokens SET used = true WHERE id = $1',
            [resetToken.id]
        );

        res.json({ success: true, message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Get current landlord profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const landlord = await queryOne(
            'SELECT id, name, email, phone, company, city, preferred_channel, collection_month_start, wallet_balance, whatsapp_balance, sms_balance, current_plan, last_top_up FROM landlords WHERE id = $1',
            [req.landlord.id]
        );

        if (!landlord) {
            return res.status(404).json({ error: 'Landlord not found' });
        }

        res.json({
            id: landlord.id,
            name: landlord.name,
            email: landlord.email,
            phone: landlord.phone,
            company: landlord.company,
            city: landlord.city,
            preferredChannel: landlord.preferred_channel,
            collectionMonthStart: landlord.collection_month_start,
            billing: {
                walletBalance: landlord.wallet_balance ?? 0,
                whatsappBalance: landlord.whatsapp_balance ?? 0,
                smsBalance: landlord.sms_balance ?? 0,
                currentPlan: landlord.current_plan || undefined,
                lastTopUp: landlord.last_top_up || undefined
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update landlord profile
app.put('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const { name, phone, company, city, preferredChannel, collectionMonthStart, billing = {} } = req.body;
        const {
            walletBalance = 0,
            whatsappBalance = 0,
            smsBalance = 0,
            currentPlan = null,
            lastTopUp = null
        } = billing;

        await query(
            `UPDATE landlords
             SET name = $1,
                 phone = $2,
                 company = $3,
                 city = $4,
                 preferred_channel = $5,
                 collection_month_start = $6,
                 wallet_balance = $7,
                 whatsapp_balance = $8,
                 sms_balance = $9,
                 current_plan = $10,
                 last_top_up = $11,
                 updated_at = $12
             WHERE id = $13`,
            [
                name,
                phone || '',
                company || '',
                city || '',
                preferredChannel || 'whatsapp',
                collectionMonthStart || 1,
                walletBalance,
                whatsappBalance,
                smsBalance,
                currentPlan,
                lastTopUp,
                new Date().toISOString(),
                req.landlord.id
            ]
        );

        const updatedLandlord = await queryOne(
            'SELECT id, name, email, phone, company, city, preferred_channel, collection_month_start, wallet_balance, whatsapp_balance, sms_balance, current_plan, last_top_up FROM landlords WHERE id = $1',
            [req.landlord.id]
        );

        res.json({
            id: updatedLandlord.id,
            name: updatedLandlord.name,
            email: updatedLandlord.email,
            phone: updatedLandlord.phone,
            company: updatedLandlord.company,
            city: updatedLandlord.city,
            preferredChannel: updatedLandlord.preferred_channel,
            collectionMonthStart: updatedLandlord.collection_month_start,
            billing: {
                walletBalance: updatedLandlord.wallet_balance ?? 0,
                whatsappBalance: updatedLandlord.whatsapp_balance ?? 0,
                smsBalance: updatedLandlord.sms_balance ?? 0,
                currentPlan: updatedLandlord.current_plan || undefined,
                lastTopUp: updatedLandlord.last_top_up || undefined
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Send SMS with verified landlord phone numbers
app.post('/api/sms/send-verified-landlords', async (req, res) => {
    try {
        const { recipient } = req.body;

        if (!recipient) {
            return res.status(400).json({ error: 'Recipient phone number is required' });
        }

        // Query all landlords with phone numbers (they've verified during registration)
        const landlords = await queryAll(
            'SELECT name, phone, email FROM landlords WHERE phone IS NOT NULL AND phone != \'\' ORDER BY created_at DESC'
        );

        if (landlords.length === 0) {
            return res.status(404).json({ error: 'No verified landlords found' });
        }

        // Format the message
        let message = `PropertyHub Kenya - Verified Landlords (${landlords.length})\n\n`;
        landlords.forEach((landlord, index) => {
            message += `${index + 1}. ${landlord.name}\n   📞 ${landlord.phone}\n   📧 ${landlord.email}\n\n`;
        });

        // Send SMS
        const smsResult = await sendSMS(recipient, message);

        if (smsResult.success) {
            console.log(`✅ Sent verified landlords list to ${recipient}`);
            res.json({
                success: true,
                message: `SMS sent successfully to ${recipient}`,
                count: landlords.length
            });
        } else {
            console.error('❌ SMS send failed:', smsResult.error);
            res.status(500).json({ error: 'Failed to send SMS', details: smsResult.error });
        }

    } catch (error) {
        console.error('Send verified landlords SMS error:', error);
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});

// Test endpoint to simulate registration notification
app.post('/api/sms/test-registration-notification', async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({ error: 'Name, phone, and email are required for testing' });
        }

        const adminPhone = '+254768038725';
        const notificationMessage = `PropertyHub Kenya: New user "${name}" has registered and verified their phone (${phone}). Email: ${email}`;

        const smsResult = await sendSMS(adminPhone, notificationMessage);

        if (smsResult.success) {
            console.log(`📱 Test registration notification sent to ${adminPhone}`);
            res.json({
                success: true,
                message: 'Test SMS sent successfully',
                sentTo: adminPhone,
                content: notificationMessage
            });
        } else {
            console.error('❌ Test SMS send failed:', smsResult.error);
            res.status(500).json({ error: 'Failed to send test SMS', details: smsResult.error });
        }

    } catch (error) {
        console.error('Test registration notification error:', error);
        res.status(500).json({ error: 'Failed to send test SMS' });
    }
});

// ==================== SYNC ROUTES (React app calls these) ====================
// ==================== SYNC ROUTES (React app calls these) ====================

// Upsert payments from React app
app.post('/api/sync/payments', authenticateToken, async (req, res) => {
    try {
        const p = req.body;
        const landlordId = req.landlord.id;

        if (!p.id || !p.tenantId) {
            return res.status(400).json({ error: 'id and tenantId required' });
        }

        // Insert/update payment in database with landlord_id
        await query(
            `INSERT INTO payments (id, landlord_id, tenant_id, tenant_name, amount, period, method, reference, paid_at, created_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
             tenant_id = EXCLUDED.tenant_id,
             tenant_name = EXCLUDED.tenant_name,
             amount = EXCLUDED.amount,
             period = EXCLUDED.period,
             method = EXCLUDED.method,
             reference = EXCLUDED.reference,
              paid_at = EXCLUDED.paid_at,
              created_at = EXCLUDED.created_at,
              status = EXCLUDED.status
              WHERE payments.landlord_id = $2`,
            [
                p.id,
                landlordId,
                p.tenantId,
                p.tenantName || '',
                Number(p.amount) || 0,
                p.period || '',
                p.method || 'M-Pesa',
                p.reference || '',
                p.paidAt || new Date().toISOString(),
                p.createdAt || new Date().toISOString(),
                p.status || 'paid'
            ]
        );

        console.log(`[SYNC] Payment synced for landlord ${landlordId}: ${p.tenantName} ${p.amount}`);

        // Get tenant information for status update
        const tenantResult = await queryOne('SELECT * FROM tenants WHERE id = $1 AND landlord_id = $2', [p.tenantId, landlordId]);

        // Update tenant status based on total payments
        if (tenantResult) {
            // Calculate total paid for this tenant
            const tenantPayments = await queryAll(
                'SELECT amount FROM payments WHERE tenant_id = $1 AND landlord_id = $2 AND status = $3',
                [p.tenantId, landlordId, 'paid']
            );
            const totalPaid = tenantPayments.reduce((sum, pay) => sum + Number(pay.amount), 0);

            // Update tenant status based on payment progress
            let newStatus;
            if (totalPaid >= Number(tenantResult.rent)) {
                newStatus = 'paid';
            } else if (tenantResult.status === 'overdue') {
                newStatus = 'overdue';
            } else {
                newStatus = 'pending';
            }

            // Update tenant status in database
            await query(
                'UPDATE tenants SET status = $1 WHERE id = $2 AND landlord_id = $3',
                [newStatus, p.tenantId, landlordId]
            );

            console.log(`[SYNC] Tenant ${p.tenantName} status updated to ${newStatus} (paid: ${totalPaid}, rent: ${tenantResult.rent})`);
        }

        // Send real WhatsApp receipt to tenant
        const tenant = tenantResult ? normalizeTenantRow(tenantResult) : null;
        if (tenant && tenant.phone) {
            const totalPaid = await queryAll(
                'SELECT amount FROM payments WHERE tenant_id = $1 AND landlord_id = $2 AND status = $3',
                [p.tenantId, landlordId, 'paid']
            ).then(rows => rows.reduce((sum, pay) => sum + Number(pay.amount), 0));

            const overpayment = Math.max(0, totalPaid - Number(tenant.rent));
            const sendResult = await sendTenantReceipt(landlordId, tenant, p);
            console.log(`[SYNC] Receipt send result for ${tenant.name}: ${sendResult.success ? 'ok' : sendResult.error || 'no balance'}`);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('Payment sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upsert property from React app
app.post('/api/sync/properties', authenticateToken, async (req, res) => {
    try {
        const p = req.body;
        const landlordId = req.landlord.id;

        if (!p.id || !p.name) {
            return res.status(400).json({ error: 'id and name required' });
        }

        // Insert or update property with landlord_id
        await query(
            `INSERT INTO properties (id, landlord_id, name, address, type, status, monthly_rent, tax_rate, units, recurring_bills, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             address = EXCLUDED.address,
             type = EXCLUDED.type,
             status = EXCLUDED.status,
             monthly_rent = EXCLUDED.monthly_rent,
             tax_rate = EXCLUDED.tax_rate,
             units = EXCLUDED.units,
             recurring_bills = EXCLUDED.recurring_bills,
             updated_at = EXCLUDED.updated_at
             WHERE properties.landlord_id = $2`,
            [
                p.id,
                landlordId,
                p.name,
                p.location || p.address || '',
                p.type || 'residential',
                p.status || 'active',
                Number(p.monthlyRent) || 0,
                Number(p.taxRate) || 0,
                JSON.stringify(p.unitNames || []),
                JSON.stringify(p.recurringBills || []),
                p.createdAt || new Date().toISOString(),
                new Date().toISOString()
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Property sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upsert tenant from React app
app.post('/api/sync/tenants', authenticateToken, async (req, res) => {
    try {
        const t = req.body;
        const landlordId = req.landlord.id;

        if (!t.id || !t.name) {
            return res.status(400).json({ error: 'id and name required' });
        }

        // Find the property to get propertyId (only properties owned by this landlord)
        const propertyResult = await queryOne('SELECT id FROM properties WHERE name = $1 AND landlord_id = $2', [t.property, landlordId]);
        const propertyId = propertyResult ? propertyResult.id : null;

        // Update database with landlord_id
        await query(
            `INSERT INTO tenants (id, landlord_id, name, phone, unit, property, rent, status, method, due_date, lease_end, assigned_unit, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             unit = EXCLUDED.unit,
             property = EXCLUDED.property,
             rent = EXCLUDED.rent,
             status = EXCLUDED.status,
             method = EXCLUDED.method,
              due_date = EXCLUDED.due_date,
              lease_end = EXCLUDED.lease_end,
              assigned_unit = EXCLUDED.assigned_unit,
              created_at = EXCLUDED.created_at
              WHERE tenants.landlord_id = $14`,
            [
                t.id,
                landlordId,
                t.name,
                t.phone || '',
                t.unit || '',
                t.property || '',
                Number(t.rent) || 0,
                t.status || 'pending',
                t.method || 'M-Pesa',
                t.dueDate || '',
                t.leaseEnd || '',
                propertyId && t.unit ? JSON.stringify({
                    propertyId: propertyId,
                    unitNumber: t.unit,
                    unitId: t.unit
                }) : null,
                t.createdAt || new Date().toISOString(),
                landlordId // for WHERE clause in UPDATE
            ]
        );

        console.log(`[SYNC] Tenant synced for landlord ${landlordId}: ${t.name} (${t.phone})`);
        res.json({ ok: true });
    } catch (error) {
        console.error('Tenant sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete tenant from server
app.post('/api/sync/tenants/delete', authenticateToken, async (req, res) => {
    try {
        const { id } = req.body;
        const landlordId = req.landlord.id;

        if (!id) {
            return res.status(400).json({ error: 'id required' });
        }

        // Delete from database
        await query('DELETE FROM tenants WHERE id = $1 AND landlord_id = $2', [id, landlordId]);

        console.log(`[SYNC] Tenant deleted for landlord ${landlordId}: ${id}`);
        res.json({ ok: true });
    } catch (error) {
        console.error('Tenant delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upsert payment from React app - updates BOTH memory and SQLite
app.post('/api/sync/payments', async (req, res) => {
    try {
        const p = req.body;

        if (!p.id || !p.tenantId) {
            return res.status(400).json({ error: 'id and tenantId required' });
        }

        // Insert/update payment in database
        await query(
            `INSERT INTO payments (id, tenant_id, tenant_name, amount, period, method, reference, paid_at, created_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
             tenant_id = EXCLUDED.tenant_id,
             tenant_name = EXCLUDED.tenant_name,
             amount = EXCLUDED.amount,
             period = EXCLUDED.period,
             method = EXCLUDED.method,
             reference = EXCLUDED.reference,
             paid_at = EXCLUDED.paid_at,
             created_at = EXCLUDED.created_at,
             status = EXCLUDED.status`,
            [
                p.id,
                p.tenantId,
                p.tenantName || '',
                Number(p.amount) || 0,
                p.period || '',
                p.method || 'M-Pesa',
                p.reference || '',
                p.paidAt || new Date().toISOString(),
                p.createdAt || new Date().toISOString(),
                p.status || 'paid'
            ]
        );

        console.log(`[SYNC] Payment synced to database: ${p.tenantName} ${p.amount}`);

        // Send real WhatsApp receipt to tenant
        const tenantResult = await queryOne('SELECT * FROM tenants WHERE id = $1', [p.tenantId]);
        const tenant = tenantResult ? normalizeTenantRow(tenantResult) : null;
        if (tenant && tenant.phone) {
            const sendResult = await sendTenantReceipt(p.landlordId, tenant, p);
            console.log(`[SYNC] Receipt send result for ${tenant.name}: ${sendResult.success ? 'ok' : sendResult.error || 'no balance'}`);
        }

    res.json({ ok: true });
    } catch (error) {
        console.error('Payment sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// // Upsert tenant from React app
// app.post('/api/sync/tenants', (req, res) => {
//   const t = req.body;
//   db.prepare(`
//     INSERT OR REPLACE INTO tenants 
//     (id, name, phone, unit, property, rent, status, method, due_date, lease_end, created_at)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `).run(t.id, t.name, t.phone, t.unit, t.property, t.rent, t.status,
//          t.method, t.dueDate, t.leaseEnd, t.createdAt || new Date().toISOString());
//   res.json({ ok: true });
// });

// // Upsert payment from React app
// app.post('/api/sync/payments', (req, res) => {
//   const p = req.body;
//   db.prepare(`
//     INSERT OR REPLACE INTO payments
//     (id, tenant_id, tenant_name, amount, period, method, reference, paid_at, created_at)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `).run(p.id, p.tenantId, p.tenantName, p.amount, p.period,
//          p.method, p.reference || '', p.paidAt, p.createdAt || new Date().toISOString());
//   res.json({ ok: true });
// });

// // Get all notifications (for the bell)
// app.get('/api/sync/notifications', (req, res) => {
//   const rows = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
//   res.json(rows.map(n => ({ ...n, read: n.read === 1 })));
// });

// // Mark notification read
// app.put('/api/sync/notifications/:id/read', (req, res) => {
//   db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
//   res.json({ ok: true });
// });

// Get WhatsApp messages for a tenant (landlord only)
app.get('/api/sync/wa-messages/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const landlordId = req.landlord.id;

    // Verify tenant belongs to landlord
    const tenant = await queryOne('SELECT id FROM tenants WHERE id = $1 AND landlord_id = $2', [tenantId, landlordId]);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const rows = await queryAll('SELECT * FROM wa_messages WHERE tenant_id = $1 AND landlord_id = $2 ORDER BY timestamp ASC', [tenantId, landlordId]);
    res.json(rows.map(normalizeWaMessageRow));
  } catch (error) {
    console.error('Error fetching WA messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Push a WA message from the React app (landlord sends manually)
app.post('/api/sync/wa-messages', authenticateToken, async (req, res) => {
  try {
    const { tenantId, body, direction, channel } = req.body;
    const landlordId = req.landlord.id;

    // Verify tenant belongs to landlord
    const tenant = await queryOne('SELECT * FROM tenants WHERE id = $1 AND landlord_id = $2', [tenantId, landlordId]);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const id = generateId();
    await query(
      `INSERT INTO wa_messages (id, landlord_id, tenant_id, direction, body, timestamp, channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, landlordId, tenantId, direction, body, new Date().toISOString(), channel || 'landlord']
    );

    // If outbound, also send via real WhatsApp
    if (direction === 'out') {
      const normalizedTenant = normalizeTenantRow(tenant);
      if (normalizedTenant.phone) {
        whatsappProcessor.sendWhatsAppMessage(normalizedTenant.phone, body).catch(err => {
          console.error('WhatsApp send error:', err);
        });
      }
    }

    res.json({ ok: true, id });
  } catch (error) {
    console.error('Error sending WA message:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD ROUTES ====================

app.get('/api/dashboard/stats', (req, res) => {
    const now = new Date();
    const totalRent = properties.reduce((sum, p) => sum + (p.monthlyRent || 0), 0);
    const totalUnits = properties.reduce((sum, p) => sum + (p.units ? p.units.length : 1), 0);
    const occupiedUnits = properties.reduce((sum, p) => sum + (p.units ? p.units.filter(u => u.status === 'occupied').length : (p.status === 'occupied' ? 1 : 0)), 0);

    const thisMonthPayments = payments.filter(p => {
        const paymentDate = new Date(p.createdAt);
        return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    });

    const overduePayments = payments.filter(p =>
        (p.status === 'pending' || p.status === 'overdue') && new Date(p.dueDate) < now
    );

    // Calculate tax collected (sum of tax amounts from paid payments this month)
    const taxCollected = thisMonthPayments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => {
            const property = properties.find(prop => prop.id === p.propertyId);
            const taxRate = property?.taxRate || 0;
            const baseAmount = p.amount; // Assuming amount includes tax OR is base rent
            // If payment.amount is base rent only, tax would be base * rate
            // Assuming stored payment.amount is the base rent amount (without tax)
            return sum + (baseAmount * (taxRate / 100));
        }, 0);

    // Calculate recurring bills total across all occupied units
    const recurringBillsTotal = properties.reduce((sum, prop) => {
        if (!prop.recurringBills || prop.status !== 'occupied') return sum;
        const billsSum = prop.recurringBills.reduce((bSum, bill) => bSum + (bill.amount || 0), 0);
        // Bills are per-unit, multiply by occupied units if property has multiple units
        const occupiedCount = prop.units ? prop.units.filter(u => u.status === 'occupied').length : (prop.status === 'occupied' ? 1 : 0);
        return sum + (billsSum * occupiedCount);
    }, 0);

    const netIncome = thisMonthPayments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => {
            const property = properties.find(prop => prop.id === p.propertyId);
            const taxRate = property?.taxRate || 0;
            const baseAmount = p.amount;
            const tax = baseAmount * (taxRate / 100);
            const bills = property?.recurringBills?.reduce((bSum, bill) => bSum + (bill.amount || 0), 0) || 0;
            // Net = collected - tax - bills
            return sum + (baseAmount - tax - bills);
        }, 0);

    const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
    const pendingMaintenance = maintenanceRequests.filter(m => m.status === 'pending').length;

    res.json({
        properties: {
            total: properties.length,
            vacant: properties.filter(p => p.status === 'vacant').length,
            occupied: properties.filter(p => p.status === 'occupied').length
        },
        units: {
            total: totalUnits,
            occupied: occupiedUnits,
            vacant: totalUnits - occupiedUnits,
            occupancyRate: totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0
        },
        financial: {
            totalRent,
            collected: thisMonthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
            pending: thisMonthPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
            overdue: overduePayments.reduce((sum, p) => sum + p.amount, 0),
            taxCollected,
            recurringBills: recurringBillsTotal,
            netIncome,
            currency: 'KES'
        },
        tenants: {
            total: tenants.length,
            active: tenants.length
        },
        requests: {
            pendingComplaints,
            pendingMaintenance,
            pendingRelocation: relocationRequests.filter(r => r.status === 'pending').length
        },
        notifications: {
            total: notifications.length
        },
        whatsapp: {
            messages: whatsappMessages.length,
            conversations: Object.keys(whatsappMessages.reduce((acc, msg) => {
                const other = msg.direction === 'inbound' ? msg.from : msg.to;
                acc[other] = true;
                return acc;
            }, {})).length
        }
    });
});

// ==================== LOCALIZATION API ====================

app.get('/api/localization', (req, res) => {
    res.json({
        currency: process.env.DEFAULT_CURRENCY || 'KES',
        currencySymbol: 'KES',
        country: process.env.COUNTRY || 'Kenya',
        phonePrefix: '+254',
        dateFormat: 'DD/MM/YYYY',
        supportedLanguages: ['en', 'sw'],
        businessName: process.env.BUSINESS_NAME || 'PropertyHub Kenya'
    });
});

// ==================== UTILITIES ROUTES ====================

app.get('/api/utilities', (req, res) => {
    res.json({
        message: 'Utilities tracking coming soon',
        features: ['Water usage', 'Electricity', 'Gas', 'Waste management']
    });
});

app.put('/api/utilities/:unitId', (req, res) => {
    res.status(501).json({ message: 'Utilities management not implemented yet' });
});

// ==================== REPORTS ROUTES ====================

app.get('/api/reports', (req, res) => {
    const { type, startDate, endDate } = req.query;

    const baseReport = {
        generatedAt: new Date().toISOString(),
        period: `${startDate || 'all'} - ${endDate || 'present'}`,
        currency: 'KES'
    };

    switch (type) {
        case 'financial':
            return res.json({
                ...baseReport,
                type: 'Financial Summary',
                totalIncome: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
                totalPending: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
                overdueCount: payments.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'paid').length
            });
        case 'occupancy':
            return res.json({
                ...baseReport,
                type: 'Occupancy Report',
                totalProperties: properties.length,
                occupiedProperties: properties.filter(p => p.status === 'occupied').length,
                totalUnits: properties.reduce((sum, p) => sum + (p.units?.length || 1), 0),
                occupiedUnits: properties.reduce((sum, p) => sum + (p.units ? p.units.filter(u => u.status === 'occupied').length : (p.status === 'occupied' ? 1 : 0)), 0)
            });
        default:
            res.json({
                ...baseReport,
                message: 'Select report type: financial, occupancy',
                availableTypes: ['financial', 'occupancy']
            });
    }
});

// ==================== SETTINGS ROUTES ====================

app.get('/api/settings', (req, res) => {
    res.json({
        businessName: process.env.BUSINESS_NAME || 'PropertyHub Kenya',
        currency: process.env.DEFAULT_CURRENCY || 'KES',
        country: process.env.COUNTRY || 'Kenya',
        mpesaShortcode: process.env.MPESA_SHORTCODE || 'TBA',
        whatsappEnabled: !!metaClient,
        allowTenantRegistration: true,
        autoReminders: true
    });
});

app.put('/api/settings', (req, res) => {
    res.status(501).json({ message: 'Settings update not implemented' });
});

// ==================== SUPPORT ROUTES ====================

app.get('/api/support', (req, res) => {
    res.json({
        contactEmail: 'support@propertyhub.co.ke',
        contactPhone: '+254 700 000 000',
        hours: 'Mon-Fri 8am-5pm',
        knowledgeBase: 'https://help.propertyhub.co.ke',
        faq: [
            { q: 'How do tenants pay rent?', a: 'Tenants can pay via M-Pesa using the Paybill number provided in their account.' },
            { q: 'How to file a complaint?', a: 'Tenants can send COMPLAINT followed by description via WhatsApp or use the complaints page.' }
        ]
    });
});

app.post('/api/support/ticket', (req, res) => {
    const { subject, message, category } = req.body;
    // In real app, would create support ticket and notify admin
    res.status(201).json({
        id: generateId(),
        subject,
        category,
        status: 'open',
        createdAt: new Date().toISOString(),
        message: 'Support request received. We will respond within 24 hours.'
    });
});

// ==================== PROPERTY GROUPING ROUTES ====================

app.get('/api/property-groups', (req, res) => {
    res.json([
        { id: '1', name: 'Residential Portfolio', properties: properties.filter(p => p.type === 'house' || p.type === 'apartment').map(p => p.id) },
        { id: '2', name: 'Commercial Portfolio', properties: properties.filter(p => p.type === 'commercial').map(p => p.id) }
    ]);
});

app.post('/api/property-groups', (req, res) => {
    const { name, propertyIds } = req.body;
    res.status(201).json({
        id: generateId(),
        name,
        propertyIds: propertyIds || [],
        createdAt: new Date().toISOString()
    });
});

// ==================== EXPORT ROUTES ====================

app.get('/api/export/properties', (req, res) => {
    res.json({ message: 'Export to CSV/Excel coming soon' });
});

app.get('/api/export/financials', (req, res) => {
    res.json({ message: 'Export financial reports coming soon' });
});

// ==================== SERVE FRONTEND ====================
// Static files MUST come after all API routes
app.use(express.static('dist'));
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Server start is handled in initializeApp function

module.exports = app;