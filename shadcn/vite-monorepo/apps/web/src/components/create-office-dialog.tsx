import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  usersApi,
  officesApi,
  type AdminOffice,
  type AdminUser,
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
import { Loader2, Building } from "lucide-react"
import { toast } from "sonner"
import { officeFormSchema, type OfficeFormValues } from "@/lib/schemas"
import { SearchableOfficeSelect } from "@/components/searchable-office-select"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateOfficeDialog({ open, onOpenChange, onCreated }: Props) {
  const [allOffices, setAllOffices] = useState<AdminOffice[]>([])
  const [usersWithoutOffice, setUsersWithoutOffice] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const form = useForm<OfficeFormValues>({
    resolver: zodResolver(officeFormSchema),
    defaultValues: { name: "", headId: "none", parentId: "none" },
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      officesApi.getAll(100, 0).then((r) => r.data),
      usersApi.getWithoutOffice(),
    ])
      .then(([offices, noOfficeUsers]) => {
        setAllOffices(offices)
        setUsersWithoutOffice(noOfficeUsers)
        form.reset({ name: "", headId: "none", parentId: "none" })
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false))
  }, [open, form])

  const handleCreate = async (values: OfficeFormValues) => {
    setSaving(true)
    try {
      await officesApi.create({
        name: values.name,
        userId: values.headId === "none" ? undefined : values.headId,
        parentId: values.parentId === "none" ? undefined : values.parentId,
      })
      toast.success(`Office "${values.name}" created`)
      onCreated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to create office")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Create New Office</DialogTitle>
          <DialogDescription>
            Add a new office to the organizational structure.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleCreate)}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Building className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">New Office</p>
                  <p className="text-xs text-muted-foreground">
                    Fill in the details below
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        disabled={saving}
                        placeholder="e.g. ITS Office"
                        {...field}
                        className="w-full"
                      />
                    </FormControl>
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
                      disabled={saving}
                      placeholder="Select parent office"
                      searchPlaceholder="Search parent offices..."
                      noneLabel="— None (top-level) —"
                    />
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
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select office head" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
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

              <DialogFooter showCloseButton>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {saving ? "Creating..." : "Create Office"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
