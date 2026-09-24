# Norcia Finance — Full-Stack Website

This package converts the Norcia Finance static site into a small production-style full-stack system.

## Architecture

Browser
→ Frontend (HTML/CSS/JS)
→ Node.js + Express API
→ PostgreSQL + Prisma

The system records:
- anonymous page views
- section views
- service clicks
- phone/WhatsApp clicks
- enquiry submissions
- lead status changes

It also includes a password-protected admin dashboard.

## 1. Requirements

Install:
- Node.js 20+ (LTS recommended)
- PostgreSQL 15+
- Git (optional but recommended)

## 2. Start PostgreSQL

Create a database called:

norcia_finance

Example local PostgreSQL connection:

postgresql://postgres:YOUR_PASSWORD@localhost:5432/norcia_finance?schema=public

## 3. Configure backend

Open `backend/.env.example`, copy it to:

backend/.env

Then set:

DATABASE_URL=...
JWT_SECRET=use-a-long-random-secret
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-password
FRONTEND_URL=http://localhost:5500

Never commit `.env` to GitHub.

## 4. Install backend

Open a terminal:

cd backend
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed

Then start:

npm run dev

API:
http://localhost:5000

Admin:
http://localhost:5000/admin/

## 5. Start frontend locally

From the `frontend` directory:

python -m http.server 5500

Open:

http://localhost:5500

The frontend talks to:

http://localhost:5000/api

For another backend URL, add this before loading `script.js` in `frontend/index.html`:

<script>
  window.NORCIA_API_BASE = "https://api.yourdomain.com/api";
</script>

## 6. What happens when a customer submits a lead?

The browser sends:

POST /api/leads

The backend validates the request and stores it in PostgreSQL.

The dashboard then shows:
- customer name
- phone
- service
- message
- date/time
- lead status

The browser also opens WhatsApp to 9411187313.

## 7. What analytics are collected?

Only useful site events are recorded:
- page_view
- section_view
- service_click
- phone_click
- whatsapp_click
- enquiry_submitted

The system creates a random browser session ID. Do not use analytics to collect unnecessary personal information.

## 8. Production deployment

### Frontend
Deploy `frontend/` to Vercel or Netlify.

Set:

window.NORCIA_API_BASE = "https://YOUR-BACKEND-DOMAIN/api"

### Backend
Deploy `backend/` to a Node-compatible service such as Render, Railway, Fly.io, or your own VPS.

Production environment variables:
- NODE_ENV=production
- PORT=(provided by host)
- DATABASE_URL=(your managed PostgreSQL URL)
- FRONTEND_URL=https://www.yourdomain.in
- JWT_SECRET=(long random secret)
- ADMIN_EMAIL=...
- ADMIN_PASSWORD=...

Build/deploy commands:
- install: `npm install`
- build step: `npx prisma generate`
- start: `npm start`

After deployment run:

npx prisma db push
npm run prisma:seed

For a serious production database, use Prisma migrations rather than repeatedly using `db push`.

## 9. Custom domain

Recommended:
www.norciafinance.in → frontend
api.norciafinance.in → backend

Then set:

FRONTEND_URL=https://www.norciafinance.in

and in frontend:

window.NORCIA_API_BASE = "https://api.norciafinance.in/api"

## 10. Important security checklist

Before real customer use:
- use HTTPS
- use a strong admin password
- use a long random JWT secret
- keep `.env` private
- restrict CORS to your real frontend domain
- use managed PostgreSQL backups
- add a privacy policy and appropriate consent/notice
- collect only necessary personal data
- consider email/WhatsApp notifications after the core system is tested
- do not store passwords or sensitive documents in plain text
- add stronger admin security (2FA, audit logs) for a larger operation

## 11. Database tables

`AdminUser`
- admin accounts

`Lead`
- customer enquiries

`AnalyticsEvent`
- website events

## 12. Next production upgrades

Possible next steps:
- email notification for every new lead
- WhatsApp Business API integration
- CRM-style lead pipeline
- date-range analytics
- CSV export
- multiple staff/admin accounts
- 2FA
- Google Analytics/Consent Mode
- document upload with secure object storage
- EMI calculator
- lender/application tracking

