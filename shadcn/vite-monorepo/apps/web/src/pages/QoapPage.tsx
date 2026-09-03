import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/useAuth"
import { isQmUser, canManageQoapQom } from "@/lib/qm"
import {
  qoapApi,
  getApiMessage,
  type QoapSummary,
  type Qom,
} from "@/lib/api"
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
import { QoapFormDialog } from "@/components/qoap-form-dialog"
import { QoapDetailModal } from "@/components/qoap-detail-modal"
import { QomFormDialog } from "@/components/qom-form-dialog"
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  FileDown,
  FileSpreadsheet,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

const PAGE_SIZE = 20
const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  BIANNUAL: "Biannual",
  ANNUAL: "Annual",
}

export default function QoapPage() {
  const { user } = useAuth()
  const isQm = isQmUser(user)
  const canManage = canManageQoapQom(user)
  const [items, setItems] = useState<QoapSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [skip, setSkip] = useState(0)
  const [total, setTotal] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<QoapSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QoapSummary | null>(null)
  const [detailTarget, setDetailTarget] = useState<QoapSummary | null>(null)
  const [detailKey, setDetailKey] = useState(0)
  const [qomDialogOpen, setQomDialogOpen] = useState(false)
  const [qomEditTarget, setQomEditTarget] = useState<Qom | null>(null)
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    qoapApi
      .getAll({ take: PAGE_SIZE, skip })
      .then((res) => {
        if (cancelled) return
        setItems(res.data)
        setTotal(res.meta.total)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setItems([])
        toast.error(getApiMessage(error, "Failed to load QOAPs"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey, skip])

  const deleteQoap = async (id: string) => {
    try {
      await qoapApi.delete(id)
      toast.success("QOAP deleted")
      setDeleteTarget(null)
      refresh()
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to delete QOAP"))
    }
  }

  const exportQoap = async (item: QoapSummary, format: "pdf" | "excel") => {
    try {
      const blob =
        format === "pdf"
          ? await qoapApi.exportPdf(item.id)
          : await qoapApi.exportExcel(item.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `qoap-${item.id}.${format === "pdf" ? "pdf" : "xlsx"}`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error: unknown) {
      toast.error(
        getApiMessage(error, `Failed to export QOAP as ${format.toUpperCase()}`)
      )
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Quality Objectives and Action Plans
          </h1>
          <p className="text-sm text-muted-foreground">
            {isQm
              ? "QM overview — all offices' QOAPs merged with their RBAP context."
              : "QOAPs for the offices you can access."}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              <span className="ml-1.5 hidden sm:inline">New QOAP</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="h-9 w-9 animate-pulse rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No QOAPs yet"
            description={
              isQm
                ? "Create the first QOAP by selecting an RBAP Goal."
                : "No QOAPs are available for your accessible offices."
            }
            action={
              canManage ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create QOAP
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table containerClassName="max-h-[calc(100vh-280px)] overflow-y-auto">
            <TableHeader className="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-30 [&_tr]:bg-card [&_tr]:border-b">
              <TableRow>
                <TableHead>Reporting Office</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Functional Objective</TableHead>
                <TableHead>Frequency of Monitoring</TableHead>
                <TableHead>QOM Records</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const frequency =
                  item.goal.plan.monitoringFrequency ?? item.monitoringFrequency
                return (
                  <TableRow key={item.id} className="cursor-pointer">
                    <TableCell
                      className="font-medium"
                      onClick={() => setDetailTarget(item)}
                    >
                      {item.goal.plan.reportingOffice ?? item.office.name}
                    </TableCell>
                    <TableCell
                      className="tabular-nums"
                      onClick={() => setDetailTarget(item)}
                    >
                      {item.goal.plan.planningYear}
                    </TableCell>
                    <TableCell
                      className="max-w-80 truncate"
                      onClick={() => setDetailTarget(item)}
                    >
                      <span title={item.functionalObjective}>
                        {item.functionalObjective}
                      </span>
                    </TableCell>
                    <TableCell onClick={() => setDetailTarget(item)}>
                      <Badge variant="secondary">
                        {FREQUENCY_LABELS[frequency.toUpperCase()] ??
                          frequency}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setDetailTarget(item)}>
                      <Badge variant="outline">
                        {item._count.qoms} record
                        {item._count.qoms === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="View QOAP"
                          onClick={() => setDetailTarget(item)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Edit QOAP"
                              onClick={() => setEditTarget(item)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              title="Delete QOAP"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Export QOAP as PDF"
                          onClick={() => exportQoap(item, "pdf")}
                        >
                          <FileDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Export QOAP as Excel"
                          onClick={() => exportQoap(item, "excel")}
                        >
                          <FileSpreadsheet className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1))
                      setSkip(Math.max(0, (page - 2) * PAGE_SIZE))
                    }}
                    className={
                      page <= 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => {
                      setPage((current) => Math.min(maxPage, current + 1))
                      setSkip(page * PAGE_SIZE)
                    }}
                    className={
                      page >= maxPage
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

      <QoapFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => {
          setPage(1)
          setSkip(0)
          refresh()
        }}
        takenGoalIds={(items ?? []).map((item) => item.goalId)}
      />

      <QoapFormDialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        onSaved={refresh}
        editing={
          editTarget ? { id: editTarget.id, goalId: editTarget.goalId } : null
        }
      />

      <QoapDetailModal
        key={detailKey}
        qoapId={detailTarget?.id ?? null}
        open={!!detailTarget}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null)
        }}
        canManage={canManage}
        onAddQom={() => {
          setQomEditTarget(null)
          setQomDialogOpen(true)
        }}
        onEditQom={(qom) => {
          setQomEditTarget(qom)
          setQomDialogOpen(true)
        }}
      />

      <QomFormDialog
        open={qomDialogOpen}
        onOpenChange={setQomDialogOpen}
        onSaved={() => {
          setDetailKey((key) => key + 1)
          refresh()
        }}
        qoapId={detailTarget?.id ?? ""}
        editing={qomEditTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete QOAP"
        description="Delete this QOAP? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteQoap(deleteTarget.id)}
      />
    </div>
  )
}
