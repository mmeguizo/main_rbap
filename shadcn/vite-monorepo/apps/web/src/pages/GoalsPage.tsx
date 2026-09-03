import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { goalsApi, getApiMessage, type Goal } from "@/lib/api"
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
import { GoalDetailModal } from "@/components/goal-detail-modal"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Search, RefreshCw, MoreHorizontal, Eye, Trash2, Target } from "lucide-react"
import { toast } from "sonner"

const STATUS_COLORS: Record<string, "outline" | "secondary" | "default"> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
}

const PAGE_SIZE = 25

export default function GoalsPage() {
  const [searchParams] = useSearchParams()
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [yearFilter, setYearFilter] = useState("")
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [initialRemarkId, setInitialRemarkId] = useState<string | undefined>(undefined)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  const skip = (page - 1) * PAGE_SIZE

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params: Record<string, unknown> = { take: PAGE_SIZE, skip }
    if (statusFilter !== "all") params.status = statusFilter
    if (yearFilter) params.planningYear = Number(yearFilter)
    if (search) params.search = search
    goalsApi.browse(params).then((res) => {
      if (!cancelled) {
        setGoals(res.data)
        setTotal(res.meta.total)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load goals")
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [refreshKey, page, statusFilter, yearFilter, search])

  useEffect(() => {
    const goalParam = searchParams.get('goal')
    const remarkParam = searchParams.get('remark')
    if (goalParam) {
      setSelectedGoalId(goalParam)
      if (remarkParam) setInitialRemarkId(remarkParam)
      setModalOpen(true)
    }
  }, [searchParams])

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openGoalModal = (id: string) => {
    setSelectedGoalId(id)
    setModalOpen(true)
  }

  const openCreateModal = () => {
    setSelectedGoalId(undefined)
    setModalOpen(true)
  }

  const deleteGoal = async (goal: Goal) => {
    try {
      await goalsApi.delete(goal.planId, goal.id)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) { toast.error(getApiMessage(error, "Failed to delete goal")) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals & Outcomes</h1>
          <p className="text-sm text-muted-foreground">Manage goals and outcomes under RBAP plans</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateModal}>
            <Target className="size-4" />
            <span className="ml-1.5 hidden sm:inline">Add New Goal</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by result level, KPI, or person..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
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
        ) : (!goals || goals.length === 0) ? (
          <EmptyState
            icon={Target}
            title={search || statusFilter !== "all" || yearFilter ? "No goals match your filters" : "No goals found"}
            description={search || statusFilter !== "all" || yearFilter ? "Try adjusting your search or filters" : "Goals will appear here once created"}
            action={(search || statusFilter !== "all" || yearFilter) ? <Button variant="link" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setYearFilter(""); setPage(1) }}>Clear filters</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Result Level</TableHead>
                <TableHead>KPI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(goals ?? []).map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Target className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{goal.resultLevel}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{goal.targetResult}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px] text-muted-foreground">
                    <span className="line-clamp-2 text-xs">{goal.keyPerformanceIndicator}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[goal.status]}>
                      {goal.status === "NOT_STARTED" ? "Not Started" : goal.status === "IN_PROGRESS" ? "In Progress" : "Completed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{goal.office.name}</p>
                    <p className="text-xs text-muted-foreground">Year {goal.plan.planningYear}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{goal.responsibleOfficePerson}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openGoalModal(goal.id)}>
                          <Eye className="size-4" />
                          View / Edit
                        </DropdownMenuItem>
                        {goal.plan.status === "DRAFT" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDialog({
                              title: "Delete Goal",
                              description: `Are you sure you want to delete "${goal.resultLevel}"? This will also delete all associated objectives.`,
                              onConfirm: () => deleteGoal(goal),
                            })}>
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
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
                    onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                    className={page >= maxPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <GoalDetailModal
        goalId={selectedGoalId}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) {
            setSelectedGoalId(undefined)
            setInitialRemarkId(undefined)
          }
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
        initialRemarkId={initialRemarkId}
      />

      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel="Delete"
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}
      />
    </div>
  )
}