# PropertyHub Kenya - Property Management System

A comprehensive property management solution for Kenyan landlords, featuring WhatsApp integration for tenant communication.

## Features

- **Property & Tenant Management**: Track properties, units, and tenants
- **WhatsApp Bot**: Tenants can check balance, file complaints, request maintenance via WhatsApp
- **Real-time Notifications**: Landlord dashboard with WhatsApp notifications
- **Payment Tracking**: Record payments and send automated receipts
- **Persistent Storage**: SQLite database for data persistence

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env` and configure:
   - `META_ACCESS_TOKEN`: Your WhatsApp Business API token
   - `META_PHONE_NUMBER_ID`: Your WhatsApp Business phone number ID
   - `META_VERIFY_TOKEN`: Token for webhook verification
   - `MPESA_*`: M-Pesa integration (optional)

3. **Start the Application**
   ```bash
   # Backend
   node server.js

   # Frontend (new terminal)
   npm run dev
   ```

## WhatsApp Integration

- **Webhook URL**: `https://your-domain.com/api/whatsapp/webhook`
- **Supported Commands**:
  - `MENU` - Show available options
  - `BALANCE` - Check rent balance
  - `RECEIPT` - Request payment receipt
  - `COMPLAINT` - File a complaint
  - `MAINTENANCE` - Request repairs
  - `RELOCATE` - Request unit transfer
  - `PAY` - Get payment info

## Architecture

- **Backend**: Node.js + Express + SQLite + WhatsApp Cloud API
- **Frontend**: React + TypeScript + Tailwind CSS
- **Database**: SQLite with better-sqlite3
- **Real-time Sync**: Polling-based sync between frontend and backend

## Deployment

1. Set up webhook URL in Meta Developer Console
2. Deploy backend to a server (e.g., Railway, Heroku)
3. Set `VITE_API_URL` in frontend to backend URL
4. Deploy frontend to Vercel/Netlify

## Troubleshooting

- **WhatsApp not working**: Check Meta credentials and webhook URL
- **Database errors**: Ensure better-sqlite3 is installed (may require Python on Windows)
- **Sync issues**: Check network connectivity and API endpoints
