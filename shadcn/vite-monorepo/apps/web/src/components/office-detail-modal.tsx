import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  usersApi,
  officesApi,
  type AdminOffice,
  type AdminUser,
  type OfficeHead,
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
import { Input } from "@/components/input"
import {
  Form,
  FormControl,
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
import { ROLE_HIERARCHY, hasMinRole } from "@/lib/roles"
import {
  Loader2,
  Trash2,
  Building,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { officeFormSchema, type OfficeFormValues } from "@/lib/schemas"
import { SearchableOfficeSelect } from "@/components/searchable-office-select"

interface Props {
  officeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function OfficeDetailModal({
  officeId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const { user } = useAuth()
  const [office, setOffice] = useState<AdminOffice | null>(null)
  const [allOffices, setAllOffices] = useState<AdminOffice[]>([])
  const [usersWithoutOffice, setUsersWithoutOffice] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<OfficeFormValues>({
    resolver: zodResolver(officeFormSchema),
    defaultValues: { name: "", headId: "none", parentId: "none" },
  })

  useEffect(() => {
    if (!open) return
    Promise.all([
      officesApi.getAll(100, 0).then((r) => r.data),
      usersApi.getWithoutOffice(),
    ])
      .then(([offices, noOfficeUsers]) => {
        setAllOffices(offices)
        setUsersWithoutOffice(noOfficeUsers)
        const found = offices.find((o) => o.id === officeId) ?? null
        setOffice(found)
        if (found) {
          form.reset({
            name: found.name,
            headId: found.headId ?? "none",
            parentId: found.parentId ?? "none",
          })
        }
      })
      .catch(() => toast.error("Failed to load office"))
      .finally(() => setLoading(false))
  }, [officeId, open, form])

  const handleUpdate = async (values: OfficeFormValues) => {
    if (!office) return
    setSaving("update")
    try {
      await officesApi.update({
        officeId: office.id,
        name: values.name !== office.name ? values.name : undefined,
        userId: values.headId === "none" ? undefined : values.headId,
        parentId: values.parentId === "none" ? undefined : values.parentId,
      })
      onUpdated()
    } catch {
      toast.error("Failed to update office")
    } finally {
      setSaving(null)
    }
  }

  const deleteOffice = async () => {
    if (!office) return
    setSaving("delete")
    try {
      await officesApi.delete(office.id)
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to delete office")
    } finally {
      setSaving(null)
    }
  }

  const busy = saving !== null
  const headUser = office?.head as OfficeHead | null
  const [membersOpen, setMembersOpen] = useState(true)

  const editFields = (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name *</FormLabel>
            <FormControl>
              <Input disabled={busy} {...field} className="w-full" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="headId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Office Head</FormLabel>
            <Select
              value={field.value ?? "none"}
              onValueChange={field.onChange}
              disabled={busy}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select head" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {headUser &&
                  !usersWithoutOffice.find((u) => u.id === headUser.id) && (
                    <SelectItem key={headUser.id} value={headUser.id}>
                      {headUser.name} ({headUser.email}) — current
                    </SelectItem>
                  )}
                {usersWithoutOffice.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="parentId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parent Office</FormLabel>
            <SearchableOfficeSelect
              value={field.value ?? "none"}
              onValueChange={field.onChange}
              offices={allOffices}
              excludeId={office?.id}
              disabled={busy}
              placeholder="Select parent"
              searchPlaceholder="Search parent offices..."
              noneLabel="— None (top-level) —"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Office Details</DialogTitle>
          <DialogDescription>View and manage this office.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : office ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleUpdate)}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Building className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{office.name}</p>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {office.id}
                  </p>
                </div>
                <Badge variant="default">Active</Badge>
              </div>

              {hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS) ? (
                editFields
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Name
                      </p>
                      <p className="text-sm truncate">{office.name}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Office Head
                      </p>
                      <p className="text-sm truncate">{headUser?.name ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Parent Office
                      </p>
                      <p className="text-sm truncate">
                        {allOffices.find((o) => o.id === office.parentId)
                          ?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setMembersOpen(!membersOpen)}
                  className="flex w-full items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Members</p>
                      <p className="text-xs text-muted-foreground">
                        {office.members?.length ?? 0} user
                        {(office.members?.length ?? 0) !== 1 ? "s" : ""}{" "}
                        assigned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tabular-nums">
                      {office.members?.length ?? 0}
                    </span>
                    {membersOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {membersOpen && (
                  <div className="border-t">
                    {office.members && office.members.length > 0 ? (
                      <div className="divide-y">
                        {office.members.map((member) => {
                          const m = member as {
                            id: string
                            name: string
                            email: string
                            role?: string
                            status?: string
                          }
                          const isHead = m.id === office.headId
                          return (
                            <div
                              key={m.id}
                              className="flex items-center gap-3 px-3 py-2.5"
                            >
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {m.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium">
                                    {m.name}
                                  </p>
                                  {isHead && (
                                    <Badge
                                      variant="outline"
                                      className="h-4 px-1.5 py-0 text-[10px]"
                                    >
                                      Head
                                    </Badge>
                                  )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                  {m.email}
                                </p>
                              </div>
                              {m.role && (
                                <Badge
                                  variant={
                                    m.role === "ADMIN" ? "default" : "secondary"
                                  }
                                  className="h-5 shrink-0 px-1.5 py-0 text-[10px]"
                                >
                                  {m.role.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No members assigned to this office
                      </p>
                    )}
                  </div>
                )}
              </div>

              {hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS) && (
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={busy || !form.formState.isDirty}
                  >
                    {saving === "update" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {saving === "update" ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    {saving === "delete" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <Building className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Office not found</p>
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Office"
        description={`Are you sure you want to delete "${office?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteOffice}
      />
    </Dialog>
  )
}