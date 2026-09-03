import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  usersApi,
  officesApi,
  type AdminUser,
  type AdminOffice,
  type AdminMembership,
} from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useAuth } from "@/contexts/useAuth"
import {
  ROLE_HIERARCHY,
  hasMinRole,
  requiresSupervisor,
  SUPERVISOR_ROLES,
} from "@/lib/roles"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { userFormSchema, type UserFormValues } from "@/lib/schemas"
import { SearchableOfficeSelect } from "@/components/searchable-office-select"

const ROLES = [
  "ADMIN",
  "PRESIDENTS",
  "VICE_PRESIDENTS",
  "DIRECTORS",
  "OFFICE_HEAD",
] as const

interface Props {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function UserDetailModal({
  userId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [offices, setOffices] = useState<AdminOffice[]>([])
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<AdminMembership[]>([])

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { role: "", officeId: "none", supervisorId: "none" },
  })

  useEffect(() => {
    if (!open) return
    Promise.all([
      usersApi.getById(userId),
      officesApi.getAll(100, 0),
      usersApi.getAll(100, 0),
      usersApi.getMemberships(userId),
    ])
      .then(([u, o, usersResult, accountList]) => {
        setUser(u)
        setOffices(o.data)
        setAllUsers(usersResult.data)
        setMemberships(accountList)
        form.reset({
          role: u.role,
          officeId: u.office?.id ?? "none",
          supervisorId: u.supervisor?.id ?? "none",
        })
      })
      .catch(() => toast.error("Failed to load user"))
      .finally(() => setLoading(false))
  }, [userId, open, form])

  const syncMemberships = async () => {
    if (!user) return
    setSaving("memberships")
    try {
      const synced = await usersApi.syncMemberships(user.id)
      setMemberships(synced)
      toast.success("RBAP and QM workspace accounts synchronized")
    } catch {
      toast.error("Failed to synchronize workspace accounts")
    } finally {
      setSaving(null)
    }
  }

  const changeRole = async () => {
    const valid = await form.trigger("role")
    if (!valid || !user) return
    const currentRole = form.getValues("role")
    if (currentRole === user.role) return
    setSaving("role")
    try {
      await usersApi.assignRole(user.id, currentRole)
      onUpdated()
    } catch {
      toast.error("Failed to update role")
    } finally {
      setSaving(null)
    }
  }

  const assignOffice = async () => {
    if (!user) return
    const officeId = form.getValues("officeId")
    const resolvedOfficeId = officeId === "none" ? null : officeId
    setSaving("office")
    try {
      await usersApi.assignOffice(user.id, resolvedOfficeId)
      onUpdated()
    } catch {
      toast.error("Failed to assign office")
    } finally {
      setSaving(null)
    }

  }

  const assignSupervisor = async () => {
    if (!user) return
    const supervisorId = form.getValues("supervisorId")
    if (requiresSupervisor(user.role) && supervisorId === "none") {
      toast.error("Select a higher-level reviewer before saving")
      return
    }
    setSaving("supervisor")
    try {
      await usersApi.assignSupervisor(
        user.id,
        supervisorId === "none" ? null : supervisorId
      )
      onUpdated()
    } catch {
      toast.error("Failed to assign supervisor")
    } finally {
      setSaving(null)
    }
  }

  const toggleStatus = async () => {
    if (!user) return
    setSaving("status")
    try {
      await usersApi.toggleStatus(user.id)
      onUpdated()
    } catch {
      toast.error("Failed to update status")
    } finally {
      setSaving(null)
    }
  }

  const deleteUser = async () => {
    if (!user) return
    setSaving("delete")
    try {
      await usersApi.softDelete(user.id)
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to delete user")
    } finally {
      setSaving(null)
    }
  }

  const busy = saving !== null
  const selectedRole = form.watch("role")
  const availableSupervisors = allUsers.filter(
    (candidate) =>
      candidate.id !== user?.id &&
      candidate.status === "ACTIVE" &&
      (SUPERVISOR_ROLES[selectedRole] ?? []).includes(candidate.role)
  )

  const confirmLabels: Record<string, { title: string; description: string }> =
    {
      delete: {
        title: "Delete User",
        description: `Are you sure you want to delete ${user?.name ?? user?.email}? This action cannot be undone.`,
      },
      status: {
        title: `${user?.status === "ACTIVE" ? "Deactivate" : "Activate"} User`,
        description: `Are you sure you want to ${user?.status === "ACTIVE" ? "deactivate" : "activate"} ${user?.name ?? user?.email}?`,
      },
    }
  const pendingConfirm = confirmAction
    ? (confirmLabels[confirmAction] ?? null)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View and manage this user's account.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <Form {...form}>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{user.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge
                  variant={user.status === "ACTIVE" ? "default" : "destructive"}
                  className="ml-auto"
                >
                  {user.status === "ACTIVE" ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  User ID
                </p>
                <p className="font-mono text-xs">{user.id}</p>
              </div>

              {hasMinRole(currentUser?.role, ROLE_HIERARCHY.ADMIN) && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Workspace Accounts</p>
                    <p className="text-xs text-muted-foreground">
                      RBAP and QM use the same role and office for this user.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{membership.workspace}</p>
                          <p className="text-xs text-muted-foreground">
                            {membership.role.replace(/_/g, " ")} ·{" "}
                            {membership.office?.name ?? "No office"}
                          </p>
                        </div>
                        <Badge
                          variant={
                            membership.status === "ACTIVE"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {membership.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      Both workspaces use this user&apos;s current role and office.
                      Use sync to restore a missing account or repair old imported records.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={syncMemberships}
                      disabled={busy}
                    >
                      {saving === "memberships" && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      {saving === "memberships"
                        ? "Synchronizing..."
                        : "Sync RBAP + QM Accounts"}
                    </Button>
                  </div>
                </div>
              )}

              {hasMinRole(currentUser?.role, ROLE_HIERARCHY.ADMIN) && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <FormField
                          control={form.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={busy}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {r.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={changeRole}
                        disabled={busy || form.getValues("role") === user.role}
                      >
                        {saving === "role" && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        {saving === "role" ? "Saving..." : "Update"}
                      </Button>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <FormField
                          control={form.control}
                          name="supervisorId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Higher-level reviewer
                                {requiresSupervisor(selectedRole) ? " *" : ""}
                              </FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={busy}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select reviewer" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    {requiresSupervisor(selectedRole)
                                      ? "Select reviewer"
                                      : "No reviewer"}
                                  </SelectItem>
                                  {availableSupervisors.map((candidate) => (
                                    <SelectItem
                                      key={candidate.id}
                                      value={candidate.id}
                                    >
                                      {candidate.name} (
                                      {candidate.role.replace(/_/g, " ")})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={assignSupervisor}
                        disabled={
                          busy ||
                          form.getValues("supervisorId") ===
                            (user.supervisor?.id ?? "none")
                        }
                      >
                        {saving === "supervisor" && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        {saving === "supervisor" ? "Saving..." : "Update"}
                      </Button>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <FormField
                          control={form.control}
                          name="officeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Office</FormLabel>
                              <SearchableOfficeSelect
                                value={field.value}
                                onValueChange={field.onChange}
                                offices={offices}
                                disabled={busy}
                                noneLabel="— None —"
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={assignOffice}
                        disabled={
                          busy ||
                          form.getValues("officeId") ===
                            (user.office?.id ?? "none")
                        }
                      >
                        {saving === "office" && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        {saving === "office" ? "Saving..." : "Update"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Account Status</p>
                      <p className="text-xs text-muted-foreground">
                        {user.status === "ACTIVE"
                          ? "User can sign in"
                          : "User cannot sign in"}
                      </p>
                    </div>
                    <Button
                      variant={
                        user.status === "ACTIVE" ? "destructive" : "default"
                      }
                      size="sm"
                      onClick={() => setConfirmAction("status")}
                      disabled={busy}
                    >
                      {saving === "status" && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      {saving === "status"
                        ? "Saving..."
                        : user.status === "ACTIVE"
                          ? "Deactivate"
                          : "Activate"}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-destructive/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          Danger Zone
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Permanently delete this user account
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmAction("delete")}
                        disabled={busy}
                      >
                        {saving === "delete" ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        <span className="ml-1.5">Delete</span>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Form>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Could not load user details.
          </p>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={
          confirmAction === "delete"
            ? "Delete"
            : confirmAction === "status"
              ? user?.status === "ACTIVE"
                ? "Deactivate"
                : "Activate"
              : "Confirm"
        }
        variant={
          confirmAction === "status" && user?.status !== "ACTIVE"
            ? "default"
            : "destructive"
        }
        onConfirm={() => {
          if (confirmAction === "delete") deleteUser()
          else if (confirmAction === "status") toggleStatus()
        }}
      />
    </Dialog>
  )
}
