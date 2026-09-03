import React, { useEffect, useState, useCallback, Suspense } from "react"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { useAuth } from "@/contexts/useAuth"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { plansApi, usersApi, officesApi, getApiMessage } from "@/lib/api"
import type { PlanSummary, Plan } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  Users,
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Target,
} from "lucide-react"

const STATUS_COLORS = {
  DRAFT: "#f59e0b",
  SUBMITTED: "#3b82f6",
  APPROVED: "#22c55e",
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

const DashboardCharts = React.lazy(() => import("@/components/dashboard-charts"))

function ChartsFallback() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="h-64 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-4 w-24 rounded bg-muted mb-3" />
              <div className="h-8 w-16 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-64 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PlanSummary | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<Plan[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOffices: 0,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)

  useEffect(() => {
    async function load() {
      try {
        const [summaryData, pendingData, usersData, officesData] = await Promise.all([
          plansApi.getSummary().catch(() => null),
          plansApi.getPendingApprovals({ take: 5 }).catch(() => ({ data: [], meta: { total: 0 } })),
          usersApi.getCount().catch(() => ({ count: 0 })),
          officesApi.getAccessible().catch<unknown[]>(() => []),
        ])

        setSummary(summaryData)
        setPendingApprovals(pendingData && "data" in pendingData ? (pendingData as { data: Plan[] }).data : [])
        setStats({
          totalUsers: usersData && "count" in usersData ? (usersData as { count: number }).count : 0,
          totalOffices: Array.isArray(officesData) ? officesData.length : 0,
        })
      } catch (error: unknown) {
        toast.error(getApiMessage(error, "Failed to load dashboard data"))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [refreshKey])

  const overview = summary?.overview
  const planStatusData = overview
    ? [
        { name: "Draft", value: overview.draftPlans, color: STATUS_COLORS.DRAFT },
        { name: "Submitted", value: overview.submittedPlans, color: STATUS_COLORS.SUBMITTED },
        { name: "Approved", value: overview.approvedPlans, color: STATUS_COLORS.APPROVED },
      ].filter((d) => d.value > 0)
    : []

  const byOfficeData = summary?.byOffice
    ?.filter((o) => o.totalPlans > 0)
    .slice(0, 8)
    .map((o) => ({
      name: o.officeName.length > 18 ? o.officeName.slice(0, 16) + "…" : o.officeName,
      Draft: o.draftPlans,
      Submitted: o.submittedPlans,
      Approved: o.approvedPlans,
    })) ?? []

  const adminOfficeMetrics = user?.role === "ADMIN" ? (summary?.byOffice ?? []) : []
  const attentionOffices = adminOfficeMetrics.filter((office) => office.needsAttention)

  return (
    <div className="space-y-6">
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Welcome */}
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </p>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Registered accounts</p>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
                <FileText className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{overview?.totalPlans ?? "—"}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {overview && (
                    <>
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-amber-500" /> {overview.draftPlans} Draft
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-blue-500" /> {overview.submittedPlans} Submitted
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-green-500" /> {overview.approvedPlans} Approved
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <Clock className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {overview?.pendingApprovalCount ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Awaiting your review</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <Suspense fallback={<ChartsFallback />}>
            <DashboardCharts planStatusData={planStatusData} byOfficeData={byOfficeData} overview={overview} />
          </Suspense>

          {user?.role === "ADMIN" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Submission Rate</CardTitle>
                    <FileText className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{formatPercent(overview?.submissionRate ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Plans submitted or approved</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Target Achievement</CardTitle>
                    <Target className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{formatPercent(overview?.achievementRate ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {overview?.completedObjectives ?? 0} of {overview?.totalObjectives ?? 0} objectives completed
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Offices Needing Attention</CardTitle>
                    <AlertTriangle className="size-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-amber-600">{overview?.needsAttentionCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">No plan, draft plan, or incomplete targets</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">Office Performance at a Glance</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Offices below 100% submission or objective achievement are flagged.
                    </p>
                  </div>
                  <Link to="/reports">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      Open reports <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Office</th>
                          <th className="px-2 py-2 font-medium">Submission</th>
                          <th className="px-2 py-2 font-medium">Target achievement</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminOfficeMetrics.length > 0 ? adminOfficeMetrics.map((office) => (
                          <tr key={office.officeId} className="border-b last:border-0">
                            <td className="px-2 py-3 font-medium">{office.officeName}</td>
                            <td className="px-2 py-3">{formatPercent(office.submissionRate)}</td>
                            <td className="px-2 py-3">
                              {formatPercent(office.targetAchievement)}
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({office.completedObjectives}/{office.totalObjectives})
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <span className={office.needsAttention ? "text-amber-600" : "text-emerald-600"}>
                                {office.needsAttention ? "Needs attention" : "On track"}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                              No office performance data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {attentionOffices.length > 0 && (
                    <p className="mt-4 text-xs text-amber-600">
                      {attentionOffices.length} office{attentionOffices.length === 1 ? "" : "s"} need follow-up.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Pending Approvals */}
          <Card className="transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Link to="/plans">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ArrowRight className="size-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <div className="divide-y">
                  {pendingApprovals.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {plan.programProjectActivityKRA || "Untitled Plan"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {plan.office?.name} &middot; FY {plan.planningYear} &middot;{" "}
                          {plan.submittedAt
                            ? new Date(plan.submittedAt).toLocaleDateString("en-PH")
                            : "—"}
                        </p>
                      </div>
                      <Link to={`/plans?plan=${plan.id}`}>
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="mb-2 size-8 text-emerald-500" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No plans pending your approval</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
