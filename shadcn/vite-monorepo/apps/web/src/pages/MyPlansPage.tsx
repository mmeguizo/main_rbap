import { useEffect, useState, useMemo, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { useAuth } from "@/contexts/useAuth"
import { ROLE_HIERARCHY, hasMinRole } from "@/lib/roles"
import { plansApi, getApiMessage, type Plan } from "@/lib/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@workspace/ui/components/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { PlanDetailModal } from "@/components/plan-detail-modal"
import { ImportPlansDialog } from "@/components/import-plans-dialog"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Trash2,
  FileText,
  Send,
  CheckCircle,
  Building,
  FileDown,
  Download,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
}

const PAGE_SIZE = 25

export default function MyPlansPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [skip, setSkip] = useState(0)
  const [total, setTotal] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(
    undefined
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    description: string
    confirmLabel?: string
    variant?: "destructive" | "default"
    onConfirm: () => void
  } | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  useEffect(() => {
    if (!user?.office?.id) {
      // Schedule state update in a microtask to avoid synchronous setState in effect
      Promise.resolve().then(() => setLoading(false))
      return
    }
    let cancelled = false
    plansApi
      .getAll({ take: PAGE_SIZE, skip, officeId: user.office.id })
      .then((res) => {
        if (!cancelled) {
          setPlans(res.data)
          setTotal(res.meta.total)
          setLoading(false)
          const planParam = searchParams.get('plan')
          if (planParam && res.data.some((p) => p.id === planParam)) {
            setSelectedPlanId(planParam)
            setModalOpen(true)
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlans([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, user?.office?.id, searchParams, skip])

  useEffect(() => {
    setSkip(0)
  }, [search, statusFilter])

  const filtered = useMemo(() => {
    const all = plans ?? []
    return all.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !p.campus.toLowerCase().includes(q) &&
          !p.programProjectActivityKRA.toLowerCase().includes(q)
        )
          return false
      }
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      return true
    })
  }, [plans, search, statusFilter])

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage =
    search || statusFilter !== "all"
      ? Math.max(1, Math.min(page, maxPage))
      : page
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const openPlanModal = (id: string) => {
    setSelectedPlanId(id)
    setModalOpen(true)
  }
  const openCreateModal = () => {
    setSelectedPlanId(undefined)
    setModalOpen(true)
  }
  const submitPlan = async (id: string) => {
    try {
      await plansApi.submit(id)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to submit plan"))
    }
  }
  const approvePlan = async (id: string) => {
    try {
      await plansApi.approve(id)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to approve plan"))
    }
  }
  const deletePlan = async (id: string) => {
    try {
      await plansApi.delete(id)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to delete plan"))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Plans</h1>
          <p className="text-sm text-muted-foreground">
            {user?.office?.name
              ? `Plans for ${user.office.name}`
              : "Your office plans"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateModal}>
            <FileText className="size-4" />
            <span className="ml-1.5 hidden sm:inline">New Plan</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              try {
                const blob = await plansApi.exportExcel({
                  search: search || undefined,
                  status: statusFilter !== "all" ? (statusFilter as "DRAFT" | "SUBMITTED" | "APPROVED") : undefined,
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "rbap-my-plans-export.xlsx"
                a.click()
                URL.revokeObjectURL(url)
              } catch (error: unknown) {
                toast.error(getApiMessage(error, "Failed to export Excel"))
              }
            }}
          >
            <Download className="size-4" />
            <span className="ml-1.5 hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="size-4" />
            <span className="ml-1.5 hidden sm:inline">Import</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-[200px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by campus or KRA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-9 w-9 animate-pulse rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : !user?.office?.id ? (
          <EmptyState
            icon={Building}
            title="No office assigned"
            description="You need to be assigned to an office to create and manage plans."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? "No plans match your search" : "No plans yet"}
            description={
              search
                ? "Try adjusting your search"
                : "Create your first RBAP plan to get started"
            }
            action={
              search ? (
                <Button variant="link" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : (
                <Button size="sm" onClick={openCreateModal}>
                  Create Plan
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campus</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>KRA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Goals</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-medium">{plan.campus}</p>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {plan.planningYear}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {plan.programProjectActivityKRA}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[plan.status]}>
                      {plan.status === "SUBMITTED"
                        ? "Submitted"
                        : plan.status.charAt(0) +
                          plan.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{plan._count.goals}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => navigate(`/plans/${plan.id}/view`)}
                        >
                          <FileText className="size-4" /> Open workspace
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openPlanModal(plan.id)}
                        >
                          <Eye className="size-4" /> View / Edit
                        </DropdownMenuItem>
                        {hasMinRole(user?.role, ROLE_HIERARCHY.OFFICE_HEAD) && (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                const blob = await plansApi.exportPdf(plan.id)
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement("a")
                                a.href = url
                                a.download = `plan-${plan.id}.pdf`
                                a.click()
                                URL.revokeObjectURL(url)
                              } catch (error: unknown) {
                                toast.error(getApiMessage(error, "Failed to export PDF"))
                              }
                            }}
                          >
                            <FileDown className="size-4" /> Export PDF
                          </DropdownMenuItem>
                        )}
                        {plan.status === "DRAFT" && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmDialog({
                                  title: "Submit Plan",
                                  description: "Submit this plan for approval?",
                                  confirmLabel: "Submit",
                                  variant: "default",
                                  onConfirm: () => submitPlan(plan.id),
                                })
                              }
                            >
                              <Send className="size-4" /> Submit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setConfirmDialog({
                                  title: "Delete Plan",
                                  description:
                                    "Delete this plan? This cannot be undone.",
                                  onConfirm: () => deletePlan(plan.id),
                                })
                              }
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                        {plan.status === "SUBMITTED" && plan.createdBy.supervisor?.id === user?.id && (
                          <DropdownMenuItem
                            onClick={() =>
                              setConfirmDialog({
                                title: "Approve Plan",
                                description: "Approve this plan?",
                                confirmLabel: "Approve",
                                variant: "default",
                                onConfirm: () => approvePlan(plan.id),
                              })
                            }
                          >
                            <CheckCircle className="size-4" /> Approve
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, total)} of{" "}
              {total}
            </p>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={
                      safePage <= 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                    className={
                      safePage >= maxPage
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <PlanDetailModal
        planId={selectedPlanId}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setSelectedPlanId(undefined)
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        variant={confirmDialog?.variant ?? "destructive"}
        onConfirm={() => {
          confirmDialog?.onConfirm()
          setConfirmDialog(null)
        }}
      />

      <ImportPlansDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
