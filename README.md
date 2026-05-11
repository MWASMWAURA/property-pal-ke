# PropertyHub Kenya

PropertyHub Kenya is a property management platform built for landlords and property managers in Kenya. It combines a React/Tailwind dashboard with a Node.js backend to manage properties, tenants, payments, complaints, and WhatsApp/SMS communication.

## What it does

- Manage multiple properties, units, and tenants
- Track rent payments, overdue balances, and lease expiries
- File and resolve tenant complaints
- Send landlord notifications and tenant messages via WhatsApp/SMS
- Support landlord account registration with phone verification
- Sync frontend state with backend data for live dashboard use

## Primary features

- **Landlord onboarding** with registration, login, and profile settings
- **Landlord/tenant data model** with separate landlord accounts and tenant records
- **Property management** including units, rent, and billing details
- **Payment recording** and receipt generation for tenants
- **Complaint logging** with status tracking
- **WhatsApp bot support** for tenant and landlord command flows
- **SMS fallback** when WhatsApp is unavailable
- **Dashboard analytics** with charts, KPI cards, and urgent action prompts

## Architecture

### Backend

- Express server in `server.cjs`
- Supports both PostgreSQL (via `pg`) and SQLite (via `better-sqlite3`)
- JWT authentication for landlords
- OTP verification for registration
- WhatsApp and SMS messaging integrations
- Data models for landlords, properties, tenants, payments, complaints, notifications, and messages

### Frontend

- React + TypeScript + Vite
- Tailwind CSS for layout and responsive UI
- `src/lib/data-store.tsx` handles authentication, state, syncing, and local storage
- App shell with desktop sidebar and mobile bottom navigation
- Multi-step registration flow with phone verification

## Setup

### Prerequisites

- Node.js 20+ recommended
- npm
- Optional: PostgreSQL or Supabase if not using local SQLite

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and set values:

- `VITE_API_URL` - frontend API base URL (e.g. `http://localhost:5173`)
- `DATABASE_URL` - optional PostgreSQL/Supabase connection string
- `META_ACCESS_TOKEN` - WhatsApp Cloud API token
- `META_PHONE_NUMBER_ID` - WhatsApp phone number ID
- `META_VERIFY_TOKEN` - webhook verification token
- `SMS_API_TOKEN` - SMS provider token (Talksasa)
- `SMS_SENDER_ID` - SMS sender identifier
- `JWT_SECRET` - secret used for JWT generation
- `RESEND_API_KEY` - email provider API key if email is used

### Run locally

```bash
npm run dev
```

Backend is served by `node server.cjs` and frontend by Vite.

## Important backend routes

### Auth

- `POST /api/auth/register` - landlord registration
- `POST /api/auth/login` - landlord login
- `POST /api/auth/send-otp` - send phone verification code
- `POST /api/auth/verify-otp` - verify registration OTP
- `PUT /api/auth/me` - update landlord profile

### Sync endpoints

- `GET /api/sync/properties` - landlord property list
- `GET /api/sync/tenants` - landlord tenant list
- `GET /api/sync/payments` - landlord payment history
- `GET /api/sync/complaints` - landlord complaints

### Messaging

- `POST /api/whatsapp/webhook` - WhatsApp incoming webhook
- `POST /api/notifications` - send a notification
- `POST /api/notifications/bulk` - bulk notifications

## Known limitations and improvement opportunities

### Multi-landlord / multi-tenant concerns

- `server.cjs` already stores `landlord_id` for each entity, but some endpoints are still broad:
  - `/api/sync/notifications` returns all notifications without landlord scoping
  - `/api/sync/whatsapp` returns all WhatsApp messages without landlord scoping
  - `/api/notifications` and `/api/notifications/bulk` are not protected by auth
- In-memory arrays such as `properties`, `tenants`, `payments`, and `complaints` are loaded globally at startup from all rows, which can leak cross-landlord data and does not scale.
- Several command flows rely on text matching by tenant name only, which can return the wrong tenant for landlords with duplicate or similar tenant names.
- Recommendation: enforce `landlord_id` on every query and every route, and avoid global in-memory load for multi-tenant production use.

### Account creation / registration performance

- Registration waits on `bcrypt.hash()` and an optional admin SMS notification before responding.
- Sending SMS synchronously during registration causes extra latency if SMS service is slow.
- Recommendation: move admin notification to a background queue or fire-and-forget task, and make registration respond once the landlord record is created.
- OTP verification also relies on network timing; use a dedicated async queue for OTP logs and avoid blocking the main request if external services are slow.

### UX / UI responsiveness observations

- The app shell has both desktop sidebar and mobile bottom navigation; that is a good base for responsive navigation.
- Dashboard sections use Tailwind grid breakpoints and responsive tables. Mobile table fallback is implemented by hiding columns and using row-level stacking.
- Potential improvements:
  - Add explicit mobile-friendly action buttons instead of hidden desktop-only controls
  - Provide consistent empty states for all list pages
  - Use a persistent mobile header or breadcrumbs so users always know where they are on smaller screens
  - Ensure dialogs and forms use `max-h-[90vh]` and do not overflow on small phones
  - Improve onboarding copy for the WhatsApp bot commands and tenant flows

### UX / function-specific issues

- `RECORD_PAYMENT` and complaint text commands can fail for ambiguous tenant names, missing unit identifiers, or typos.
- Receipt delivery should clearly notify landlords when WhatsApp balance is zero and fallback to SMS only when available.
- The phone verification and password creation flow is solid, but it can be made faster by validating fields before sending OTP.

## Recommended next steps

1. Harden route authorization by adding landlord scoping everywhere
2. Convert broad sync endpoints into authenticated, landlord-scoped APIs
3. Replace global in-memory data caches with per-request queries for each landlord
4. Separate registration notification from the user-facing response
5. Improve bot tenant selection using unique phone or tenant ID instead of name text matching
6. Add UI feedback for low WhatsApp/SMS balance and failed delivery paths

## Development notes

- `src/lib/data-store.tsx` manages frontend state and sync operations.
- `src/components/auth/AuthDialog.tsx` contains the multi-step registration and login flow.
- `src/components/layout/Sidebar.tsx` and `src/components/layout/Topbar.tsx` manage the responsive app layout.
- `server.cjs` is the monolithic backend with auth, data persistence, bot logic, and messaging.

## Troubleshooting

- If WhatsApp is not functioning, verify `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, and webhook configuration.
- If SMS is not working, verify `SMS_API_TOKEN` and `SMS_SENDER_ID`.
- If registration hangs, check whether the SMS provider or OTP verification endpoint is slow.
- For local testing, `DATABASE_URL` may be omitted to use SQLite fallback.
