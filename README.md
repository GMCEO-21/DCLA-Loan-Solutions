# DCLA Loan Solutions - Lending Management System

A loan and collections management system with a NestJS + PostgreSQL backend and a React + MUI frontend.

For up-to-date design and flow documentation:

- `ARCHITECTURE.md` (full system architecture, module boundaries, role model, finance safety rules)
- `COLLECTIONS_FLOW.md` (focused walkthrough of payment posting, manager approvals, reversals, and collection summaries)

## Tech Stack

### Backend

- NestJS (TypeScript)
- PostgreSQL
- TypeORM
- JWT auth with refresh tokens
- Validation via `class-validator` and `ValidationPipe`

### Frontend

- React + TypeScript
- Vite
- Material-UI (MUI)
- React Router
- Axios
- Zustand for auth state

## Project Structure

```
DCLA-Loan-Solutions/
+-- server/                 # NestJS API
¦   +-- src/
¦   ¦   +-- auth/           # Auth, JWT, guards
¦   ¦   +-- centers/        # Centers feature
¦   ¦   +-- collections/    # Collections feature
¦   ¦   +-- loans/          # Loans feature
¦   ¦   +-- members/        # Members feature
¦   ¦   +-- portfolio/      # Portfolio reporting
¦   ¦   +-- repayments/     # Repayment schedules & allocations
¦   ¦   +-- roles/          # Roles
¦   ¦   +-- savings/        # Savings
¦   ¦   +-- transactions/   # Transactions history
¦   ¦   +-- main.ts         # App bootstrap
¦   +-- package.json
+-- client/                 # React app
¦   +-- src/
¦   ¦   +-- components/     # Shared UI
¦   ¦   +-- features/       # Feature modules (auth, member, collections, etc.)
¦   ¦   +-- routes/         # App routes
¦   ¦   +-- utils/          # Axios client, helpers
¦   ¦   +-- main.tsx        # App entry
¦   +-- package.json
+-- README.md
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+

### Backend (NestJS)

1. Install dependencies:

```bash
cd server
npm install
```

2. Configure `.env` in `server/`:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
TYPEORM_SYNC=false
TYPEORM_RUN_MIGRATIONS=true
```

3. Run migrations and start:

```bash
npm run migration:run
npm run start:dev
```

The API runs at `http://localhost:3000/api`.

### Frontend (React)

1. Install dependencies:

```bash
cd client
npm install
```

2. Configure `.env` in `client/`:

```env
VITE_API_URL=http://localhost:3000/api
```

3. Start:

```bash
npm run dev
```

The web app runs at `http://localhost:5173`.

## Key Flows

- Auth: `/api/auth/login` and `/api/auth/refresh` return access + refresh tokens.
- Global auth guards protect API routes; only `@Public` endpoints bypass JWT.
- Collections: server computes and persists daily collection data; client derives
  per-member status (paid/partial/unpaid) and export reports.

## Scripts

### Server

```bash
npm run start:dev
npm run migration:run
npm run test
```

### Client

```bash
npm run dev
npm run build
npm run lint
```

## Notes

- The previous README content described an Express/MVC app. The current backend
  is NestJS + TypeORM.
