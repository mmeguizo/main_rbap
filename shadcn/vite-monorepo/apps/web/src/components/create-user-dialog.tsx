import { useEffect, useState } from "react"
import {
  usersApi,
  officesApi,
  type AdminOffice,
  type AdminUser,
} from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { requiresSupervisor, SUPERVISOR_ROLES } from "@/lib/roles"
import { SearchableOfficeSelect } from "@/components/searchable-office-select"

const ROLES = [
  "ADMIN",
  "PRESIDENTS",
  "VICE_PRESIDENTS",
  "DIRECTORS",
  "OFFICE_HEAD",
] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: Props) {
  const [offices, setOffices] = useState<AdminOffice[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<(typeof ROLES)[number]>("OFFICE_HEAD")
  const [workspace, setWorkspace] = useState<"RBAP" | "QM">("RBAP")
  const [officeId, setOfficeId] = useState("none")
  const [supervisorId, setSupervisorId] = useState("none")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([officesApi.getAll(100, 0), usersApi.getAll(100, 0)])
      .then(([officeResult, userResult]) => {
        setOffices(officeResult.data)
        setUsers(userResult.data)
      })
      .catch(() => toast.error("Failed to load offices"))
      .finally(() => setLoading(false))
  }, [open])

  const reset = () => {
    setName("")
    setEmail("")
    setRole("OFFICE_HEAD")
    setWorkspace("RBAP")
    setOfficeId("none")
    setSupervisorId("none")
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast.error("Name and CHMSU email are required")
      return
    }
    if (requiresSupervisor(role) && supervisorId === "none") {
      toast.error("Select the user's higher-level reviewer")
      return
    }

    setSaving(true)
    try {
      await usersApi.create({
        name: name.trim(),
        email: email.trim(),
        role,
        workspace,
        officeId: officeId === "none" ? null : officeId,
        supervisorId: supervisorId === "none" ? null : supervisorId,
      })
      toast.success("User created with RBAP and QM accounts")
      onCreated()
      reset()
      onOpenChange(false)
    } catch {
      toast.error("Failed to create user")
    } finally {
      setSaving(false)
    }
  }

  const availableSupervisors = users.filter(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      SUPERVISOR_ROLES[role].includes(candidate.role)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            Creates an account in both RBAP and QM. Assign the user's
            higher-level reviewer so submitted plans reach the right approver.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="size-5 text-primary" />
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Full name *</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={saving} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">CHMSU email *</span>
              <Input
                type="email"
                placeholder="name@chmsu.edu.ph"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={saving}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">RBAP role</span>
              <Select
                value={role}
                onValueChange={(value: (typeof ROLES)[number]) => {
                  setRole(value)
                  setSupervisorId("none")
                }}
                disabled={saving}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">
                Higher-level reviewer{requiresSupervisor(role) ? " *" : ""}
              </span>
              <Select
                value={supervisorId}
                onValueChange={setSupervisorId}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reviewer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {requiresSupervisor(role) ? "Select reviewer" : "No reviewer"}
                  </SelectItem>
                  {availableSupervisors.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.role.replace(/_/g, " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Initial login workspace</span>
              <Select value={workspace} onValueChange={(value: "RBAP" | "QM") => setWorkspace(value)} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RBAP">RBAP / Planning</SelectItem>
                  <SelectItem value="QM">QM / Quality Management</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Office</span>
              <SearchableOfficeSelect
                value={officeId}
                onValueChange={setOfficeId}
                offices={offices}
                disabled={saving}
                placeholder="Select office"
                noneLabel="No office yet"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
