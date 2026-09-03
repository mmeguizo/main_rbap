import { useState, useEffect, useCallback, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { authApi } from "@/lib/api"
import { isTokenExpired } from "@/lib/jwt"
import { AuthContext, type User } from "./AuthContext.types"
import { WORKSPACE_MODE_KEY, type WorkspaceMode } from "@/lib/qm"

export { AuthContext }

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1"

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem("access_token")
  )
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async (): Promise<User | null> => {
    setIsLoading(true)
    const token = localStorage.getItem("access_token")
    if (!token) {
      setUser(null)
      setAccessToken(null)
      setIsLoading(false)
      return null
    }

    if (isTokenExpired(token)) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      localStorage.removeItem(WORKSPACE_MODE_KEY)
      setUser(null)
      setAccessToken(null)
      setIsLoading(false)
      const isLoginPage = window.location.pathname === "/login"
      if (!isLoginPage) {
        navigate("/login?expired=true", { replace: true })
      }
      return null
    }

    try {
      const userData = await authApi.getMe()
      const account = userData.account ?? null
      const authenticatedUser: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: account?.role ?? userData.role,
        account,
        avatar: userData.avatar,
        office: account?.office ?? userData.office ?? null,
      }
      setUser(authenticatedUser)
      return authenticatedUser
    } catch {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      setUser(null)
      setAccessToken(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  const setTokens = useCallback(
    async (token: string, refreshToken: string) => {
      localStorage.setItem("access_token", token)
      localStorage.setItem("refresh_token", refreshToken)
      setAccessToken(token)
      return fetchUser()
    },
    [fetchUser]
  )

  useEffect(() => {
    // Schedule fetchUser in a microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      fetchUser()
    })
  }, [fetchUser])

  const login = useCallback(
    async (email: string, password: string, mode: WorkspaceMode = "RBAP") => {
      const data = await authApi.passwordLogin(email, password, mode)
      return setTokens(data.access_token, data.refresh_token)
    },
    [setTokens, fetchUser]
  )

  const register = useCallback(
    async (email: string, name: string, password: string, googleRegistrationToken: string) => {
      const data = await authApi.register({ email, name, password, googleRegistrationToken })
      return setTokens(data.access_token, data.refresh_token)
    },
    [setTokens, fetchUser]
  )

  const devLogin = useCallback(
    async (email: string, mode: WorkspaceMode = "RBAP") => {
      const data = await authApi.devLogin(email, mode)
      return setTokens(data.access_token, data.refresh_token)
    },
    [setTokens, fetchUser]
  )

  const loginWithGoogle = useCallback((mode: WorkspaceMode = "RBAP") => {
    localStorage.setItem(WORKSPACE_MODE_KEY, mode)
    window.location.href = `${API_BASE_URL}/auth/google?workspace=${mode}`
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem(WORKSPACE_MODE_KEY)
    setUser(null)
    setAccessToken(null)
    navigate("/login", { replace: true })
  }, [navigate])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        loginWithGoogle,
        devLogin,
        logout,
        setTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
