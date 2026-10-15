import axios, { AxiosError } from "axios"
import { toast } from "sonner"
import type { WorkspaceMode } from "@/lib/qm"

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1"

export function getApiMessage(
  error: unknown,
  fallback = "An unexpected error occurred"
): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

interface FailedRequest {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}

let isRefreshing = false
const failedQueue: FailedRequest[] = []

function redirectToLogin(expired = false) {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
  const target = expired ? "/login?expired=true" : "/login"
  if (window.location.pathname !== "/login") {
    window.location.href = target
  }
}

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue.length = 0
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token")
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | { _retry?: boolean; headers?: Record<string, string> }
      | undefined
    if (!originalRequest) return Promise.reject(error)

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest as never)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem("refresh_token")
      if (!refreshToken) {
        toast.error("Your session has expired. Please sign in again.")
        redirectToLogin(true)
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const { access_token, refresh_token: newRefreshToken } = response.data
        localStorage.setItem("access_token", access_token)
        localStorage.setItem("refresh_token", newRefreshToken)
        processQueue(null, access_token)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`
        }
        return api(originalRequest as never)
      } catch (refreshError) {
        processQueue(refreshError, null)
        toast.error("Your session has expired. Please sign in again.")
        redirectToLogin(true)
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export const authApi = {
  passwordLogin: (
    email: string,
    password: string,
    workspace: WorkspaceMode = "RBAP"
  ) =>
    api
      .post("/auth/password-login", { email, password, workspace })
      .then((r) => r.data),

  devLogin: (email: string, workspace: WorkspaceMode = "RBAP") =>
    api.post("/auth/dev-login", { email, workspace }).then((r) => r.data),

  register: (data: {
    email: string
    name: string
    password: string
    googleRegistrationToken: string
  }) => api.post("/auth/register", data).then((r) => r.data),

  getRegistrationContext: (token: string) =>
    api
      .get<{
        email: string
        name: string
        avatar: string | null
      }>(`/auth/google-registration-context?token=${token}`)
      .then((r) => r.data),

  getMe: () => api.get<AuthMeResponse>("/auth/me").then((r) => r.data),

  refresh: (refreshToken: string) =>
    api
      .post("/auth/refresh", { refresh_token: refreshToken })
      .then((r) => r.data),

  switchWorkspace: (workspace: WorkspaceMode) =>
    api.post("/auth/switch-workspace", { workspace }).then((r) => r.data),

  setPassword: (password: string) =>
    api.post("/auth/set-password", { password }).then((r) => r.data),
}

export interface AuthMeResponse {
  id: string
  email: string
  name: string
  avatar?: string | null
  role: string
  status?: string
  office?: { id: string; name: string } | null
  account?: {
    id: string
    workspace: WorkspaceMode
    role: string
    status: string
    office: { id: string; name: string } | null
  } | null
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  avatar: string | null
  status: string
  role: string
  office: { id: string; name: string } | null
  supervisor: {
    id: string
    name: string
    email: string
    role: string
  } | null
  memberships?: AdminMembership[]
}

export interface AdminMembership {
  id: string
  workspace: WorkspaceMode
  role: string
  status: string
  office: { id: string; name: string } | null
}

export const usersApi = {
  getAll: (take = 20, skip = 0, search?: string) =>
    api
      .get<{
        data: AdminUser[]
        total: number
        take: number
        skip: number
      }>("/user", { params: { take, skip, search } })
      .then((r) => r.data),

  getCount: () => api.get<{ count: number }>("/user/count").then((r) => r.data),

  getById: (userId: string) =>
    api
      .get<AdminUser>("/user/user-id", { params: { userId } })
      .then((r) => r.data),

  getByEmail: (email: string) =>
    api
      .get<AdminUser>("/user/user-email", { params: { email } })
      .then((r) => r.data),

  getWithoutOffice: () =>
    api.get<AdminUser[]>("/user/without-office").then((r) => r.data),

  create: (data: {
    email: string
    name: string
    role?: string
    workspace?: WorkspaceMode
    officeId?: string | null
    supervisorId?: string | null
  }) => api.post<AdminUser>("/user", data).then((r) => r.data),

  toggleStatus: (userId: string) =>
    api.post("/user/change-user-status", { userId }).then((r) => r.data),

  softDelete: (userId: string) =>
    api.post("/user/delete-user", { userId }).then((r) => r.data),

  assignOffice: (userId: string, officeId?: string | null) =>
    api.post("/user/assign-office", { userId, officeId }).then((r) => r.data),

  assignRole: (userId: string, role: string) =>
    api.post("/user/assign-role", { userId, role }).then((r) => r.data),

  assignSupervisor: (userId: string, supervisorId?: string | null) =>
    api
      .post<AdminUser>("/user/assign-supervisor", { userId, supervisorId })
      .then((r) => r.data),

  getMemberships: (userId: string) =>
    api
      .get<AdminMembership[]>(`/user/${userId}/memberships`)
      .then((r) => r.data),

  syncMemberships: (userId: string) =>
    api
      .post<AdminMembership[]>(`/user/${userId}/sync-memberships`)
      .then((r) => r.data),

  createMembership: (data: {
    userId: string
    workspace: WorkspaceMode
    role: string
    officeId?: string | null
  }) =>
    api.post<AdminMembership>("/user/memberships", data).then((r) => r.data),

  updateMembership: (
    membershipId: string,
    data: { role?: string; officeId?: string | null; status?: string }
  ) =>
    api
      .post<AdminMembership>(`/user/memberships/${membershipId}`, data)
      .then((r) => r.data),
}

export type PlanStatus = "DRAFT" | "SUBMITTED" | "APPROVED"

export interface Plan {
  id: string
  officeId: string
  planningYear: number
  campus: string
  programProjectActivityKRA: string
  strategicAlignment: string
  breakthroughGoals: string
  strategicObjectives: string
  datePrepared: string | null
  monitoringFrequency: string
  reportingOffice: string | null
  status: PlanStatus
  submittedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  office: { id: string; name: string; parentId: string | null }
  createdBy: {
    id: string
    email: string
    name: string
    role: string
    supervisor: {
      id: string
      email: string
      name: string
      role: string
    } | null
  }
  _count: { goals: number }
  budgetRequirements: number
  budgetAllocation: number
}

export interface PlanMonitoring {
  id: string
  frequency: string
  reportingOffice: string | null
  preparedBy: string | null
  reviewedBy: string | null
  approvedBy: string | null
  preparedAt: string | null
  reviewedAt: string | null
  approvedAt: string | null
}

export interface PlanRemark {
  id: string
  planId: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    email: string
    role: string
  }
}

export interface PlanDocumentRow {
  id: string
  code: string | null
  displayOrder: number
  resultLevel: string
  targetResult: string
  keyActions: string
  keyRisk: string
  mitigationMeasures: string
  keyPerformanceIndicator: string
  target: string
  responsibleOfficePerson: string
  timeline: string
  fundSource: string | null
  budgetRequirements: number
  budgetAllocation: number
  budgetDeficit: number
  meansOfVerification: string
  status: GoalStatus
  objectives?: PlanDocumentRow[]
}

export interface PlanDocument extends Omit<Plan, "office" | "createdBy" | "_count" | "budgetRequirements" | "budgetAllocation"> {
  office: { id: string; name: string; parentId: string | null }
  createdBy: { id: string; name: string; email: string; role: string }
  monitoring: PlanMonitoring | null
  goals: PlanDocumentRow[]
}

export interface PlanSummary {
  filters: { officeId: string | null; planningYear: number | null }
  overview: {
    totalPlans: number
    draftPlans: number
    submittedPlans: number
    approvedPlans: number
    pendingApprovalCount: number
    budgetRequirements: number
    budgetAllocation: number
    totalObjectives: number
    completedObjectives: number
    achievementRate: number
    submissionRate: number
    needsAttentionCount: number
  }
  byOffice: Array<{
    officeId: string
    officeName: string
    totalPlans: number
    draftPlans: number
    submittedPlans: number
    approvedPlans: number
    submissionRate: number
    submissionStatus: string
    totalObjectives: number
    completedObjectives: number
    achievementRate: number
    targetAchievement: number
    needsAttention: boolean
  }>
  byYear: Array<{
    planningYear: number
    totalPlans: number
    draftPlans: number
    submittedPlans: number
    approvedPlans: number
    totalObjectives: number
    completedObjectives: number
    submissionRate: number
    achievementRate: number
  }>
}

export interface PlanReport {
  id: string
  office: { id: string; name: string }
  planningYear: number
  status: PlanStatus
  submittedAt: string | null
  submissionRate: number
  submissionStatus: string
  totalObjectives: number
  completedObjectives: number
  achievementRate: number
  targetAchievement: number
  needsAttention: boolean
}

export interface OfficeHead {
  id: string
  name: string
  email: string
  role: string
}

export interface AdminOffice {
  id: string
  name: string
  parentId: string | null
  headId: string | null
  createdAt: string
  members: Array<{ id: string; name: string; email: string }>
  head: Record<string, unknown> | null
}

export interface AccessibleOffice {
  id: string
  name: string
  parentId: string | null
  headId: string | null
  status: string
  head: OfficeHead | null
}

export interface OfficeTreeNode {
  id: string
  name: string
  parentId: string | null
  headId: string | null
  head: OfficeHead | null
  memberCount: number
  children: OfficeTreeNode[]
}

export const officesApi = {
  getAll: (take = 100, skip = 0, search?: string) =>
    api
      .get<{
        data: AdminOffice[]
        meta: { total: number }
      }>("/offices", { params: { take, skip, search: search || undefined } })
      .then((r) => r.data),

  getAccessible: () =>
    api.get<AccessibleOffice[]>("/offices/accessible").then((r) => r.data),

  getTree: () => api.get<OfficeTreeNode[]>("/offices/tree").then((r) => r.data),

  create: (data: { name: string; userId?: string; parentId?: string }) =>
    api.post("/offices/add-office", data).then((r) => r.data),

  update: (data: {
    officeId: string
    name?: string
    userId?: string
    parentId?: string
  }) => api.patch("/offices/update-office", data).then((r) => r.data),

  delete: (officeId: string) =>
    api.post("/offices/delete-office", { officeId }).then((r) => r.data),
}

export const plansApi = {
  getAll: (params?: {
    take?: number
    skip?: number
    officeId?: string
    planningYear?: number
    status?: PlanStatus
    search?: string
  }) =>
    api
      .get<{
        data: Plan[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>("/plans", { params })
      .then((r) => r.data),

  getById: (id: string) => api.get<Plan>(`/plans/${id}`).then((r) => r.data),

  getDocument: (id: string) =>
    api.get<PlanDocument>(`/plans/${id}/document`).then((r) => r.data),

  updateMonitoring: (
    id: string,
    data: Partial<Omit<PlanMonitoring, "id">>
  ) => api.patch<PlanDocument>(`/plans/${id}/monitoring`, data).then((r) => r.data),

  getSummary: (params?: { officeId?: string; planningYear?: number }) =>
    api.get<PlanSummary>("/plans/summary", { params }).then((r) => r.data),

  getReports: (params?: {
    take?: number
    skip?: number
    officeId?: string
    planningYear?: number
    status?: PlanStatus
  }) =>
    api
      .get<{
        data: PlanReport[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>("/plans/reports", { params })
      .then((r) => r.data),

  getPendingApprovals: (params?: { take?: number; skip?: number }) =>
    api
      .get<{
        data: Plan[]
        meta: { total: number }
      }>("/plans/pending-approvals", { params })
      .then((r) => r.data),

  create: (data: {
    planningYear: number
    campus: string
    programProjectActivityKRA: string
    strategicAlignment: string
    breakthroughGoals: string
    strategicObjectives: string
    datePrepared?: string
    monitoringFrequency?: string
    reportingOffice?: string
    officeId?: string
    officeName?: string
  }) => api.post<Plan>("/plans", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      planningYear: number
      campus: string
      programProjectActivityKRA: string
      strategicAlignment: string
      breakthroughGoals: string
      strategicObjectives: string
      datePrepared: string
      monitoringFrequency: string
      reportingOffice: string
    }>
  ) => api.patch<Plan>(`/plans/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/plans/${id}`).then((r) => r.data),

  submit: (id: string) =>
    api.patch<Plan>(`/plans/${id}/submit`).then((r) => r.data),

  approve: (id: string) =>
    api.patch<Plan>(`/plans/${id}/approve`).then((r) => r.data),

  getRemarks: (id: string, params?: { take?: number; skip?: number }) =>
    api
      .get<{
        data: PlanRemark[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>(`/plans/${id}/remarks`, { params })
      .then((r) => r.data),

  addRemark: (id: string, content: string) =>
    api
      .post<PlanRemark>(`/plans/${id}/remarks`, { content })
      .then((r) => r.data),

  returnPlan: (id: string, content: string) =>
    api
      .patch<Plan>(`/plans/${id}/return`, { content })
      .then((r) => r.data),

  exportPdf: (id: string) =>
    api
      .get(`/plans/${id}/export/pdf`, { responseType: "blob" })
      .then((r) => r.data),

  exportDocument: (id: string) =>
    api
      .get(`/plans/${id}/export/document`, { responseType: "blob" })
      .then((r) => r.data),

  exportExcel: (params?: {
    officeId?: string
    planningYear?: number
    status?: string
    search?: string
    planIds?: string
  }) =>
    api
      .get("/plans/export/excel", { params, responseType: "blob" })
      .then((r) => r.data),

  importPlans: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api
      .post<{
        plansCreated: number
        goalsCreated: number
        objectivesCreated: number
        errors: string[]
      }>("/plans/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data)
  },
}

export type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

export interface Goal {
  id: string
  planId: string
  officeId: string
  resultLevel: string
  targetResult: string
  keyActions: string
  keyRisk: string
  mitigationMeasures: string
  keyPerformanceIndicator: string
  target: string
  responsibleOfficePerson: string
  timeline: string
  fundSource: string | null
  budgetRequirements: number
  budgetAllocation: number
  budgetDeficit: number
  code: string | null
  displayOrder: number
  meansOfVerification: string
  status: GoalStatus
  createdAt: string
  updatedAt: string
  office: { id: string; name: string }
  plan: { id: string; planningYear: number; status: string }
  createdBy: { id: string; email: string; name: string; role: string }
  _count: { objectives: number }
}

export const goalsApi = {
  browse: (params?: {
    take?: number
    skip?: number
    officeId?: string
    planId?: string
    planningYear?: number
    status?: GoalStatus
  }) =>
    api
      .get<{
        data: Goal[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>("/goals", { params })
      .then((r) => r.data),

  getById: (id: string) => api.get<Goal>(`/goals/${id}`).then((r) => r.data),

  getByPlan: (planId: string, params?: { take?: number; skip?: number }) =>
    api
      .get<{
        data: Goal[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>(`/plans/${planId}/goals`, { params })
      .then((r) => r.data),

  getOne: (planId: string, goalId: string) =>
    api.get<Goal>(`/plans/${planId}/goals/${goalId}`).then((r) => r.data),

  create: (
    planId: string,
    data: {
      resultLevel: string
      targetResult: string
      keyActions: string
      keyRisk: string
      mitigationMeasures: string
      keyPerformanceIndicator: string
      target: string
      responsibleOfficePerson: string
      timeline: string
      fundSource?: string
      budgetRequirements?: number
      budgetAllocation?: number
      budgetDeficit?: number
      code?: string
      displayOrder?: number
      meansOfVerification: string
    }
  ) => api.post<Goal>(`/plans/${planId}/goals`, data).then((r) => r.data),

  update: (
    planId: string,
    goalId: string,
    data: Partial<{
      resultLevel: string
      targetResult: string
      keyActions: string
      keyRisk: string
      mitigationMeasures: string
      keyPerformanceIndicator: string
      target: string
      responsibleOfficePerson: string
      timeline: string
      fundSource: string
      budgetRequirements: number
      budgetAllocation: number
      budgetDeficit: number
      code: string
      displayOrder: number
      meansOfVerification: string
      status: GoalStatus
    }>
  ) =>
    api
      .patch<Goal>(`/plans/${planId}/goals/${goalId}`, data)
      .then((r) => r.data),

  delete: (planId: string, goalId: string) =>
    api.delete(`/plans/${planId}/goals/${goalId}`).then((r) => r.data),
}

export interface Objective {
  id: string
  goalId: string
  code: string | null
  displayOrder: number
  resultLevel: string
  targetResult: string
  keyActions: string
  keyRisk: string
  mitigationMeasures: string
  keyPerformanceIndicator: string
  target: string
  responsibleOfficePerson: string
  timeline: string
  fundSource: string | null
  budgetRequirements: number
  budgetAllocation: number
  budgetDeficit: number
  meansOfVerification: string
  status: GoalStatus
  createdAt: string
  updatedAt: string
  goal: {
    id: string
    planId: string
    resultLevel: string
    office: { id: string; name: string }
    plan: { planningYear: number; status: string }
  }
  createdBy: { id: string; email: string; name: string; role: string }
}

export const objectivesApi = {
  browse: (params?: {
    take?: number
    skip?: number
    officeId?: string
    planId?: string
    goalId?: string
    planningYear?: number
    status?: GoalStatus
  }) =>
    api
      .get<{
        data: Objective[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>("/objectives", { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<Objective>(`/objectives/${id}`).then((r) => r.data),

  getByGoal: (
    planId: string,
    goalId: string,
    params?: { take?: number; skip?: number }
  ) =>
    api
      .get<{
        data: Objective[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>(`/plans/${planId}/goals/${goalId}/objectives`, { params })
      .then((r) => r.data),

  getOne: (planId: string, goalId: string, objectiveId: string) =>
    api
      .get<Objective>(
        `/plans/${planId}/goals/${goalId}/objectives/${objectiveId}`
      )
      .then((r) => r.data),

  create: (
    planId: string,
    goalId: string,
    data: {
      resultLevel: string
      targetResult: string
      keyActions: string
      keyRisk: string
      mitigationMeasures: string
      keyPerformanceIndicator: string
      target: string
      responsibleOfficePerson: string
      timeline: string
      fundSource?: string
      budgetRequirements?: number
      budgetAllocation?: number
      budgetDeficit?: number
      code?: string
      displayOrder?: number
      meansOfVerification: string
    }
  ) =>
    api
      .post<Objective>(`/plans/${planId}/goals/${goalId}/objectives`, data)
      .then((r) => r.data),

  update: (
    planId: string,
    goalId: string,
    objectiveId: string,
    data: Partial<{
      resultLevel: string
      targetResult: string
      keyActions: string
      keyRisk: string
      mitigationMeasures: string
      keyPerformanceIndicator: string
      target: string
      responsibleOfficePerson: string
      timeline: string
      fundSource: string
      budgetRequirements: number
      budgetAllocation: number
      budgetDeficit: number
      code: string
      displayOrder: number
      meansOfVerification: string
      status: GoalStatus
    }>
  ) =>
    api
      .patch<Objective>(
        `/plans/${planId}/goals/${goalId}/objectives/${objectiveId}`,
        data
      )
      .then((r) => r.data),

  updateProgress: (
    planId: string,
    goalId: string,
    objectiveId: string,
    status: GoalStatus
  ) =>
    api
      .patch<Objective>(
        `/plans/${planId}/goals/${goalId}/objectives/${objectiveId}/progress`,
        { status }
      )
      .then((r) => r.data),

  delete: (planId: string, goalId: string, objectiveId: string) =>
    api
      .delete(`/plans/${planId}/goals/${goalId}/objectives/${objectiveId}`)
      .then((r) => r.data),
}

export type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "ERROR"

export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  link: string | null
  createdAt: string
}

export interface NotificationsResponse {
  data: Notification[]
  total: number
  take: number
  skip: number
}

export const notificationsApi = {
  getAll: (params?: {
    take?: number
    skip?: number
    read?: boolean
    type?: NotificationType
    dateFrom?: string
    dateTo?: string
    search?: string
  }) =>
    api
      .get<NotificationsResponse>("/notifications", { params })
      .then((r) => r.data),

  getOne: (id: string) =>
    api.get<Notification>(`/notifications/${id}`).then((r) => r.data),

  getUnreadCount: () =>
    api
      .get<{ count: number }>("/notifications/unread-count")
      .then((r) => r.data),

  markAsRead: (id: string) =>
    api.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    api.patch<{ count: number }>("/notifications/read-all").then((r) => r.data),
}

export interface ActivityLog {
  id: string
  action: string
  entity: string
  entityId: string
  details: unknown
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  }
}

export const activityLogApi = {
  getAll: (params?: {
    take?: number
    skip?: number
    userId?: string
    action?: string
    entity?: string
    dateFrom?: string
    dateTo?: string
  }) =>
    api
      .get<{ data: ActivityLog[]; total: number; take: number; skip: number }>(
        "/activity-log",
        {
          params,
        }
      )
      .then((r) => r.data),
}

export interface Remark {
  id: string
  goalId: string
  content: string
  createdAt: string
  author: { id: string; name: string; email: string; role: string }
}

export const remarksApi = {
  getByGoal: (goalId: string, params?: { take?: number; skip?: number }) =>
    api
      .get<{
        data: Remark[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>(`/goals/${goalId}/remarks`, { params })
      .then((r) => r.data),

  create: (goalId: string, data: { content: string }) =>
    api.post<Remark>(`/goals/${goalId}/remarks`, data).then((r) => r.data),

  delete: (goalId: string, remarkId: string) =>
    api.delete(`/goals/${goalId}/remarks/${remarkId}`).then((r) => r.data),
}

export type QomMonitoringFrequency =
  | "MONTHLY"
  | "QUARTERLY"
  | "BIANNUAL"
  | "ANNUAL"

export interface Qom {
  id: string
  qoapId: string
  monitoringNo: number
  recencyDate: string
  previousMonitoringDate: string | null
  performance: Record<string, string>
  overallDataResult: string | null
  movDataSource: string | null
  createdAt: string
  updatedAt: string
  qoap?: {
    id: string
    officeId: string
    goalId: string
  }
}

export interface QoapGoalPlanContext {
  id: string
  planningYear: number
  reportingOffice?: string | null
  monitoringFrequency?: string
  breakthroughGoals: string
  strategicObjectives: string
}

export interface QoapGoalContext {
  id: string
  resultLevel: string
  targetResult: string
  keyActions: string
  keyRisk: string
  mitigationMeasures: string
  keyPerformanceIndicator: string
  target: string
  responsibleOfficePerson: string
  timeline: string
  fundSource: string | null
  budgetRequirements: number
  budgetAllocation: number
  meansOfVerification: string
  status: GoalStatus
  objectives: QoapObjectiveContext[]
  plan: QoapGoalPlanContext
}

export interface QoapObjectiveContext {
  id: string
  resultLevel: string
  targetResult: string
  keyActions: string
  keyPerformanceIndicator: string
  target: string
  timeline: string
  status: GoalStatus
}

export interface Qoap {
  id: string
  goalId: string
  officeId: string
  functionalObjective: string
  indicators: string
  indicatorFormula: string
  resources: string
  monitoringFrequency: QomMonitoringFrequency
  intendedOutcomes: string
  createdAt: string
  updatedAt: string
  office: { id: string; name: string }
  createdBy?: { id: string; email: string; name: string; role: string }
  goal: QoapGoalContext
  qoms: Qom[]
}

export interface QoapSummary {
  id: string
  goalId: string
  officeId: string
  functionalObjective: string
  indicators: string
  indicatorFormula: string
  resources: string
  monitoringFrequency: QomMonitoringFrequency
  intendedOutcomes: string
  createdAt: string
  updatedAt: string
  office: { id: string; name: string }
  goal: Pick<
    QoapGoalContext,
    | "id"
    | "resultLevel"
    | "targetResult"
    | "keyActions"
    | "keyPerformanceIndicator"
    | "target"
    | "responsibleOfficePerson"
    | "timeline"
  > & {
    objectives: QoapObjectiveContext[]
    plan: Pick<
      QoapGoalPlanContext,
      | "id"
      | "planningYear"
      | "reportingOffice"
      | "monitoringFrequency"
      | "breakthroughGoals"
      | "strategicObjectives"
    >
  }
  _count: { qoms: number }
}

export type QoapAvailableGoal = Pick<
  Goal,
  | "id"
  | "officeId"
  | "resultLevel"
  | "targetResult"
  | "keyActions"
  | "keyRisk"
  | "mitigationMeasures"
  | "keyPerformanceIndicator"
  | "target"
  | "responsibleOfficePerson"
  | "timeline"
  | "fundSource"
  | "budgetRequirements"
  | "budgetAllocation"
  | "meansOfVerification"
  | "status"
> & {
  plan: {
    id: string
    planningYear: number
    campus: string
    programProjectActivityKRA: string
    strategicAlignment: string
    breakthroughGoals: string
    strategicObjectives: string
  }
  office: { id: string; name: string }
}

export const qoapApi = {
  getAll: (params?: {
    take?: number
    skip?: number
    officeId?: string
    planningYear?: number
  }) =>
    api
      .get<{
        data: QoapSummary[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>("/qoap", { params })
      .then((r) => r.data),

  getAvailableGoals: (params?: {
    take?: number
    skip?: number
    officeId?: string
    planningYear?: number
  }) =>
    api
      .get<{
        data: QoapAvailableGoal[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>("/qoap/available-goals", { params })
      .then((r) => r.data),

  getById: (id: string) => api.get<Qoap>(`/qoap/${id}`).then((r) => r.data),

  exportPdf: (id: string) =>
    api
      .get(`/qoap/${id}/export/pdf`, { responseType: "blob" })
      .then((r) => r.data),

  exportExcel: (id: string) =>
    api
      .get(`/qoap/${id}/export/excel`, { responseType: "blob" })
      .then((r) => r.data),

  create: (data: {
    goalId: string
    functionalObjective: string
    indicators: string
    indicatorFormula: string
    resources: string
    intendedOutcomes: string
  }) => api.post<Qoap>("/qoap", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      functionalObjective: string
      indicators: string
      indicatorFormula: string
      resources: string
      intendedOutcomes: string
    }>
  ) => api.patch<Qoap>(`/qoap/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/qoap/${id}`).then((r) => r.data),
}

export const qomApi = {
  getByQoap: (qoapId: string, params?: { take?: number; skip?: number }) =>
    api
      .get<{
        data: Qom[]
        meta: { total: number; take: number; skip: number; returned: number }
      }>(`/qoap/${qoapId}/qom`, { params })
      .then((r) => r.data),

  getOne: (qoapId: string, id: string) =>
    api.get<Qom>(`/qoap/${qoapId}/qom/${id}`).then((r) => r.data),

  create: (
    qoapId: string,
    data: {
      monitoringNo: number
      recencyDate: string
      previousMonitoringDate?: string
      performance: Record<string, string>
      overallDataResult?: string
      movDataSource?: string
    }
  ) => api.post<Qom>(`/qoap/${qoapId}/qom`, data).then((r) => r.data),

  update: (
    qoapId: string,
    id: string,
    data: Partial<{
      monitoringNo: number
      recencyDate: string
      previousMonitoringDate: string | null
      performance: Record<string, string>
      overallDataResult: string
      movDataSource: string
    }>
  ) => api.patch<Qom>(`/qoap/${qoapId}/qom/${id}`, data).then((r) => r.data),
}

export default api
