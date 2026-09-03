import { NavLink } from "react-router-dom"
import { useAuth } from "@/contexts/useAuth"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ChevronLeft,
  PanelLeft,
  Sun,
  Moon,
  Bell,
  User,
  Building2,
  Users,
} from "lucide-react"
import { useState } from "react"
import { ROLE_HIERARCHY, hasMinRole } from "@/lib/roles"
import { ConfirmDialog } from "@/components/confirm-dialog"

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? "?"
}

export function QmSidebar({
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
  const isAdmin = user?.role === "ADMIN"
  const canBrowseHierarchy = hasMinRole(
    user?.role,
    ROLE_HIERARCHY.VICE_PRESIDENTS
  )
  const qmNavItems = [
    { to: "/", label: "QM Dashboard", icon: LayoutDashboard },
    { to: "/qoap", label: "My QOAP Plan", icon: ClipboardList },
    ...(canBrowseHierarchy
      ? [{ to: "/offices", label: "Office Hierarchy", icon: Building2 }]
      : []),
    ...(isAdmin ? [{ to: "/users", label: "User Accounts", icon: Users }] : []),
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
  ] as const

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ]
    const index = order.indexOf(theme)
    setTheme(order[(index + 1) % order.length])
  }

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-40 flex h-svh flex-col border-r bg-sidebar transition-all duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <img
          src="/chmsu-min.jpg"
          alt="CHMSU Logo"
          className="size-9 shrink-0 rounded-full border-2 border-sidebar-primary/30 object-cover"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              Quality Management
            </p>
            <p className="truncate text-[10px] tracking-wider text-sidebar-foreground/50 uppercase">
              QOAP and QOM
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="ml-auto size-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
          {getInitials(user?.name, user?.email)}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name ?? "QM User"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {user?.office?.name ?? user?.role?.replace("_", " ")}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {qmNavItems.map((item) => (
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
                collapsed && "justify-center px-2"
              )
            }
          >
            <item.icon className="size-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-2">
        <button
          type="button"
          onClick={cycleTheme}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "dark" ? (
            <Moon className="size-5 shrink-0" />
          ) : (
            <Sun className="size-5 shrink-0" />
          )}
          {!collapsed && (
            <span>
              Theme:{" "}
              {theme === "dark"
                ? "Dark"
                : theme === "system"
                  ? "System"
                  : "Light"}
            </span>
          )}
        </button>
        <Button
          variant="ghost"
          onClick={() => setShowLogoutConfirmation(true)}
          className={cn(
            "mt-1 w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "w-auto px-2"
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
        description="Are you sure you want to sign out of Quality Management?"
        confirmLabel="Sign out"
        onConfirm={logout}
      />
    </aside>
  )
}
