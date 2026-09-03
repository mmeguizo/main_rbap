import { useEffect, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { plansApi, getApiMessage, type Plan, type PlanStatus } from "@/lib/api"
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
import { useAuth } from "@/contexts/useAuth"
import { ROLE_HIERARCHY, hasMinRole } from "@/lib/roles"
import { PlanDetailModal } from "@/components/plan-detail-modal"
import { ImportPlansDialog } from "@/components/import-plans-dialog"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Search, RefreshCw, MoreHorizontal, Eye, Trash2, FileText, Send, CheckCircle, FileDown, Download, Upload } from "lucide-react"
import { toast } from "sonner"

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
}

const PAGE_SIZE = 10

export default function PlansPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [yearFilter, setYearFilter] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; confirmLabel?: string; variant?: "destructive" | "default"; onConfirm: () => void } | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    plansApi.getAll({
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      search: search || undefined,
      status: statusFilter !== "all" ? (statusFilter as PlanStatus) : undefined,
      planningYear: yearFilter ? Number(yearFilter) : undefined,
    }).then((res) => {
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
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load plans")
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [refreshKey, searchParams, page, search, statusFilter, yearFilter])

  const openPlanModal = (id: string) => {
    setSelectedPlanId(id)
    setModalOpen(true)
  }

  const openCreateModal = () => {
    setSelectedPlanId(undefined)
    setModalOpen(true)
  }

  const submitPlan = async (id: string) => {
    try { await plansApi.submit(id); setRefreshKey((k) => k + 1) } catch (error: unknown) { toast.error(getApiMessage(error, "Failed to submit plan")) }
  }

  const approvePlan = async (id: string) => {
    try { await plansApi.approve(id); setRefreshKey((k) => k + 1) } catch (error: unknown) { toast.error(getApiMessage(error, "Failed to approve plan")) }
  }

  const deletePlan = async (id: string) => {
    try { await plansApi.delete(id); setRefreshKey((k) => k + 1) } catch (error: unknown) { toast.error(getApiMessage(error, "Failed to delete plan")) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">RBAP Plans</h1>
          <p className="text-sm text-muted-foreground">Annual Results-Based Action Plans</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateModal}>
            <FileText className="size-4" />
            <span className="ml-1.5 hidden sm:inline">Add New Plan</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              try {
                const blob = await plansApi.exportExcel({
                  search: search || undefined,
      status: statusFilter !== "all" ? (statusFilter as PlanStatus) : undefined,
                  planningYear: yearFilter ? Number(yearFilter) : undefined,
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "rbap-plans-export.xlsx"
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by office, campus, or KRA..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
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
        <Input
          type="number"
          placeholder="Year"
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setPage(1) }}
          className="w-24"
          min={2000}
        />
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
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        ) : !plans || plans.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search || statusFilter !== "all" || yearFilter ? "No plans match your filters" : "No plans found"}
            description={search || statusFilter !== "all" || yearFilter ? "Try adjusting your search or filters" : "Plans will appear here once created"}
            action={(search || statusFilter !== "all" || yearFilter) ? <Button variant="link" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setYearFilter("") }}>Clear filters</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Office</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>KRA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Goals</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{plan.office.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{plan.planningYear}</TableCell>
                  <TableCell className="text-muted-foreground">{plan.campus}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {plan.programProjectActivityKRA}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[plan.status]}>
                      {plan.status === "SUBMITTED" ? "Submitted" : plan.status.charAt(0) + plan.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{plan._count.goals}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{plan.createdBy.name}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => navigate(`/plans/${plan.id}/view`)}>
                          <FileText className="size-4" />
                          Open workspace
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPlanModal(plan.id)}>
                          <Eye className="size-4" />
                          View / Edit
                        </DropdownMenuItem>
                        {hasMinRole(user?.role, ROLE_HIERARCHY.OFFICE_HEAD) && (
                          <DropdownMenuItem onClick={async () => {
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
                          }}>
                            <FileDown className="size-4" />
                            Export PDF
                          </DropdownMenuItem>
                        )}
                        {plan.status === "DRAFT" && (
                          <>
                            <DropdownMenuItem onClick={() => setConfirmDialog({
                              title: "Submit Plan",
                              description: "Are you sure you want to submit this plan for approval?",
                              confirmLabel: "Submit",
                              variant: "default",
                              onConfirm: () => submitPlan(plan.id),
                            })}>
                              <Send className="size-4" />
                              Submit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDialog({
                              title: "Delete Plan",
                              description: "Are you sure you want to delete this plan? This action cannot be undone.",
                              onConfirm: () => deletePlan(plan.id),
                            })}>
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                        {plan.status === "SUBMITTED" && plan.createdBy.supervisor?.id === user?.id && (
                          <DropdownMenuItem onClick={() => setConfirmDialog({
                            title: "Approve Plan",
                            description: "Are you sure you want to approve this plan?",
                            confirmLabel: "Approve",
                            variant: "default",
                            onConfirm: () => approvePlan(plan.id),
                          })}>
                            <CheckCircle className="size-4" />
                            Approve
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

        {!loading && !error && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => p + 1)}
                    className={page * PAGE_SIZE >= total ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}
      />

      <ImportPlansDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
