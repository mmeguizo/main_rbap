import { useEffect, useState, useCallback } from "react"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { officesApi, getApiMessage, type AdminOffice } from "@/lib/api"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { OfficeDetailModal } from "@/components/office-detail-modal"
import { CreateOfficeDialog } from "@/components/create-office-dialog"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useAuth } from "@/contexts/useAuth"
import { ROLE_HIERARCHY, hasMinRole } from "@/lib/roles"
import { Search, RefreshCw, MoreHorizontal, Eye, Trash2, Building, Plus } from "lucide-react"
import { toast } from "sonner"

const PAGE_SIZE = 25

export default function OfficesPage() {
  const { user } = useAuth()
  const [offices, setOffices] = useState<AdminOffice[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  useRefreshOnFocus(refresh)
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false
    officesApi.getAll(PAGE_SIZE, (page - 1) * PAGE_SIZE).then((res) => {
      if (!cancelled) {
        setOffices(res.data)
        setTotal(res.meta.total)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load offices")
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [refreshKey, page])

  useEffect(() => {
    setPage(1)
  }, [search])

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.max(1, Math.min(page, maxPage))
  const paginated = offices ?? []

  const openOfficeModal = (officeId: string) => {
    setSelectedOfficeId(officeId)
    setModalOpen(true)
  }

  const deleteOffice = async (officeId: string) => {
    try {
      await officesApi.delete(officeId)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to delete office"))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offices</h1>
          <p className="text-sm text-muted-foreground">Manage offices and organizational units</p>
        </div>
        <div className="flex items-center gap-2">
          {hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS) && (
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="size-4" />
              <span className="ml-1.5 hidden sm:inline">New Office</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search offices by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
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
            icon={Building}
            title={search ? "No offices match your search" : "No offices found"}
            description={search ? "Try adjusting your search terms" : "Offices will appear here once created"}
            action={search ? <Button variant="link" size="sm" onClick={() => setSearch("")}>Clear search</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Head</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((office) => {
                const head = office.head as { name?: string; email?: string } | null
                const parent = offices?.find((o) => o.id === office.parentId)
                return (
                  <TableRow key={office.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Building className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{office.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {head?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{office.members?.length ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {parent?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(office.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openOfficeModal(office.id)}>
                            <Eye className="size-4" />
                            View / Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmDialog({
                              title: "Delete Office",
                              description: `Are you sure you want to delete "${office.name}"? This action cannot be undone.`,
                              onConfirm: () => deleteOffice(office.id),
                            })}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {!loading && !error && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, total)} of {total}
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

      {selectedOfficeId && (
        <OfficeDetailModal
          officeId={selectedOfficeId}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setSelectedOfficeId(null)
          }}
          onUpdated={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <CreateOfficeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
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
