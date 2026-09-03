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
import { registerSchema, type RegisterFormValues } from "@/lib/schemas"
import { authApi } from "@/lib/api"

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [apiError, setApiError] = useState("")
  const [contextLoading, setContextLoading] = useState(true)
  const [registrationData, setRegistrationData] = useState<{ email: string; name: string; avatar: string | null } | null>(null)

  const token = searchParams.get("registration_token")

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true })
      toast.error("Registration link is invalid")
      return
    }

    authApi.getRegistrationContext(token)
      .then((data) => {
        setRegistrationData(data)
      })
      .catch(() => {
        toast.error("Invalid registration link")
        navigate("/login", { replace: true })
      })
      .finally(() => {
        setContextLoading(false)
      })
  }, [token, navigate])

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  if (isAuthenticated) {
    navigate("/", { replace: true })
    return null
  }

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError("")
    try {
      await registerUser(registrationData!.email, registrationData!.name, values.password, token!)
      navigate("/", { replace: true })
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        const message =
          axiosErr.response?.data?.message ||
          "Registration failed. Please try again."
        setApiError(message)
        toast.error(message)
      } else {
        const message = "Registration failed. Please try again."
        setApiError(message)
        toast.error(message)
      }
    }
  }

  if (contextLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!registrationData) {
    return null
  }

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
          <h1 className="mb-4 text-4xl font-bold text-white">RBAP IDM</h1>
          <p className="max-w-md text-xl text-primary-foreground/80 text-white">
            University Results-Based Action Plan Management System
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
            <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
            <CardDescription>
              Set your password to complete registration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {registrationData.avatar && (
              <div className="flex justify-center">
                <img
                  src={registrationData.avatar}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              </div>
            )}
            
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Email (verified)</p>
              <p className="font-medium">{registrationData.email}</p>
            </div>

            <div className="text-center space-y-1 pb-2">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{registrationData.name}</p>
            </div>

            {apiError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {apiError}
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
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
                            autoComplete="new-password"
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
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            autoComplete="new-password"
                            disabled={form.formState.isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-0 right-0 h-full px-3"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
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
                      Creating account...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Create account
                    </span>
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-center text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => navigate("/login")}
              >
                Already have an account? Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}