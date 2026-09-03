import { useEffect, useState, useMemo, useCallback } from "react"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { activityLogApi, type ActivityLog } from "@/lib/api"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@workspace/ui/components/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { CalendarDays, RefreshCw, History } from "lucide-react"
import { EmptyState } from "@/components/empty-state"

const PAGE_SIZE = 20

const ACTION_OPTIONS = [
  { value: "PLAN_CREATED", label: "Plan Created" },
  { value: "PLAN_SUBMITTED", label: "Plan Submitted" },
  { value: "PLAN_APPROVED", label: "Plan Approved" },
  { value: "PLAN_DELETED", label: "Plan Deleted" },
  { value: "USER_STATUS_CHANGED", label: "User Status Changed" },
  { value: "USER_DEACTIVATED", label: "User Deactivated" },
  { value: "OFFICE_CREATED", label: "Office Created" },
  { value: "OFFICE_UPDATED", label: "Office Updated" },
  { value: "OFFICE_DEACTIVATED", label: "Office Deactivated" },
]

const ENTITY_OPTIONS = [
  { value: "Plan", label: "Plan" },
  { value: "User", label: "User" },
  { value: "Office", label: "Office" },
]

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [entityFilter, setEntityFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)

  useEffect(() => {
    let cancelled = false
    activityLogApi
      .getAll({
        take: PAGE_SIZE * 10,
        skip: 0,
        action: actionFilter !== "all" ? actionFilter : undefined,
        entity: entityFilter !== "all" ? entityFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      .then((res) => {
        if (!cancelled) {
          setLogs(res.data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load activity logs")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, actionFilter, entityFilter, dateFrom, dateTo])

  const filtered = useMemo(() => {
    const all = logs ?? []
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(
      (l) =>
        l.user?.name?.toLowerCase().includes(q) ||
        l.user?.email?.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q),
    )
  }, [logs, search])

  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = search || actionFilter !== "all" || entityFilter !== "all"
    ? Math.max(1, Math.min(page, maxPage))
    : page
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const formatDetails = (details: unknown): string => {
    if (!details || typeof details !== "object") return "—"
    const d = details as Record<string, unknown>
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground">Audit trail of system actions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span className="ml-1.5 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Input
            placeholder="Search by user name, email, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full sm:w-40"
          placeholder="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full sm:w-40"
          placeholder="To date"
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
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
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
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={History}
            title="No activity logs found"
            description="Actions will appear here once they are logged"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{log.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{log.user?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {log.action.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.entity}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs">
                    {formatDetails(log.details)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && !error && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                    className={safePage >= maxPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  )
}