import React, { Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/useAuth"
import { ROLE_HIERARCHY } from "@/lib/roles"
import { RoleGuard } from "@/components/role-guard"
import { QmAccessGuard } from "@/components/qm-access-guard"
import { RbapWorkspaceGuard } from "@/components/rbap-workspace-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Toaster } from "@/components/sonner"
import { ErrorBoundary } from "@/components/error-boundary"
import { isQmWorkspaceActive } from "@/lib/qm"

const LoginPage = React.lazy(() => import("@/pages/LoginPage"))
const RegisterPage = React.lazy(() => import("@/pages/RegisterPage"))
const AuthCallbackPage = React.lazy(() => import("@/pages/AuthCallbackPage"))
const HomePage = React.lazy(() => import("@/pages/HomePage"))
const QmDashboardPage = React.lazy(() => import("@/pages/QmDashboardPage"))
const UsersPage = React.lazy(() => import("@/pages/UsersPage"))
const OfficesPage = React.lazy(() => import("@/pages/OfficesPage"))
const OfficeTreePage = React.lazy(() => import("@/pages/OfficeTreePage").then(m => ({ default: m.OfficeTreePage })))
const PlansPage = React.lazy(() => import("@/pages/PlansPage"))
const PlanDocumentPage = React.lazy(() => import("@/pages/PlanDocumentPage"))
const MyPlansPage = React.lazy(() => import("@/pages/MyPlansPage"))
const PendingApprovalsPage = React.lazy(() => import("@/pages/PendingApprovalsPage"))
const GoalsPage = React.lazy(() => import("@/pages/GoalsPage"))
const ObjectivesPage = React.lazy(() => import("@/pages/ObjectivesPage"))
const ActivityLogPage = React.lazy(() => import("@/pages/ActivityLogPage"))
const ReportsPage = React.lazy(() => import("@/pages/ReportsPage"))
const NotificationsPage = React.lazy(() => import("@/pages/NotificationsPage"))
const ProfilePage = React.lazy(() => import("@/pages/ProfilePage"))
const QoapPage = React.lazy(() => import("@/pages/QoapPage"))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function WorkspaceDashboard() {
  const { user } = useAuth()
  return isQmWorkspaceActive(user) ? <QmDashboardPage /> : <HomePage />
}

export function App() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
      <Routes>
<Route path="/login" element={<LoginPage />} />
         <Route path="/register" element={<RegisterPage />} />
         <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <DashboardLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <WorkspaceDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="my-plans"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <RbapWorkspaceGuard>
                  <MyPlansPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="pending-approvals"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.DIRECTORS}>
                <RbapWorkspaceGuard>
                  <PendingApprovalsPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="users"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.ADMIN}>
                <UsersPage />
              </RoleGuard>
            }
          />
          <Route
            path="plans"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.DIRECTORS}>
                <RbapWorkspaceGuard>
                  <PlansPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="plans/:id/view"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <RbapWorkspaceGuard>
                  <PlanDocumentPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="plans/:id/edit"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <RbapWorkspaceGuard>
                  <PlanDocumentPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="plans/new/edit"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <RbapWorkspaceGuard>
                  <PlanDocumentPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="goals"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.DIRECTORS}>
                <RbapWorkspaceGuard>
                  <GoalsPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="objectives"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.DIRECTORS}>
                <RbapWorkspaceGuard>
                  <ObjectivesPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="qoap"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <QmAccessGuard>
                  <QoapPage />
                </QmAccessGuard>
              </RoleGuard>
            }
          />
          <Route
            path="offices"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.DIRECTORS}>
                <OfficesPage />
              </RoleGuard>
            }
          />
          <Route
            path="offices/tree"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.DIRECTORS}>
                <OfficeTreePage />
              </RoleGuard>
            }
          />
          <Route
            path="activity-log"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.ADMIN}>
                <RbapWorkspaceGuard>
                  <ActivityLogPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="reports"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.ADMIN}>
                <RbapWorkspaceGuard>
                  <ReportsPage />
                </RbapWorkspaceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="notifications"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <NotificationsPage />
              </RoleGuard>
            }
          />
          <Route
            path="profile"
            element={
              <RoleGuard minRole={ROLE_HIERARCHY.OFFICE_HEAD}>
                <ProfilePage />
              </RoleGuard>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
