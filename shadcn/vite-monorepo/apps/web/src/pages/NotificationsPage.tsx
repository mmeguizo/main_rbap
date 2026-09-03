import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { notificationsApi, type Notification, type NotificationType } from "@/lib/api"
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
import { Bell, RefreshCw, CheckCheck, ExternalLink } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { toast } from "sonner"

const PAGE_SIZE = 20

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
  { value: "SUCCESS", label: "Success" },
  { value: "ERROR", label: "Error" },
]

const TYPE_BADGE: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  WARNING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)

  const [readFilter, setReadFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  const skip = (page - 1) * PAGE_SIZE

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    notificationsApi
      .getAll({
        take: PAGE_SIZE,
        skip,
        read: readFilter === "all" ? undefined : readFilter === "read",
        type: typeFilter !== "all" ? (typeFilter as NotificationType) : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search.trim() || undefined,
      })
      .then((res) => {
        if (!cancelled) {
          setNotifications(res.data)
          setTotal(res.total)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load notifications")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, page, readFilter, typeFilter, dateFrom, dateTo, search])

  const handleRowClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await notificationsApi.markAsRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        )
      } catch {
        toast.error("Failed to mark notification as read")
      }
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success("All notifications marked as read")
    } catch {
      toast.error("Failed to mark all notifications as read")
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.max(1, Math.min(page, maxPage))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">View and manage all your notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={loading || notifications.every((n) => n.read)}
          >
            <CheckCheck className="size-4" />
            <span className="ml-1.5 hidden sm:inline">Mark all read</span>
          </Button>
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Input
            placeholder="Search by title or message..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex gap-2 rounded-lg border bg-muted/30 p-1">
          {["all", "unread", "read"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setReadFilter(opt)
                setPage(1)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                readFilter === opt
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt === "all" ? "All" : opt === "unread" ? "Unread" : "Read"}
            </button>
          ))}
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-36"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-36"
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
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications found"
            description="You're all caught up!"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Message</TableHead>
                <TableHead className="w-16">Status</TableHead>
                <TableHead className="w-40">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow
                  key={notification.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    !notification.read ? "font-medium" : ""
                  }`}
                  onClick={() => handleRowClick(notification)}
                >
                  <TableCell>
                    <Badge className={`text-xs ${TYPE_BADGE[notification.type] || ""}`} variant="outline">
                      {notification.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={!notification.read ? "text-foreground" : "text-muted-foreground"}>
                        {notification.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground sm:table-cell">
                    {notification.message}
                  </TableCell>
                  <TableCell>
                    {!notification.read && (
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-primary" />
                        <span className="text-xs">New</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {notification.link && (
                      <ExternalLink className="size-3.5 text-muted-foreground/50" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && !error && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
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
