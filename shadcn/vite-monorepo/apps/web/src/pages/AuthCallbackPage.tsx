import { useEffect, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/useAuth"
import { canEnterQmWorkspace, getWorkspaceMode } from "@/lib/qm"
import { authApi } from "@/lib/api"

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setTokens, isAuthenticated, logout } = useAuth()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const accessToken = searchParams.get("access_token")
    const refreshToken = searchParams.get("refresh_token")

    if (accessToken && refreshToken) {
      void (async () => {
        let authenticatedUser = await setTokens(accessToken, refreshToken)
        if (
          getWorkspaceMode() === "QM" &&
          authenticatedUser?.account?.workspace !== "QM"
        ) {
          const tokens = await authApi.switchWorkspace("QM")
          authenticatedUser = await setTokens(
            tokens.access_token,
            tokens.refresh_token,
          )
        }
        if (
          getWorkspaceMode() === "QM" &&
          !canEnterQmWorkspace(authenticatedUser)
        ) {
          logout()
          navigate(
            `/login?error=${encodeURIComponent(
              "This account is not assigned to the Quality Management office.",
            )}`,
            { replace: true },
          )
        }
      })()
    } else {
      navigate("/login", { replace: true })
    }
  }, [searchParams, setTokens, navigate, logout])

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="ml-3 text-muted-foreground text-sm">
        Completing sign in...
      </p>
    </div>
  )
}
