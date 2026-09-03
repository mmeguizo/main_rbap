import { createContext } from "react"
import type { WorkspaceMode } from "@/lib/qm"

export interface User {
  id: string
  email: string
  name?: string
  role: string
  account?: {
    id: string
    workspace: WorkspaceMode
    role: string
    status: string
    office: { id: string; name: string } | null
  } | null
  avatar?: string | null
  office?: { id: string; name: string } | null
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, mode?: WorkspaceMode) => Promise<User | null>
  register: (email: string, name: string, password: string, googleRegistrationToken: string) => Promise<User | null>
  loginWithGoogle: (mode?: WorkspaceMode) => void
  devLogin: (email: string, mode?: WorkspaceMode) => Promise<User | null>
  logout: () => void
  setTokens: (accessToken: string, refreshToken: string) => Promise<User | null>
}

export const AuthContext = createContext<AuthContextType | null>(null)
