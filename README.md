# CHMSU RBAP IDM — Quality Management & Monitoring System

> **Institutional Dashboard Monitoring (IDM) for Results-Based Action Plans (RBAP)**  
> **Carlos Hilado Memorial State University (CHMSU)**

---

## 📌 Project Overview

**RBAP IDM** is an enterprise dashboard and monitoring platform designed for CHMSU staff and administrators to create, track, manage, and evaluate annual **Results-Based Action Plans (RBAP)** and **Quality Objectives Action Plans (QOAP)**.

The system enforces a hierarchical role-based access model mirroring the university's organizational structure, ensuring that data visibility and approval workflows follow administrative delegation from **Office Heads** up to **Vice Presidents**, **Presidents**, and **System Administrators**.

---

## 🏗 Repository Structure

This repository is structured as an umbrella monorepo containing submodules for the backend and frontend services:

```text
BACKEND for RBAP_IDM/
├── backend/                  # NestJS v11 + Prisma v7 + PostgreSQL (REST API, Port 3000)
├── shadcn/vite-monorepo/     # Turborepo active frontend workspace (Port 5173)
│   ├── apps/web/             # React 19 + Vite 8 + Tailwind CSS v4 + shadcn/ui
│   └── packages/ui/          # Shared UI component library (@workspace/ui)
├── docs/                     # Architecture, API flow maps, and requirement specs
├── PROJECT_STATUS.md         # Current build status & feature completion matrix
├── TASKS_NEXT.md             # Task queue & audit microtasks
├── frontend/                 # ⚠️ LEGACY (Angular v20) - Deprecated / Frozen
└── frontend_react/           # ⚠️ LEGACY (Old stub) - Deprecated / Frozen
```

---

## 🏛 Domain Hierarchy & Core Workflow

The system models university operational planning through a nested relational hierarchy:

```text
Office (Self-referencing tree via parentId)
  └── User (Role, Office Assignment)
        └── Plan (OfficeId, PlanningYear) — Unique per office per year
              └── Goal (PlanId, OfficeId, Target Budget Requirements & Allocation)
                    └── Objective (GoalId, Target Dates & Completion Status)
                          └── Remark (AuthorId, Goal/Objective Feedback Thread)
```

### Plan Workflow States
1. **DRAFT**: Office Head creates goals and objectives, sets budget requirements, and manages internal targets.
2. **SUBMITTED**: Plan is submitted upward to supervising Directors and Vice Presidents for review.
3. **APPROVED**: Plan receives formal sign-off from University Presidents or System Administrators.

---

## 🔐 Hierarchical Role-Based Access Control (RBAC)

Access control and data visibility are strictly derived from the user's assigned role and office position within the organizational tree:

| Role | Hierarchy Level | Navigation Access | Data Scope & Visibility |
|---|:---:|---|---|
| **`OFFICE_HEAD`** | Level 0 | Dashboard, My Plans | Own assigned office only |
| **`DIRECTORS`** | Level 1 | + All Plans, Pending Approvals, Goals, Objectives | Own office + direct subordinate child offices |
| **`VICE_PRESIDENTS`** | Level 2 | + All Plans, Pending Approvals, Goals, Objectives | Own office + full subordinate office tree |
| **`PRESIDENTS`** | Level 3 | + Offices | All active university offices (read & approval oversight) |
| **`ADMIN`** | Level 4 | + Users, Activity Log | Full system administration & data access |

---

## 🛠 Tech Stack Summary

### Backend Service (`backend/`)
- **Framework**: NestJS v11 with TypeScript
- **Database & ORM**: PostgreSQL 16+ via Prisma ORM v7 (`@prisma/adapter-pg`)
- **Authentication**: JWT (15-min access tokens, 7-day refresh tokens) + Google OAuth2 (`@chmsu.edu.ph` domain restricted)
- **Validation**: Global `ValidationPipe` with `class-validator` and `class-transformer` (`whitelist: true`)
- **Documentation**: Swagger UI at `/api/docs` (behind Basic Authentication, enabled via `SWAGGER_ENABLED=true`)
- **Observability**: Health checks (`/healthz`), structured logging, and request auditing

### Frontend Application (`shadcn/vite-monorepo/apps/web/`)
- **Framework**: React 19 + Vite 8
- **Workspace Tooling**: Turborepo
- **Styling**: Tailwind CSS v4 + `shadcn/ui` primitive components
- **State & Router**: React Router v7 + React Context API (`AuthContext`)
- **Form Handling**: `react-hook-form` + `zod` validation schemas
- **Http Client**: Axios with automatic 401 refresh token interceptor
- **Feedback**: `sonner` toast notifications

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v16+ running locally on port `5432`

---

### Step 1: Database Setup
Ensure PostgreSQL is running and create the local database:
```sql
CREATE DATABASE rbap_idm;
```

---

### Step 2: Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables (.env)
cp .env.example .env

# Run Prisma database migrations
npx prisma migrate dev

# Seed initial office tree and admin user
npm run seed

# Start NestJS development server (Port 3000)
npm run start:dev
```

The API will be accessible at `http://localhost:3000/api/v1`.  
Swagger documentation is available at `http://localhost:3000/api/docs`.

---

### Step 3: Frontend Setup
Open a new terminal window:
```bash
# Navigate to the active frontend monorepo
cd shadcn/vite-monorepo

# Install workspace dependencies
npm install

# Start Vite dev server (Port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser. API requests to `/api` are automatically proxied to `http://localhost:3000`.

---

## ⚡ Useful CLI Commands

### Backend (`backend/`)
| Command | Action |
|---|---|
| `npm run start:dev` | Launch NestJS API in watch mode (`:3000`) |
| `npm run build` | Compile NestJS TypeScript source (`nest build`) |
| `npm run lint` | Run ESLint flat config with auto-fix |
| `npm run test` | Run Jest unit tests |
| `npm run test:e2e` | Run Jest E2E integration tests |
| `npm run seed` | Seed initial office hierarchy and users (`ts-node prisma/seed.ts`) |
| `npx prisma studio` | Open Prisma database browser GUI |

### Frontend (`shadcn/vite-monorepo/`)
| Command | Action |
|---|---|
| `npm run dev` | Launch Vite dev server (`:5173`) |
| `npm run build` | Run typecheck and production build (`tsc -b && vite build`) |
| `npm run lint` | Run ESLint across workspace packages |
| `npm run typecheck` | Execute TypeScript type validation across workspace |

---

## 🔒 Environment Variables Reference

### Backend (`backend/.env`)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rbap_idm?schema=public"
PORT=3000
HOST="localhost"
FRONTEND_URL="http://localhost:5173"

# JWT Configuration
JWT_SECRET="your-access-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-jwt-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Google OAuth2 Credentials
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/v1/auth/google/callback"

# Swagger Documentation
SWAGGER_ENABLED=true
SWAGGER_USER="admin"
SWAGGER_PASSWORD="password"
```

---

## 📄 License & Attribution

Developed for **Carlos Hilado Memorial State University (CHMSU)**.  
All rights reserved. Internal institutional software.

"# main_rbap" 
