import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/useAuth"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@/components/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form"
import { Eye, EyeOff, LogIn } from "lucide-react"
import { toast } from "sonner"
import { loginSchema, type LoginFormValues } from "@/lib/schemas"
import {
  canEnterQmWorkspace,
  WORKSPACE_MODE_KEY,
  type WorkspaceMode,
} from "@/lib/qm"

export default function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState("")
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | "">("")
  const [workspaceError, setWorkspaceError] = useState("")

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    // Schedule state updates in a microtask to avoid synchronous setState in effect
    const expired = searchParams.get("expired") === "true"
    const errorParam = searchParams.get("error")
    if (expired) {
      Promise.resolve().then(() => {
        setApiError("Your session has expired. Please sign in again.")
        toast.error("Session expired")
      })
    } else if (errorParam) {
      Promise.resolve().then(() => {
        setApiError(errorParam)
        toast.error(errorParam)
      })
    }
  }, [searchParams])

  if (isAuthenticated) {
    navigate("/", { replace: true })
    return null
  }

  const onSubmit = async (values: LoginFormValues) => {
    setApiError("")
    if (!workspaceMode) {
      setWorkspaceError("Please choose a system before signing in.")
      return
    }
    setWorkspaceError("")

    try {
      localStorage.setItem(WORKSPACE_MODE_KEY, workspaceMode)
      const authenticatedUser = await login(
        values.email,
        values.password,
        workspaceMode,
      )
      if (
        workspaceMode === "QM" &&
        !canEnterQmWorkspace(authenticatedUser)
      ) {
        logout()
        const message =
          "This account is not assigned to the Quality Management office."
        setApiError(message)
        toast.error(message)
        return
      }
      navigate("/", { replace: true })
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        const message =
          axiosErr.response?.data?.message ||
          "Login failed. Please check your credentials."
        setApiError(message)
        toast.error(message)
      } else {
        const message = "Login failed. Please try again."
        setApiError(message)
        toast.error(message)
      }
    }
  }

  const handleGoogleLogin = () => {
    if (!workspaceMode) {
      setWorkspaceError("Please choose a system before signing in.")
      return
    }
    setWorkspaceError("")
    loginWithGoogle(workspaceMode)
  }

  const isQualityManagement = workspaceMode === "QM"

  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden items-center justify-center bg-primary p-12 lg:flex lg:w-1/2"
        style={{
          backgroundImage: "url('/chmsu-background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center text-primary-foreground">
          <img
            src="/chmsu-min.jpg"
            alt="CHMSU Logo"
            className="mx-auto mb-6 h-24 w-24 rounded-full border-2 border-white/30 object-cover"
          />
          <h1 className="mb-4 text-4xl font-bold text-white">
            {isQualityManagement ? "QM" : "RBAP IDM"}
          </h1>
          <p className="max-w-md text-xl text-primary-foreground/80 text-white">
            {isQualityManagement
              ? "Quality Monitoring system"
              : "University Results-Based Action Plan Management System"}
          </p>
          <div className="mt-8 text-sm text-white">
            <p>CHMSU - Carlos Hilado State University</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-lg">
          <CardHeader className="space-y-1 text-center lg:text-left">
            <div className="mb-4 flex justify-center lg:hidden">
              <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-primary/30">
                <img
                  src="/chmsu-min.jpg"
                  alt="CHMSU"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {apiError}
              </div>
            )}

            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={handleGoogleLogin}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <span className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  or continue with email
                </span>
              </span>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="workspace-mode" className="text-sm font-medium">
                    Login to
                  </label>
                  <select
                    id="workspace-mode"
                    value={workspaceMode}
                    onChange={(event) => {
                      setWorkspaceMode(event.target.value as WorkspaceMode | "")
                      setWorkspaceError("")
                    }}
                    disabled={form.formState.isSubmitting}
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      workspaceError
                        ? "border-destructive text-destructive"
                        : "border-input"
                    }`}
                  >
                    <option value="">Choose or select a system</option>
                    <option value="RBAP">RBAP / Planning</option>
                    <option value="QM">QM / Quality Management</option>
                  </select>
                  {workspaceError ? (
                    <p className="text-xs text-destructive">{workspaceError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Choose the workspace you want to use after signing in.
                    </p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@chmsu.edu.ph"
                          autoComplete="email"
                          disabled={form.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            disabled={form.formState.isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-0 right-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </span>
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-center text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={handleGoogleLogin}
              >
                Don't have an account? Create one
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
