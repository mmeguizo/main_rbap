# RBAP IDM — Active React Frontend Workspace

Active frontend application for the **CHMSU Dashboard-Based Quality Management and Monitoring System (RBAP IDM)**.

Built as a **Turborepo** workspace featuring **React 19**, **Vite 8**, **Tailwind CSS v4**, and **shadcn/ui** primitive components.

---

## 📁 Monorepo Workspace Layout

```text
shadcn/vite-monorepo/
├── apps/web/                 # Main Single Page Application (SPA)
│   ├── src/
│   │   ├── components/       # App layout, sidebar, headers, and detail modals
│   │   ├── contexts/         # AuthContext (state, JWT token management, user profile)
│   │   ├── hooks/            # Custom hooks (e.g. useRefreshOnFocus)
│   │   ├── lib/              # API endpoints (`api.ts`), role helpers (`roles.ts`), utilities
│   │   └── pages/            # Application view pages
│   ├── package.json
│   └── vite.config.ts        # Vite configuration with API proxy to :3000
└── packages/ui/              # Shared shadcn/ui primitive library (@workspace/ui)
    ├── src/
    │   ├── components/       # Exported primitive UI components (Button, Dialog, Table, Input, etc.)
    │   ├── lib/              # `utils.ts` (cn helper for Tailwind)
    │   └── styles/           # Global Tailwind CSS variables (`globals.css`)
    └── package.json
```

---

## 🗺 Application Page Inventory

| Route | Page Component | Allowed Roles | Key Features |
|---|---|---|---|
| `/` | `HomePage` | All authenticated users | KPI summary cards, plan status donut chart, plans-by-office bar chart, budget progress bar, pending approval feed |
| `/my-plans` | `MyPlansPage` | `OFFICE_HEAD`+ | Plans scoped strictly to user's assigned office |
| `/pending-approvals` | `PendingApprovalsPage` | `DIRECTORS`+ | Plans with `SUBMITTED` status from subordinate offices awaiting review |
| `/plans` | `PlansPage` | `DIRECTORS`+ | Institution-wide plans table + `PlanDetailModal` (CRUD, submit, approve, export PDF, import/export Excel) |
| `/goals` | `GoalsPage` | `DIRECTORS`+ | Goal tracking table with budget requirements & allocation columns + completion progress bars + `GoalDetailModal` with remarks thread |
| `/objectives` | `ObjectivesPage` | `DIRECTORS`+ | Actionable objectives table + `ObjectiveDetailModal` (target dates, status tracking) |
| `/notifications` | `NotificationsPage` | All users | Paginated in-app notification inbox with filters (all/unread/read), mark-as-read, and deep links to modals |
| `/office-tree` | `OfficeTreePage` | `PRESIDENTS`+ | Interactive visual organizational chart of office hierarchy |
| `/offices` | `OfficesPage` | `PRESIDENTS`+ | Office management table + `OfficeDetailModal` + Create Office dialog |
| `/users` | `UsersPage` | `ADMIN` | User accounts table + `UserDetailModal` (role assignment, office linking, activate/deactivate, soft delete) |
| `/activity-log` | `ActivityLogPage` | `ADMIN` | Security audit trail of system CRUD operations |
| `/profile` | `ProfilePage` | All users | Account profile overview + password change form |
| `/login` | `LoginPage` | Public | Google OAuth2 login + password login + local dev login |
| `/register` | `RegisterPage` | Public | User email registration with Google OAuth auto-linking |
| `/auth/callback` | `AuthCallbackPage` | Public | Google OAuth2 token receiver callback |

---

## 🧩 Shared Component Library (`@workspace/ui`)

All shared primitives reside in `packages/ui` and are imported into `apps/web` using the package alias:

```tsx
// Example imports
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Table, TableBody, TableCell } from "@workspace/ui/components/table";
```

To add new `shadcn/ui` components to `packages/ui`:
```bash
# Run from root of apps/web
pnpm dlx shadcn@latest add <component-name> -c apps/web
```

---

## 🔒 Authentication & Role-Based UI (RBAC)

### Auth State (`AuthContext.tsx`)
- Tokens (`access_token` and `refresh_token`) are stored in `localStorage`.
- `AuthContext` provides `user`, `role`, `office`, `login()`, `logout()`, and `isAuthenticated`.
- Axios interceptor automatically detects `401 Unauthorized` responses and attempts silent token refresh via `POST /api/v1/auth/refresh`.
- Session expiration automatically routes users to `/login?expired=true`.

### Role Helpers (`lib/roles.ts`)
```ts
// Check minimum role hierarchy level
hasMinRole(user.role, Role.DIRECTORS); // returns boolean

// Check if user can edit/manage an office's plans
canWriteOffice(user, targetOfficeId); // returns boolean
```

---

## 🛠 Local Development Commands

Run from the `shadcn/vite-monorepo` root or `apps/web`:

```bash
# Start Vite development server (Port 5173)
npm run dev

# Run type check and production build
npm run build

# Run ESLint across workspace
npm run lint

# Run TypeScript type check across workspace
npm run typecheck

# Format code with Prettier and Tailwind plugin
npm run format
```

---

## ⚙️ Vite API Proxy Configuration (`vite.config.ts`)

In development, Vite proxies all `/api` requests to the NestJS backend at `http://localhost:3000`:

```ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

