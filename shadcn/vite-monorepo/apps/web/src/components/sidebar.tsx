import { NavLink } from "react-router-dom"
import { useState } from "react"
import { useAuth } from "@/contexts/useAuth"
import { useTheme } from "@/components/theme-provider"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ROLE_HIERARCHY } from "@/lib/roles"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  LayoutDashboard,
  FileText,
  Target,
  CheckCircle2,
  Building,
  Users,
  LogOut,
  ChevronLeft,
  PanelLeft,
  Sun,
  Moon,
  ClipboardList,
  Clock,
  GitBranch,
  History,
  BarChart3,
  Bell,
  User,
} from "lucide-react"

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  minRole?: number
}

const allNavItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/my-plans", label: "My Plans", icon: ClipboardList },
  { to: "/plans", label: "All Plans", icon: FileText, minRole: ROLE_HIERARCHY.DIRECTORS },
  { to: "/pending-approvals", label: "Pending Approvals", icon: Clock, minRole: ROLE_HIERARCHY.DIRECTORS },
  { to: "/goals", label: "Goals", icon: Target, minRole: ROLE_HIERARCHY.DIRECTORS },
  { to: "/objectives", label: "Objectives", icon: CheckCircle2, minRole: ROLE_HIERARCHY.DIRECTORS },
  { to: "/users", label: "Users", icon: Users, minRole: ROLE_HIERARCHY.ADMIN },
  { to: "/offices", label: "Offices", icon: Building, minRole: ROLE_HIERARCHY.PRESIDENTS },
  { to: "/offices/tree", label: "Office Tree", icon: GitBranch, minRole: ROLE_HIERARCHY.DIRECTORS },
  { to: "/activity-log", label: "Activity Log", icon: History, minRole: ROLE_HIERARCHY.ADMIN },
  { to: "/reports", label: "Reports", icon: BarChart3, minRole: ROLE_HIERARCHY.ADMIN },
  { to: "/notifications", label: "Notifications", icon: Bell, minRole: ROLE_HIERARCHY.OFFICE_HEAD },
  { to: "/profile", label: "Profile", icon: User },
]

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }
  if (email) {
    return email[0].toUpperCase()
  }
  return "?"
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  isMobile,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  isMobile: boolean
}) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)

  const userRoleLevel = ROLE_HIERARCHY[user?.role ?? ""] ?? -1

  const visibleNavItems = allNavItems.filter((item) => {
    if (item.minRole !== undefined && userRoleLevel < item.minRole) return false
    return true
  })

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"]
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length])
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-svh flex-col border-r bg-sidebar transition-all duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Branding */}
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <img
          src="/chmsu-min.jpg"
          alt="CHMSU Logo"
          className="size-9 shrink-0 rounded-full border-2 border-sidebar-primary/30 object-cover"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              RBAP IDM
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
              Results-Based Action Plan
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="ml-auto size-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          {collapsed ? <PanelLeft className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name ?? user.email}
            className="size-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {getInitials(user?.name, user?.email)}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => {
              if (isMobile) onToggle()
            }}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2",
              )
            }
          >
            <item.icon className="size-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <button
          type="button"
          onClick={cycleTheme}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          {theme === "dark" ? (
            <Moon className="size-5 shrink-0" />
          ) : (
            <Sun className="size-5 shrink-0" />
          )}
          {!collapsed && (
            <span>
              Theme: {theme === "dark" ? "Dark" : theme === "system" ? "System" : "Light"}
            </span>
          )}
        </button>

        <Button
          variant="ghost"
          onClick={() => setShowLogoutConfirmation(true)}
          className={cn(
            "mt-1 w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "w-auto px-2",
          )}
        >
          <LogOut className="size-5 shrink-0" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </div>
      <ConfirmDialog
        open={showLogoutConfirmation}
        onOpenChange={setShowLogoutConfirmation}
        title="Sign out?"
        description="Are you sure you want to sign out of RBAP IDM?"
        confirmLabel="Sign out"
        onConfirm={logout}
      />
    </aside>
  )
}
