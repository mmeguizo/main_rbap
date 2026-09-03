import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { qoapApi, getApiMessage, type QoapAvailableGoal } from "@/lib/api"
import { qoapFormSchema, type QoapFormValues } from "@/lib/schemas"
import { cn } from "@workspace/ui/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editing?: {
    id: string
    goalId: string
  } | null
  takenGoalIds?: string[]
}

export function QoapFormDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
  takenGoalIds = [],
}: Props) {
  const [goals, setGoals] = useState<QoapAvailableGoal[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<QoapFormValues>({
    resolver: zodResolver(qoapFormSchema),
    defaultValues: {
      goalId: "",
      functionalObjective: "",
      indicators: "",
      indicatorFormula: "",
      resources: "",
      intendedOutcomes: "",
    },
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const loadGoals = qoapApi
      .getAvailableGoals({ take: 500 })
      .then((res) => res.data)
      .catch(() => [])
    const loadDetail = editing
      ? qoapApi.getById(editing.id).catch(() => null)
      : Promise.resolve(null)

    Promise.all([loadGoals, loadDetail])
      .then(([goalList, detail]) => {
        setGoals(goalList)
        if (editing && detail) {
          form.reset({
            goalId: detail.goalId,
            functionalObjective: detail.functionalObjective,
            indicators: detail.indicators,
            indicatorFormula: detail.indicatorFormula,
            resources: detail.resources,
            intendedOutcomes: detail.intendedOutcomes,
          })
        } else if (editing) {
          form.reset({ goalId: editing.goalId })
        } else {
          form.reset({
            goalId: "",
            functionalObjective: "",
            indicators: "",
            indicatorFormula: "",
            resources: "",
            intendedOutcomes: "",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [open, editing, form])

  const availableGoals = editing
    ? goals
    : goals.filter((g) => !takenGoalIds.includes(g.id))

  const handleSave = async (values: QoapFormValues) => {
    setSaving(true)
    try {
      if (editing) {
        await qoapApi.update(editing.id, {
          functionalObjective: values.functionalObjective,
          indicators: values.indicators,
          indicatorFormula: values.indicatorFormula,
          resources: values.resources,
          intendedOutcomes: values.intendedOutcomes,
        })
        toast.success("QOAP updated")
      } else {
        await qoapApi.create({
          goalId: values.goalId,
          functionalObjective: values.functionalObjective,
          indicators: values.indicators,
          indicatorFormula: values.indicatorFormula,
          resources: values.resources,
          intendedOutcomes: values.intendedOutcomes,
        })
        toast.success("QOAP created")
      }
      onSaved()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(
        getApiMessage(
          error,
          editing ? "Failed to update QOAP" : "Failed to create QOAP"
        )
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit QOAP" : "Create QOAP"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update QM-specific fields. RBAP values stay on the Goal and cannot be changed here."
              : "Extend an RBAP Goal with QM-specific fields."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="space-y-4"
            >
              {!editing && (
                <FormField
                  control={form.control}
                  name="goalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RBAP Goal *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a goal" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {availableGoals.map((g) => (
                            <SelectItem
                              key={g.id}
                              value={g.id}
                              className="truncate"
                            >
                              {g.targetResult} ({g.plan.planningYear})
                            </SelectItem>
                          ))}
                          {availableGoals.length === 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No goals without a QOAP available.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {editing && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  RBAP Goal is read-only and cannot be changed here.
                </div>
              )}

              <FormField
                control={form.control}
                name="functionalObjective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Functional Objective *</FormLabel>
                    <FormControl>
                      <Input
                        disabled={saving}
                        placeholder="e.g. Improve service delivery response time"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="indicators"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indicators *</FormLabel>
                    <FormControl>
                      <Input
                        disabled={saving}
                        placeholder="e.g. Number of information systems developed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="indicatorFormula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indicator Formula *</FormLabel>
                    <FormControl>
                      <Input
                        disabled={saving}
                        placeholder="e.g. resolved / total x 100"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resources"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resources *</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                        placeholder="List human resources, ICT resources, budget, and other requirements"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intendedOutcomes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intended Outcomes *</FormLabel>
                    <FormControl>
                      <Input
                        disabled={saving}
                        placeholder="e.g. ISO 9001 recertification"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter showCloseButton>
                <Button
                  type="submit"
                  disabled={saving}
                  className={cn("w-full")}
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Create QOAP"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
