# Real WhatsApp Integration - Complete Setup Guide

## 🎯 What You've Got Now

Your PropertyHub app now supports **real WhatsApp communication** between tenants and landlords with a 23-hour response window (enforced by Meta's API):

### Two Modes in WhatsApp Hub:

1. **Bot Simulator** - For testing locally with demo commands
2. **Real Requests** - For actual tenant complaints/maintenance requests via WhatsApp Cloud API

---

## 🔄 How the Flow Works

### **Tenant → Landlord Path:**

```
Tenant sends WhatsApp message
         ↓
Meta Cloud API webhook receives it
         ↓
Server processes message:
   - If contains "COMPLAINT", "ISSUE", "PROBLEM" → Creates complaint record
   - If contains "MAINTENANCE", "FIX", "REPAIR" → Creates maintenance record
   - Sends acknowledgment with reference #
         ↓
Landlord sees in "Real Requests" tab
         ↓
Landlord can reply within 23 hours
```

### **Landlord → Tenant Path:**

```
Landlord types reply in "Real Requests" tab
         ↓
App calls /api/whatsapp/reply endpoint
         ↓
Message sent via Meta WhatsApp Cloud API
         ↓
Tenant receives on WhatsApp within seconds
```

---

## ⚙️ Setup Requirements

### 1. **Meta WhatsApp Cloud API Credentials**
You need:
- `META_PHONE_NUMBER_ID` - Your WhatsApp Business Account phone number ID
- `META_ACCESS_TOKEN` - Bearer token for API authentication

Get these from [Meta Business Suite](https://business.facebook.com)

### 2. **Environment Variables**
Add to your `.env` file:
```env
META_PHONE_NUMBER_ID=120xxxxxxxxxxxxx
META_ACCESS_TOKEN=EAABxxxxxxxxxxxxxxx
```

### 3. **Webhook Configuration**
Configure your Meta webhook to POST to:
```
https://your-domain.com/api/whatsapp/webhook
```

Verify token can be anything (it's in the webhook handler for verification).

---

## 📱 API Endpoints (Server Side)

### **Receive Messages**
```
POST /api/whatsapp/webhook

Body from Meta:
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "id": "wamid.xxx",
          "from": "254712345678",
          "text": { "body": "COMPLAINT Water leak in kitchen" },
          "timestamp": "1234567890"
        }]
      }
    }]
  }]
}

Response: 200 OK
```

### **Get Real Threads**
```
GET /api/whatsapp/threads

Returns pending complaints/maintenance with message history:
[
  {
    "id": "complaint_id",
    "tenantId": "t1",
    "tenantName": "Wanjiku Kamau",
    "unit": "A-204",
    "property": "Kilimani Heights",
    "category": "Maintenance",
    "description": "Water leak in kitchen",
    "priority": "medium",
    "status": "pending",
    "messages": [
      { "id": "msg1", "direction": "in", "body": "...", "timestamp": "...", "channel": "tenant" }
    ]
  }
]
```

### **Send Reply**
```
POST /api/whatsapp/reply

Body:
{
  "complaintId": "complaint_id",
  "tenantId": "t1",
  "message": "Thank you for reporting. Our plumber will visit tomorrow morning."
}

Response:
{
  "success": true,
  "messageId": "wamid.xxx",
  "sentAt": "2026-05-04T14:30:00Z"
}
```

---

## 🖥️ Frontend Integration

### **API Endpoints (Client)**
```typescript
// Get real pending threads
api.getRealThreads()

// Get specific tenant's thread
api.getRealThread(tenantId)

// Send reply to tenant
api.sendReply(complaintId, tenantId, message)

// Update complaint status
api.updateComplaintStatus(complaintId, 'in_progress')
```

### **UI Features**
- **"Real Requests" Tab** - Shows all pending complaints/maintenance
- **Priority Badges** - Urgent, High, Medium, Low
- **Message Thread** - Full conversation history
- **23-Hour Timer** - Implicit in Meta API (your app respects it)
- **Search** - Filter tenants by name
- **Status Updates** - Track complaints as pending → in_progress → resolved

---

## 🚀 Testing the Flow

### **Option 1: Manual Testing (Recommended)**
1. Open WhatsApp Business app on Meta platform
2. Send test message from a tenant number:
   ```
   MAINTENANCE Shower head leaking
   ```
3. Check server logs - webhook should process it
4. Open WhatsApp Hub → "Real Requests" tab
5. Should see the request with acknowledgment message sent to tenant
6. Reply from landlord hub
7. Message shows in tenant's WhatsApp

### **Option 2: Sandbox Mode**
Meta provides a sandbox phone number for testing without real accounts. Use the `/api/whatsapp/send` endpoint to send test messages.

### **Option 3: Postman Testing**
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "wamid.test123",
            "from": "254712345678",
            "text": { "body": "COMPLAINT Broken window in bedroom" }
          }]
        }
      }]
    }]
  }'
```

---

## 📊 Database Schema

Messages are stored in `wa_messages` table:
```sql
CREATE TABLE wa_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  direction TEXT,           -- 'in' or 'out'
  body TEXT,
  timestamp TEXT,
  channel TEXT,             -- 'tenant', 'bot', or 'landlord'
  meta_message_id TEXT,     -- From Meta API
  from_phone TEXT,
  to_phone TEXT,
  status TEXT               -- 'sent', 'delivered', 'read'
);
```

Complaints are stored in `complaints` table:
```sql
CREATE TABLE complaints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  tenant_name TEXT,
  unit TEXT,
  property TEXT,
  category TEXT,            -- 'Maintenance' or 'General'
  description TEXT,
  priority TEXT,            -- 'urgent', 'high', 'medium', 'low'
  status TEXT,              -- 'pending', 'in_progress', 'resolved'
  source TEXT,              -- 'whatsapp', 'tenant', 'landlord'
  created_at TEXT
);
```

---

## ⚠️ Important Notes

### **23-Hour Window**
- Meta automatically closes conversations after 23 hours of inactivity
- After 23 hours, you CANNOT send messages to the tenant unless they message you first
- Your app enforces this by storing message metadata
- The time starts when the tenant last messaged

### **Message Limits**
- Respect Meta's rate limits (default: ~1000 API calls/day per app)
- Bulk messaging counts toward this limit
- Errors will be caught and logged

### **Phone Number Format**
- Stored as international: `+254712345678`
- Normalized by `kenyaUtils.formatPhone()`
- Must match tenant phone exactly

### **Message Categories**
The server auto-detects:
- **COMPLAINT**: Keywords: complain, issue, problem
- **MAINTENANCE**: Keywords: maintenance, maintain, fix, repair
- **GENERAL**: Everything else (processes as bot commands)

---

## 🔧 Customization

### **Add Custom Keywords**
Edit the webhook handler in `server.js`:
```javascript
const isComplaint = text.includes('BREAK') || text.includes('DAMAGED');
const isMaintenance = text.includes('LEAK') || text.includes('CRACK');
```

### **Change Auto-Response Message**
```javascript
const ackMessage = `Your custom message here with reference: #${complaintId.slice(-6)}`;
```

### **Implement Priority Detection**
```javascript
let priority = 'medium';
if (text.includes('URGENT') || text.includes('EMERGENCY')) priority = 'urgent';
if (text.includes('ASAP')) priority = 'high';
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not receiving messages | Check webhook URL is public & verify token matches |
| 401 Unauthorized | META_ACCESS_TOKEN invalid or expired |
| Messages not storing | Check SQLite connectivity & database permissions |
| Replies not sending | Verify phone number format (+254...) and tenant exists |
| 23-hour window error | Message a different text first to restart window |

---

## 📝 Summary

✅ Tenants can send real WhatsApp complaints/maintenance requests
✅ Auto-categorized and stored in database
✅ Landlord sees in "Real Requests" tab
✅ Can reply within 23 hours
✅ Full message history preserved
✅ Proper error handling & logging

**Next Steps:**
1. Get Meta API credentials
2. Configure webhook URL
3. Test with a real WhatsApp message
4. Monitor logs for any issues
