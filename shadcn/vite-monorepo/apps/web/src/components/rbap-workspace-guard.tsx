import { useEffect, useRef } from "react"
import { Navigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/contexts/useAuth"
import { isQmWorkspaceActive } from "@/lib/qm"

interface RbapWorkspaceGuardProps {
  children: React.ReactNode
}

export function RbapWorkspaceGuard({ children }: RbapWorkspaceGuardProps) {
  const { user, isLoading } = useAuth()
  const alerted = useRef(false)

  useEffect(() => {
    if (!isLoading && user && isQmWorkspaceActive(user) && !alerted.current) {
      toast.error("That page is only available in the RBAP workspace")
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

  if (!user || isQmWorkspaceActive(user)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
