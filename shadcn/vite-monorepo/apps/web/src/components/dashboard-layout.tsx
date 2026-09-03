import { useState, useEffect } from "react"
import { Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/useAuth"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Sidebar } from "@/components/sidebar"
import { QmSidebar } from "@/components/qm-sidebar"
import { HeaderBar } from "@/components/header-bar"
import { isQmWorkspaceActive } from "@/lib/qm"
import { PanelLeft } from "lucide-react"

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    // Schedule initial match in a microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => setMatches(mq.matches))
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [query])
  return matches
}

export function DashboardLayout() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 767px)")

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev)
    } else {
      setCollapsed((prev) => !prev)
    }
  }

  return (
    <div className="relative flex min-h-svh">
      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 animate-in bg-black/20 backdrop-blur-xs fade-in-0"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="print:hidden">
        {isQmWorkspaceActive(user) ? (
          <QmSidebar
            collapsed={isMobile ? false : collapsed}
            onToggle={toggleSidebar}
            mobileOpen={isMobile ? mobileOpen : true}
            isMobile={isMobile}
          />
        ) : (
          <Sidebar
            collapsed={isMobile ? false : collapsed}
            onToggle={toggleSidebar}
            mobileOpen={isMobile ? mobileOpen : true}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Mobile hamburger */}
      {isMobile && !mobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-3 left-3 z-20 size-8 rounded-lg border bg-background shadow-sm print:hidden"
        >
          <PanelLeft className="size-4" />
        </Button>
      )}

      <main
        className={cn(
          "flex-1 p-6 transition-all duration-300 print:ml-0 print:p-0",
          isMobile ? "pt-14" : collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="print:hidden">
          <HeaderBar />
        </div>
        <div className="animate-in duration-500 fade-in-0 slide-in-from-bottom-2">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
