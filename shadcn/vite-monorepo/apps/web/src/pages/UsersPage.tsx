import { useEffect, useState } from "react"
import { usersApi, getApiMessage, type AdminUser } from "@/lib/api"
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
import { UserDetailModal } from "@/components/user-detail-modal"
import { CreateUserDialog } from "@/components/create-user-dialog"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Search, RefreshCw, MoreHorizontal, Eye, ToggleLeft, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ADMIN: "default",
  PRESIDENTS: "secondary",
  VICE_PRESIDENTS: "secondary",
  DIRECTORS: "outline",
  OFFICE_HEAD: "outline",
}

const PAGE_SIZE = 10

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const skip = (page - 1) * PAGE_SIZE
    usersApi.getAll(PAGE_SIZE, skip, search || undefined).then((res) => {
      if (!cancelled) {
        setUsers(res.data)
        setTotal(res.total)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load users")
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [refreshKey, search, page])

  const openUserModal = (userId: string) => {
    setSelectedUserId(userId)
    setModalOpen(true)
  }

  const toggleUserStatus = async (userId: string) => {
    try {
      await usersApi.toggleStatus(userId)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update user status"))
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      await usersApi.softDelete(userId)
      setRefreshKey((k) => k + 1)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to delete user"))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Users className="size-4" />
            <span className="ml-1.5">Add User</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or role..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
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
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No users match your search" : "No users found"}
            description={search ? "Try adjusting your search terms" : "Users will appear here once added"}
            action={search ? <Button variant="link" size="sm" onClick={() => setSearch("")}>Clear search</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Workspace Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Office</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.name ?? "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(user.memberships ?? []).length > 0
                        ? user.memberships?.map((membership) => (
                            <Badge
                              key={membership.id}
                              variant={ROLE_VARIANTS[membership.role] ?? "outline"}
                            >
                              {membership.workspace}:{" "}
                              {membership.role.replace(/_/g, " ")}
                            </Badge>
                          ))
                        : (
                            <Badge variant={ROLE_VARIANTS[user.role] ?? "outline"}>
                              RBAP: {user.role.replace(/_/g, " ")}
                            </Badge>
                          )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>
                      {user.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.office?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openUserModal(user.id)}>
                          <Eye className="size-4" />
                          View / Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmDialog({
                          title: `${user.status === "ACTIVE" ? "Deactivate" : "Activate"} User`,
                          description: `Are you sure you want to ${user.status === "ACTIVE" ? "deactivate" : "activate"} ${user.name ?? user.email}?`,
                          onConfirm: () => toggleUserStatus(user.id),
                        })}>
                          <ToggleLeft className="size-4" />
                          {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setConfirmDialog({
                            title: "Delete User",
                            description: `Are you sure you want to delete ${user.name ?? user.email}? This action cannot be undone.`,
                            onConfirm: () => deleteUser(user.id),
                          })}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
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
                    onClick={() => setPage((p) => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                    className={page >= Math.ceil(total / PAGE_SIZE) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setSelectedUserId(null)
          }}
          onUpdated={() => setRefreshKey((k) => k + 1)}
        />
      )}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.title?.includes("Delete") ? "Delete" : confirmDialog?.title?.includes("Deactivate") ? "Deactivate" : "Activate"}
        variant={confirmDialog?.title?.includes("Activate") ? "default" : "destructive"}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}
      />
    </div>
  )
}
