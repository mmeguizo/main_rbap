import { z } from "zod"

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address")

export const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .min(6, "Password must be at least 6 characters")

export const requiredString = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`)

export const positiveNumber = (fieldName: string) =>
  z.coerce.number().positive(`${fieldName} must be a positive number`)

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const goalFormSchema = z.object({
  resultLevel: requiredString("Result level"),
  targetResult: requiredString("Target result"),
  keyActions: requiredString("Key actions"),
  keyRisk: requiredString("Key risk"),
  mitigationMeasures: requiredString("Mitigation measures"),
  kpi: requiredString("KPI"),
  target: requiredString("Target"),
  responsiblePerson: requiredString("Responsible office/person"),
  timeline: requiredString("Timeline"),
  fundSource: z.string().optional(),
  meansOfVerification: requiredString("Means of verification"),
  status: z.string().optional(),
})

export type GoalFormValues = z.infer<typeof goalFormSchema>

export const officeFormSchema = z.object({
  name: requiredString("Name").min(2, "Name must be at least 2 characters"),
  headId: z.string().optional(),
  parentId: z.string().optional(),
})

export type OfficeFormValues = z.infer<typeof officeFormSchema>

export const objectiveFormSchema = goalFormSchema
export type ObjectiveFormValues = GoalFormValues

export const planFormSchema = z.object({
  planningYear: z
    .number()
    .int("Planning year must be a whole number")
    .min(2000, "Planning year must be 2000 or later")
    .max(2100, "Planning year must be 2100 or earlier"),
  campus: requiredString("Campus"),
  programProjectActivityKRA: requiredString("Program/Project/Activity/KRA"),
  strategicAlignment: requiredString("Strategic alignment"),
  breakthroughGoals: requiredString("Breakthrough goals"),
  strategicObjectives: requiredString("Strategic objectives"),
  monitoringFrequency: z.string().min(1, "Monitoring frequency is required"),
  reportingOffice: z.string().optional(),
  datePrepared: z.string().optional(),
})

export type PlanFormValues = z.infer<typeof planFormSchema>

export const userFormSchema = z.object({
  role: z.string().min(1, "Role is required"),
  officeId: z.string(),
  supervisorId: z.string(),
})

export type UserFormValues = z.infer<typeof userFormSchema>

export const registerSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const

export type MonthKey = (typeof MONTH_KEYS)[number]

export const qoapFormSchema = z.object({
  goalId: requiredString("Goal"),
  functionalObjective: requiredString("Functional objective"),
  indicators: requiredString("Indicators"),
  indicatorFormula: requiredString("Indicator formula"),
  resources: requiredString("Resources"),
  intendedOutcomes: requiredString("Intended outcomes"),
})

export type QoapFormValues = z.infer<typeof qoapFormSchema>

export const qomFormSchema = z.object({
  monitoringNo: z
    .number()
    .int("Monitoring no must be a whole number")
    .min(1, "Monitoring no must be at least 1"),
  recencyDate: requiredString("Recency date"),
  previousMonitoringDate: z.string().optional(),
  performance: z.record(z.string(), z.string()).optional(),
  overallDataResult: z.string().optional(),
  movDataSource: z.string().optional(),
})

export type QomFormValues = z.infer<typeof qomFormSchema>

export const MONTH_LABELS: Record<MonthKey, string> = {
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
}
