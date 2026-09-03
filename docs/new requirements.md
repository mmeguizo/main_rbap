# Implementation Brief: QOAP and QOM Integration (RBAP IDM)

## 1. Project Overview & Objective
**Goal:** Extend the existing CHMSU RBAP IDM system[cite: 3] to integrate the Quality Management (QM) department's workflow. 
**Core Concept:** Avoid data duplication by implementing a relational hierarchy where the Planning department's Results-Based Action Plan (RBAP) is the central source of truth.
*   **Grandma (Source of Truth):** RBAP (`Plan` / `Goal` models)[cite: 3].
*   **Mom (Extension):** QOAP (Quality Objectives and Action Plan)[cite: 3].
*   **Child (Execution):** QOM (Quality Objectives and Monitoring)[cite: 3].

Additionally, the system requires **context-aware branding**: if a user logs in from the QM department, the UI must dynamically switch to QM-specific branding and layouts, while Planning department users retain the default UI.

---

## 2. Phase 1: Database Architecture (Prisma)
**Task:** Update `backend/prisma/schema.prisma`[cite: 3] to support the new QOAP and QOM entities without breaking the existing `Plan`, `Goal`, or `Objective` workflows.

1.  **Define the QOAP Model:**
    *   Create a `Qoap` model that acts as an extension of the existing RBAP structure.
    *   Establish a foreign key relationship (`rbapId` or `goalId`) linking it directly to the corresponding RBAP record.
    *   Add QM-specific fields (e.g., `intendedOutcomes`) that are not present in the RBAP.
2.  **Define the QOM Model:**
    *   Create a `Qom` model to represent quarterly monitoring cycles.
    *   Establish a foreign key (`qoapId`) linking it to the `Qoap` model.
    *   Include execution fields: `monitoringPeriod` (e.g., Q1, Q2), `performance`, `overallDataResult`, and `movDataSource`.
3.  **Generate & Migrate:**
    *   Run `npx prisma format`, `npx prisma migrate dev`, and `npx prisma generate` to apply the schema.

---

## 3. Phase 2: Backend Development (NestJS)
**Task:** Build the necessary REST API endpoints inside the `backend/` directory[cite: 3] to serve merged data to the frontend.

1.  **Module Creation:**
    *   Generate `QoapModule` and `QomModule` (including Controllers, Services, and DTOs) using the Nest CLI.
2.  **Dynamic Data Retrieval (The Merge):**
    *   In the `QoapService`, write Prisma queries that use the `include` directive to fetch the QOAP record *along with* the parent RBAP data dynamically.
    *   **Strict Rule:** Do not duplicate RBAP fields (Breakthrough Goals, Strategic Objectives, Indicators, Targets, etc.) into the QOAP table. Always pull them from the relation[cite: 3].
3.  **Access Control:**
    *   Utilize the existing `OfficesService`[cite: 3] to enforce scoping. Ensure that QM-specific endpoints validate if the requesting user belongs to the QM office or has an `ADMIN` role[cite: 3].
    *   Apply `@Roles()` decorators and `JwtAuthGuard` strictly[cite: 3].
4.  **Audit & Side Effects:**
    *   Ensure any mutations (creates/updates) to QOAP or QOM trigger an `ActivityLog` entry[cite: 3].

---

## 4. Phase 3: Frontend Theming & Branding (React/Vite)
**Task:** Implement dynamic, office-aware theming in the `shadcn/vite-monorepo`[cite: 3].

1.  **Context Utilization:**
    *   Tap into the existing `AuthContext` to evaluate `user.office`[cite: 3].
2.  **Dynamic CSS Variables:**
    *   In your global CSS file, define a `.theme-qm` class that overrides the default CSS variables used by `shadcn/ui` (e.g., `--primary`, `--radius`, `--background`).
3.  **Layout Wrapper Component:**
    *   Create a higher-order component or layout wrapper (e.g., `DepartmentLayoutProvider`).
    *   If `user.office` indicates QM, apply the `.theme-qm` class to the HTML body or main wrapper.
    *   Conditionally render the sidebar/navigation links based on whether the user is in Planning vs. QM to ensure they only see relevant modules.

---

## 5. Phase 4: Frontend Feature Development
**Task:** Build the UI components for QM users to interact with QOAP and QOM data.

1.  **API Client Updates:**
    *   Update `apps/web/src/lib/api.ts`[cite: 3] to include Axios methods for the new `/api/v1/qoap` and `/api/v1/qom` endpoints.
2.  **View Components:**
    *   Build a **QOAP Data Grid/Table** that visually merges the Grandma (RBAP) and Mom (QOAP) data into a single unified row for the end-user.
    *   Build an expandable row or dedicated modal for the **QOM (Child) entries**, allowing QM staff to input their quarterly tracking (Performance, MOV, etc.)[cite: 3].
3.  **Form Validation:**
    *   Use `react-hook-form` and `zod`[cite: 3] to validate QOAP and QOM inputs before submitting to the backend. Ensure errors surface via `Sonner` toasts[cite: 3].

---

## 6. Execution Checklist for the AI Agent
* [ ] Verify current Prisma schema and identify exact relation points for `Qoap`.
* [ ] Draft the Prisma schema updates and ask for user approval before running migrations.
* [ ] Scaffold NestJS modules and write DTOs using `class-validator`[cite: 3].
* [ ] Implement backend read operations ensuring Prisma `include` merges the hierarchy.
* [ ] Scaffold React routing and the `DepartmentLayoutProvider` for dynamic branding.
* [ ] Build the UI tables and forms for QOAP/QOM.
* [ ] Verify endpoints with Playwright API tests and Jest unit tests[cite: 3].