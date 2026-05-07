const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('dist'));

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

// SQLite persistence
const Database = require('better-sqlite3');
const db = new Database('propertyhub.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    type TEXT,
    status TEXT,
    monthlyRent INTEGER,
    taxRate INTEGER,
    units TEXT,
    recurringBills TEXT,
    createdAt TEXT,
    updatedAt TEXT
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
    sentAt TEXT,
    status TEXT
  );
`);

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
  monthlyRent: row.monthlyRent != null ? Number(row.monthlyRent) : row.monthlyRent,
  taxRate: row.taxRate != null ? Number(row.taxRate) : row.taxRate,
  units: loadJson(row.units, []),
  recurringBills: loadJson(row.recurringBills, [])
});

const normalizeTenantRow = (row) => ({
  ...row,
  rent: row.rent != null ? Number(row.rent) : row.rent,
  assignedUnit: loadJson(row.assigned_unit, null),
  createdAt: row.created_at
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
  read: row.read === 1
});

const persistProperty = (property) => db.prepare(
  `INSERT OR REPLACE INTO properties (id, name, address, type, status, monthlyRent, taxRate, units, recurringBills, createdAt, updatedAt)
   VALUES (@id, @name, @address, @type, @status, @monthlyRent, @taxRate, @units, @recurringBills, @createdAt, @updatedAt)`
).run({
  ...property,
  units: JSON.stringify(property.units || []),
  recurringBills: JSON.stringify(property.recurringBills || [])
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

const persistComplaint = (complaint) => db.prepare(
  `INSERT OR REPLACE INTO complaints (id, tenant_id, tenant_name, unit, property, category, description, priority, status, source, created_at)
   VALUES (@id, @tenant_id, @tenant_name, @unit, @property, @category, @description, @priority, @status, @source, @created_at)`
).run({
  id: complaint.id,
  tenant_id: complaint.tenantId,
  tenant_name: complaint.tenantName,
  unit: complaint.unit,
  property: complaint.property,
  category: complaint.category || null,
  description: complaint.description,
  priority: complaint.priority || 'medium',
  status: complaint.status || 'pending',
  source: complaint.source || 'tenant',
  created_at: complaint.createdAt || new Date().toISOString()
});

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
  `INSERT OR REPLACE INTO notifications (id, type, title, body, created_at, read, recipient, message, sentAt, status)
   VALUES (@id, @type, @title, @body, @created_at, @read, @recipient, @message, @sentAt, @status)`
).run({
  ...notification,
  created_at: notification.createdAt || new Date().toISOString(),
  read: notification.read ? 1 : 0,
  message: notification.message || null,
  sentAt: notification.sentAt || null,
  status: notification.status || 'sent'
});

let properties = db.prepare('SELECT * FROM properties').all().map(normalizePropertyRow);
let tenants = db.prepare('SELECT * FROM tenants').all().map(normalizeTenantRow);
let payments = db.prepare('SELECT * FROM payments').all().map(normalizePaymentRow);
let complaints = db.prepare('SELECT * FROM complaints').all().map(normalizeComplaintRow);
let whatsappMessages = db.prepare('SELECT * FROM wa_messages').all().map(normalizeWaMessageRow);
let notifications = db.prepare('SELECT * FROM notifications').all().map(normalizeNotificationRow);

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
        } else if (cleaned.startsWith('7') && cleaned.length === 9) {
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
               cleaned.startsWith('7') && cleaned.length === 9;
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

function findTenantByPhone(phone) {
  const normalized = kenyaUtils.formatPhone(phone);
  return db.prepare(`
    SELECT * FROM tenants 
    WHERE replace(replace(phone,' ',''),'+','') = replace(replace(?,'+',''),' ','')
  `).get(normalized);
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

app.put('/api/payments/:id/status', (req, res) => {
    const payment = payments.find(p => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    payment.status = req.body.status;
    payment.updatedAt = new Date().toISOString();

    if (req.body.status === 'paid') {
        payment.paidAt = new Date().toISOString();

        // Send receipt via WhatsApp if tenant has phone
        const tenant = tenants.find(t => t.id === payment.tenantId);
        if (tenant && tenant.phone) {
            whatsappProcessor.sendWhatsAppMessage(tenant.phone,
`✅ *Payment Confirmed!*\n\nAmount: ${kenyaUtils.formatKES(payment.amount)}\nPeriod: ${payment.period}\nDate: ${kenyaUtils.formatDate(payment.paidAt)}\n\nThank you for your payment!`
            );
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

app.put('/api/complaints/:id', (req, res) => {
    const index = complaints.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Complaint not found' });

    complaints[index] = { ...complaints[index], ...req.body, updatedAt: new Date().toISOString() };
    persistComplaint(complaints[index]);
    res.json(complaints[index]);
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

                        const tenant = findTenantByPhone(from);

                        // Save inbound message
                        const inboundId = generateId();
                        db.prepare(`INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, meta_message_id, from_phone)
                                    VALUES (?, ?, 'in', ?, ?, 'tenant', ?, ?)`)
                          .run(inboundId, tenant?.id || from, rawText, new Date().toISOString(), messageId, from);

                        // Detect if this is a complaint or maintenance request
                        const isComplaint = text.includes('COMPLAIN') || text.includes('ISSUE') || text.includes('PROBLEM');
                        const isMaintenance = text.includes('MAINTENANCE') || text.includes('MAINTAIN') || text.includes('FIX') || text.includes('REPAIR');
                        
                        if (isComplaint || isMaintenance) {
                          // Save as complaint/maintenance record for landlord to address
                          const complaintId = generateId();
                          const category = isMaintenance ? 'Maintenance' : 'General';
                          db.prepare(`
                            INSERT INTO complaints (id, tenant_id, tenant_name, unit, property, category, description, priority, status, source, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                          `).run(
                            complaintId,
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
                          );
                          
                          // Send acknowledgment to tenant
                          const ackMessage = `✅ Thank you for reaching out!\n\nWe received your ${isMaintenance ? 'maintenance request' : 'complaint'}:\n"${rawText}"\n\nOur team will review and respond within 23 hours. Reference: #${complaintId.slice(-6).toUpperCase()}`;
                          await whatsappProcessor.sendWhatsAppMessage(from, ackMessage);
                          
                          const outboundId = generateId();
                          db.prepare(`INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, from_phone, to_phone)
                                      VALUES (?, ?, 'out', ?, ?, 'bot', ?, ?)`)
                            .run(outboundId, tenant?.id || from, ackMessage, new Date().toISOString(), metaPhoneNumberId, from);
                        } else {
                          // Process as command for demo
                          const response = await whatsappProcessor.process(from, text || 'MENU', tenant);
                          if (response.message) {
                            await whatsappProcessor.sendWhatsAppMessage(from, response.message);
                            
                            const outboundId = generateId();
                            db.prepare(`INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel)
                                        VALUES (?, ?, 'out', ?, ?, 'bot')`)
                              .run(outboundId, tenant?.id || from, response.message, new Date().toISOString());
                          }
                        }

                        // Push notification for landlord dashboard
                        if (isComplaint || isMaintenance) {
                          db.prepare(`INSERT INTO notifications (id, type, title, body, created_at, read)
                                      VALUES (?, ?, ?, ?, ?, 0)`)
                            .run(generateId(), isMaintenance ? 'maintenance' : 'complaint',
                                 `${tenant?.name || from} - ${isMaintenance ? 'Maintenance' : 'Complaint'}`,
                                 `${rawText.slice(0, 80)}`,
                                 new Date().toISOString());
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
app.get('/api/whatsapp/threads', (req, res) => {
    try {
        // Get all pending complaints/maintenance from WhatsApp
        const complaints = db.prepare(`
            SELECT * FROM complaints 
            WHERE source = 'whatsapp' AND status = 'pending'
            ORDER BY created_at DESC
        `).all();

        const threads = complaints.map(complaint => {
            // Get all messages in the thread related to this complaint
            const messages = db.prepare(`
                SELECT * FROM wa_messages 
                WHERE tenant_id = ?
                ORDER BY timestamp ASC
            `).all(complaint.tenant_id);

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
        });

        res.json(threads);
    } catch (error) {
        console.error('Error fetching threads:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get messages for a specific tenant (real thread)
app.get('/api/whatsapp/thread/:tenantId', (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const messages = db.prepare(`
            SELECT * FROM wa_messages 
            WHERE tenant_id = ?
            ORDER BY timestamp ASC
        `).all(tenantId);

        // Get related complaint/maintenance
        const complaint = db.prepare(`
            SELECT * FROM complaints 
            WHERE tenant_id = ? AND source = 'whatsapp'
            ORDER BY created_at DESC
            LIMIT 1
        `).get(tenantId);

        res.json({
            tenantId,
            complaint: complaint ? {
                id: complaint.id,
                category: complaint.category,
                description: complaint.description,
                priority: complaint.priority,
                status: complaint.status,
                createdAt: complaint.created_at
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
app.post('/api/whatsapp/reply', async (req, res) => {
    try {
        const { complaintId, tenantId, message } = req.body;

        if (!tenantId || !message) {
            return res.status(400).json({ error: 'Tenant ID and message are required' });
        }

        // Get tenant phone number
        const tenant = db.prepare('SELECT phone FROM tenants WHERE id = ?').get(tenantId);
        if (!tenant || !tenant.phone) {
            return res.status(404).json({ error: 'Tenant not found or no phone number' });
        }

        // Send the message via WhatsApp
        const result = await whatsappProcessor.sendWhatsAppMessage(tenant.phone, message);

        if (result.success) {
            // Save as outbound message
            const messageId = generateId();
            db.prepare(`
                INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel, meta_message_id)
                VALUES (?, ?, 'out', ?, ?, 'landlord', ?)
            `).run(messageId, tenantId, message, new Date().toISOString(), result.messageId || '');

            // Update complaint status if provided
            if (complaintId) {
                db.prepare(`
                    UPDATE complaints 
                    SET status = 'in_progress' 
                    WHERE id = ?
                `).run(complaintId);
            }

            res.json({ success: true, messageId, sentAt: new Date().toISOString() });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error sending reply:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update complaint status
app.put('/api/complaints/:id', (req, res) => {
    try {
        const { status } = req.body;
        db.prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

app.post('/api/notifications', async (req, res) => {
    const { recipient, message, type = 'whatsapp' } = req.body;

    const notification = {
        id: generateId(),
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

    // Send via WhatsApp if type is whatsapp
    if (type === 'whatsapp' && metaClient) {
        const result = await whatsappProcessor.sendWhatsAppMessage(recipient, message);
        notification.status = result.success ? 'sent' : 'failed';
    } else {
        notification.status = 'sent'; // Simulated
    }

    res.status(201).json(notification);
});

app.post('/api/notifications/bulk', async (req, res) => {
    const { recipients, message, type = 'whatsapp' } = req.body;
    const sentNotifications = [];

    for (const recipient of recipients) {
        const notification = {
            id: generateId(),
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

app.get('/api/notifications', (req, res) => {
    res.json(notifications);
});

app.get('/api/sync/properties', (req, res) => {
    const rows = db.prepare('SELECT * FROM properties').all().map(normalizePropertyRow);
    res.json(rows);
});

app.get('/api/sync/tenants', (req, res) => {
    const rows = db.prepare('SELECT * FROM tenants').all().map(normalizeTenantRow);
    res.json(rows);
});

app.get('/api/sync/payments', (req, res) => {
    const rows = db.prepare('SELECT * FROM payments').all().map(normalizePaymentRow);
    res.json(rows);
});

app.get('/api/sync/complaints', (req, res) => {
    const rows = db.prepare('SELECT * FROM complaints').all().map(normalizeComplaintRow);
    res.json(rows);
});

app.get('/api/sync/notifications', (req, res) => {
    const rows = db.prepare('SELECT * FROM notifications').all().map(normalizeNotificationRow);
    res.json(rows);
});

app.get('/api/sync/whatsapp', (req, res) => {
    const rows = db.prepare('SELECT * FROM wa_messages').all().map(normalizeWaMessageRow);
    res.json(rows);
});

// ==================== SYNC ROUTES (React app calls these) ====================

// Upsert tenant from React app
app.post('/api/sync/tenants', (req, res) => {
  const t = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO tenants 
    (id, name, phone, unit, property, rent, status, method, due_date, lease_end, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.id, t.name, t.phone, t.unit, t.property, t.rent, t.status,
         t.method, t.dueDate, t.leaseEnd, t.createdAt || new Date().toISOString());
  res.json({ ok: true });
});

// Upsert payment from React app
app.post('/api/sync/payments', (req, res) => {
  const p = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO payments
    (id, tenant_id, tenant_name, amount, period, method, reference, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(p.id, p.tenantId, p.tenantName, p.amount, p.period,
         p.method, p.reference || '', p.paidAt, p.createdAt || new Date().toISOString());
  res.json({ ok: true });
});

// Get all notifications (for the bell)
app.get('/api/sync/notifications', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows.map(n => ({ ...n, read: n.read === 1 })));
});

// Mark notification read
app.put('/api/sync/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get WhatsApp messages for a tenant
app.get('/api/sync/wa-messages/:tenantId', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM wa_messages WHERE tenant_id = ? ORDER BY timestamp ASC'
  ).all(req.params.tenantId);
  res.json(rows);
});

// Push a WA message from the React app (landlord sends manually)
app.post('/api/sync/wa-messages', async (req, res) => {
  const { tenantId, body, direction, channel } = req.body;
  const id = generateId();
  db.prepare(`
    INSERT INTO wa_messages (id, tenant_id, direction, body, timestamp, channel)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, tenantId, direction, body, new Date().toISOString(), channel || 'landlord');

  // If outbound, also send via real WhatsApp
  if (direction === 'out') {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (tenant?.phone) {
      await whatsappProcessor.sendWhatsAppMessage(tenant.phone, body);
    }
  }
  res.json({ ok: true, id });
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🏠 PropertyHub Kenya running on http://localhost:${PORT}`);
    console.log(`📱 WhatsApp Integration: ${metaClient ? '✅ Active' : '⚠️  Simulated (no credentials)'}`);
});

module.exports = app;