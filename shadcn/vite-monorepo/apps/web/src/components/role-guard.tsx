import { useEffect, useRef } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/useAuth"
import { hasMinRole } from "@/lib/roles"
import { toast } from "sonner"

interface RoleGuardProps {
  minRole: number
  children: React.ReactNode
}

export function RoleGuard({ minRole, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth()
  const alerted = useRef(false)

  useEffect(() => {
    if (!isLoading && user && !hasMinRole(user.role, minRole) && !alerted.current) {
      toast.error("You don't have permission to access that page")
      alerted.current = true
    }
  }, [isLoading, user, minRole])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user || !hasMinRole(user.role, minRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
