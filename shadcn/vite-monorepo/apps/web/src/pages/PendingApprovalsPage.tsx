import { useEffect, useState, useCallback } from "react"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { Link } from "react-router-dom"
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@workspace/ui/components/pagination"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { RefreshCw, Clock, CheckCircle, Eye } from "lucide-react"
import { toast } from "sonner"

const PAGE_SIZE = 10

export default function PendingApprovalsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; confirmLabel?: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false
    plansApi.getPendingApprovals({ take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }).then((res) => {
      if (!cancelled) {
        setPlans(res.data)
        setTotal(res.meta.total)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) { setPlans([]); setTotal(0); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [page, refreshKey])

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const approvePlan = async (id: string) => {
    try { await plansApi.approve(id); setRefreshKey((k) => k + 1) } catch (error: unknown) { toast.error(getApiMessage(error, "Failed to approve plan")) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pending Approvals</h1>
          <p className="text-sm text-muted-foreground">Plans submitted by subordinate offices awaiting your review</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No pending approvals"
            description="All submitted plans have been reviewed. Check back later."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Office</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>KRA</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Goals</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Clock className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{plan.office.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.createdBy.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{plan.planningYear}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {plan.programProjectActivityKRA}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {plan.submittedAt ? new Date(plan.submittedAt).toLocaleDateString("en-PH") : "—"}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{plan._count.goals}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link to={`/plans?plan=${plan.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="size-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setConfirmDialog({
                          title: "Approve Plan",
                          description: `Approve ${plan.office.name}'s plan for FY ${plan.planningYear}?`,
                          confirmLabel: "Approve",
                          onConfirm: () => approvePlan(plan.id),
                        })}
                      >
                        <CheckCircle className="size-3.5" />
                        <span className="ml-1">Approve</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                    className={page >= maxPage ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        variant="default"
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}
      />
    </div>
  )
}
