# MarkGo

MarkGo is a multi-company SaaS platform for small businesses to manage billing, inventory and finance in one place. Each company gets its own workspace, with separate dashboards for company admins, customers, vendors and the platform super admin.

## Features

- **Company workspaces:** company registration, subscription plans, company profile and settings
- **Catalog:** products (stock, tax-inclusive/exclusive pricing, cost price) and services, with a shared Unit & Category list
- **Parties:** customer and vendor management with invite-link password setup
- **Transactions:** invoices (sales), bills (purchases) and payments
- **Reports:** sales, purchases, transactions, profit and loss, product-wise and service-wise profit and loss, and customer, vendor, product and service lists
- **Dashboards:** summary cards and charts for company admins; read-only dashboards for customers (invoices, purchases, catalog) and vendors (bills, supplied items, catalog)
- **Super admin console:** manage companies, plans and subscriptions

## Roles

| Role | Access |
|---|---|
| Super Admin | Platform management: companies, plans, subscriptions |
| Company Admin | Full access to their own company's data |
| Customer | Read-only view of their own invoices and the catalog |
| Vendor | Read-only view of their own bills and the catalog |

## Tech stack

- **Frontend:** React, Vite, React Router, Tailwind CSS, Axios, Lucide icons
- **Backend:** Node.js, Express, Zod validation
- **Database:** MySQL with Prisma ORM
- **Security:** JWT in HTTP-only cookies, refresh token rotation, CSRF protection, bcrypt password hashing, rate limiting, Helmet, CORS allow-list, per-company data scoping

## Getting started

1. Clone the repo and install dependencies in `backend/` and `frontend/`
2. Copy `backend/.env.example` to `backend/.env` and fill in the values
3. Run the Prisma migrations, then seed the plans and super admin
4. Start the backend (`npm run dev`) and the frontend (`npm run dev`)

## Status

Under active development.
