import { useLocation, Link } from "react-router-dom"
import { ChevronRight, Home } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { useAuth } from "@/contexts/useAuth"
import { hasMinRole, ROLE_HIERARCHY } from "@/lib/roles"

const breadcrumbLabels: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Dashboard" },
  "/my-plans": { label: "My Plans", parent: "/" },
  "/pending-approvals": { label: "Pending Approvals", parent: "/" },
  "/users": { label: "Users" },
  "/plans": { label: "Plans" },
  "/goals": { label: "Goals" },
  "/objectives": { label: "Objectives" },
  "/offices": { label: "Offices" },
  "/reports": { label: "Reports" },
}

export function HeaderBar() {
  const location = useLocation()
  const { user } = useAuth()
  const isPlanWorkspace = /^\/plans\/[^/]+\/view$/.test(location.pathname)
  const route = breadcrumbLabels[location.pathname] ??
    (isPlanWorkspace ? { label: "Plan Workspace", parent: hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS) ? "/plans" : "/my-plans" } : undefined)

  if (!route) return null

  interface Seg { label: string; to: string; icon?: typeof Home }
  const segments: Seg[] = [
    { label: "Home", to: "/", icon: Home },
  ]

  if (route.parent && route.parent !== "/") {
    const parent = breadcrumbLabels[route.parent]
    if (parent) {
      segments.push({ label: parent.label, to: route.parent })
    }
  }

  if (location.pathname !== "/") {
    segments.push({ label: route.label, to: location.pathname })
  }

  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {segments.map((seg, i) => (
            <span key={`${seg.to}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5" />}
              {i === segments.length - 1 ? (
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {i === 0 && <Home className="size-3.5" />}
                  {seg.label}
                </span>
              ) : (
                <Link
                  to={seg.to}
                  className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  {i === 0 && <Home className="size-3.5" />}
                  {seg.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {route.label}
        </h1>
      </div>
      <NotificationBell />
    </header>
  )
}
