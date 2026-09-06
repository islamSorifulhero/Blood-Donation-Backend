# Blood Donation & Emergency Assistance Platform — Backend

Backend-only REST API for the B7A6 assignment. Built with **Node.js, TypeScript, Express, PostgreSQL (Neon), Prisma ORM, Zod, and Redis**.

🚀 **Live API Base URL:** https://blood-donation-backend-bice.vercel.app

📡 **API Version Base URL:** https://blood-donation-backend-bice.vercel.app/api/v1

---

## 🚀 Project Overview

The Blood Donation & Emergency Assistance Platform is a backend REST API designed to connect blood donors with hospitals during emergency blood requirements.

The system provides:

- Secure authentication and authorization
- Donor and hospital management
- Hospital verification
- Emergency blood request management
- Automatic donor matching
- Blood compatibility checking
- Donor eligibility checking
- Location-based matching
- Donation scheduling and completion
- Online payment integration
- Notifications
- Admin dashboard and analytics
- Audit logging
- Redis caching
- Rate limiting and security middleware

---

## 👥 User Roles

### DONOR

Donors can:

- Register and login
- Create and manage donor profiles
- Set blood group
- Set availability
- Update location information
- Receive blood match notifications
- Accept or decline blood requests
- Schedule donations
- Complete, cancel, reschedule, or mark donations as no-show
- View notifications
- Track donation history

### HOSPITAL

Hospitals can:

- Register and login
- Create and manage hospital profiles
- Submit emergency blood requests
- View their blood requests
- Manage request lifecycle
- View matched donors
- Manage donation-related activities
- Make supported payments

Hospital accounts require admin verification before they can create verified emergency blood requests.

### ADMIN

Admins can:

- Manage users
- Manage donor and hospital accounts
- Verify hospitals
- Verify blood requests
- View dashboard analytics
- View audit logs
- Moderate users
- Manage user status
- Monitor requests and donations
- Monitor payment activity

---

# 🏗️ Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| TypeScript | Type safety |
| Express.js | REST API framework |
| PostgreSQL | Relational database |
| Neon PostgreSQL | Cloud database |
| Prisma ORM | Database ORM |
| Zod | Request validation |
| JWT | Authentication |
| bcrypt | Password hashing |
| Redis | Optional caching |
| Stripe | Payment integration |
| SSLCommerz | Payment integration |
| Helmet | HTTP security |
| CORS | Cross-origin security |
| Vercel | Deployment |
| Postman | API testing/documentation |

---

# 📁 Full Folder Structure

```text
.
├── api/
│   └── index.ts
│
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   ├── db.ts
│   │   └── redis.ts
│   │
│   ├── middlewares/
│   │   ├── auth.ts
│   │   ├── role.ts
│   │   ├── validateRequest.ts
│   │   ├── rateLimiter.ts
│   │   └── error.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── register
│   │   │   ├── login
│   │   │   ├── Google sign-in
│   │   │   ├── refresh
│   │   │   └── logout
│   │   │
│   │   ├── user/
│   │   │   └── generic /users/me
│   │   │
│   │   ├── donor/
│   │   │   ├── donor profile CRUD
│   │   │   └── donor search/discovery
│   │   │
│   │   ├── hospital/
│   │   │   ├── hospital profile CRUD
│   │   │   └── admin verification workflow
│   │   │
│   │   ├── bloodRequest/
│   │   │   ├── create
│   │   │   ├── list
│   │   │   ├── verify
│   │   │   ├── cancel
│   │   │   ├── matches
│   │   │   ├── donor response
│   │   │   └── matching.service.ts
│   │   │
│   │   ├── donation/
│   │   │   ├── schedule
│   │   │   ├── complete
│   │   │   ├── cancel
│   │   │   ├── no-show
│   │   │   └── reschedule
│   │   │
│   │   ├── payment/
│   │   │   ├── initiate
│   │   │   ├── list
│   │   │   ├── get
│   │   │   └── providers/
│   │   │       ├── stripe.provider.ts
│   │   │       ├── sslcommerz.provider.ts
│   │   │       ├── types.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── notification/
│   │   │   ├── list
│   │   │   ├── unread count
│   │   │   ├── mark read
│   │   │   └── mark all read
│   │   │
│   │   └── admin/
│   │       ├── user management
│   │       ├── dashboard stats
│   │       └── audit logs
│   │
│   ├── routes/
│   │   └── v1/
│   │       ├── auth.routes.ts
│   │       ├── user.routes.ts
│   │       ├── donor.routes.ts
│   │       ├── hospital.routes.ts
│   │       ├── bloodRequest.routes.ts
│   │       ├── donation.routes.ts
│   │       ├── payment.routes.ts
│   │       ├── notification.routes.ts
│   │       ├── admin.routes.ts
│   │       └── index.ts
│   │
│   ├── utils/
│   │   ├── ApiError.ts
│   │   ├── sendResponse.ts
│   │   ├── catchAsync.ts
│   │   ├── pagination.ts
│   │   ├── audit.ts
│   │   ├── notify.ts
│   │   ├── bloodCompatibility.ts
│   │   ├── geo.ts
│   │   ├── jwt.ts
│   │   ├── hash.ts
│   │   ├── parseDuration.ts
│   │   ├── generateTransactionId.ts
│   │   └── cache.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── .env.example
├── package.json
├── tsconfig.json
├── vercel.json
└── blood-donation-backend.postman_collection.json