import { useEffect, useRef } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/useAuth"
import { isQmWorkspaceActive } from "@/lib/qm"
import { toast } from "sonner"

interface QmAccessGuardProps {
  children: React.ReactNode
}

/**
 * Department-aware guard for the QOAP/QOM workspace. Keeps the existing role
 * guard in the route definition, then blocks PME / no-office users who reach
 * /qoap manually. ADMIN and QM office members are allowed.
 */
export function QmAccessGuard({ children }: QmAccessGuardProps) {
  const { user, isLoading } = useAuth()
  const alerted = useRef(false)

  useEffect(() => {
    if (!isLoading && user && !isQmWorkspaceActive(user) && !alerted.current) {
      toast.error("QOAP/QOM is only available to the Quality Management office")
      alerted.current = true
    }
  }, [isLoading, user])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user || !isQmWorkspaceActive(user)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
