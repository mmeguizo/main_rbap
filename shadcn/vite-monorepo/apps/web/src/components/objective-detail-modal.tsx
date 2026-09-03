import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { objectivesApi, goalsApi, type Objective, type Goal } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@/components/textarea"
import { Label } from "@/components/label"
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
import { Badge } from "@workspace/ui/components/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useAuth } from "@/contexts/useAuth"
import { canWriteOffice } from "@/lib/roles"
import { Loader2, ListChecks } from "lucide-react"
import { toast } from "sonner"
import { objectiveFormSchema, type ObjectiveFormValues } from "@/lib/schemas"
import { FormFieldRow, FormTextareaRow } from "@/components/form-field-row"
import { formatBulletedLines } from "@/lib/text-format"

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
}

interface Props {
  objectiveId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function ObjectiveDetailModal({
  objectiveId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const { user } = useAuth()
  const [objective, setObjective] = useState<Objective | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState("")
  const [progressStatus, setProgressStatus] = useState<Goal["status"]>("NOT_STARTED")

  const isCreate = !objectiveId

  const form = useForm<ObjectiveFormValues>({
    resolver: zodResolver(objectiveFormSchema),
    defaultValues: {
      resultLevel: "",
      targetResult: "",
      keyActions: "",
      keyRisk: "",
      mitigationMeasures: "",
      kpi: "",
      target: "",
      responsiblePerson: "",
      timeline: "",
      fundSource: "",
      meansOfVerification: "",
      status: "NOT_STARTED",
    },
  })

  useEffect(() => {
    if (!open) return
    // Schedule state updates in a microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      setSaving(null)
      form.reset({
        resultLevel: "",
        targetResult: "",
        keyActions: "",
        keyRisk: "",
        mitigationMeasures: "",
        kpi: "",
        target: "",
        responsiblePerson: "",
        timeline: "",
        fundSource: "",
        meansOfVerification: "",
        status: "NOT_STARTED",
      })
      setSelectedGoalId("")
    })
    if (isCreate) {
      Promise.resolve().then(() => {
        setLoading(false)
        setObjective(null)
        setGoals([])
      })
      goalsApi
        .browse({ take: 50, skip: 0 })
        .then((res) => {
          setGoals(res.data)
        })
        .catch(() => toast.error("Failed to load goals"))
      return
    }
    Promise.all([
      objectivesApi.getById(objectiveId!),
      goalsApi.browse({ take: 50, skip: 0 }).then((r) => r.data),
    ])
      .then(([o, g]) => {
        setObjective(o)
        setGoals(g)
        setSelectedGoalId(o.goalId)
        setProgressStatus(o.status)
        form.reset({
          resultLevel: o.resultLevel,
          targetResult: o.targetResult,
          keyActions: o.keyActions,
          keyRisk: o.keyRisk,
          mitigationMeasures: o.mitigationMeasures,
          kpi: o.keyPerformanceIndicator,
          target: o.target,
          responsiblePerson: o.responsibleOfficePerson,
          timeline: o.timeline,
          fundSource: o.fundSource ?? "",
          meansOfVerification: o.meansOfVerification,
          status: o.status,
        })
      })
      .catch(() => toast.error("Failed to load objective"))
      .finally(() => setLoading(false))
  }, [objectiveId, open, form, isCreate])

  const canEdit =
    isCreate ||
    ((objective?.goal?.plan?.status === "DRAFT" ||
      objective?.goal?.plan?.status === "SUBMITTED") &&
      canWriteOffice(user?.role, user?.office?.id, objective?.goal?.office?.id))
  const selectedGoal = goals.find((g) => g.id === selectedGoalId)
  const canUpdateProgress =
    !isCreate &&
    objective?.goal.plan.status === "APPROVED" &&
    (user?.role === "ADMIN" ||
      (user?.role === "OFFICE_HEAD" &&
        user.office?.id === objective.goal.office.id))

  const updateProgress = async () => {
    if (!objective) return
    setSaving("progress")
    try {
      const updated = await objectivesApi.updateProgress(
        objective.goal.planId,
        objective.goalId,
        objective.id,
        progressStatus
      )
      setObjective(updated)
      onUpdated()
      toast.success("Progress updated")
    } catch {
      toast.error("Failed to update progress")
    } finally {
      setSaving(null)
    }
  }

  const handleCreate = async (values: ObjectiveFormValues) => {
    if (!selectedGoal) return
    setSaving("create")
    try {
      await objectivesApi.create(selectedGoal.planId, selectedGoalId, {
        resultLevel: values.resultLevel,
        targetResult: values.targetResult,
        keyActions: values.keyActions,
        keyRisk: values.keyRisk,
        mitigationMeasures: values.mitigationMeasures,
        keyPerformanceIndicator: values.kpi,
        target: values.target,
        responsibleOfficePerson: values.responsiblePerson,
        timeline: values.timeline,
        fundSource: values.fundSource || undefined,
        meansOfVerification: values.meansOfVerification,
      })
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to create objective")
    } finally {
      setSaving(null)
    }
  }

  const handleUpdate = async (values: ObjectiveFormValues) => {
    if (!objective) return
    setSaving("update")
    try {
      await objectivesApi.update(
        objective.goal.planId,
        objective.goalId,
        objective.id,
        {
          resultLevel: values.resultLevel,
          targetResult: values.targetResult,
          keyActions: values.keyActions,
          keyRisk: values.keyRisk,
          mitigationMeasures: values.mitigationMeasures,
          keyPerformanceIndicator: values.kpi,
          target: values.target,
          responsibleOfficePerson: values.responsiblePerson,
          timeline: values.timeline,
          fundSource: values.fundSource || undefined,
          meansOfVerification: values.meansOfVerification,
          status: values.status as Objective["status"],
        }
      )
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to update objective")
    } finally {
      setSaving(null)
    }
  }

  const deleteObjective = async () => {
    if (!objective) return
    setSaving("delete")
    try {
      await objectivesApi.delete(
        objective.goal.planId,
        objective.goalId,
        objective.id
      )
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to delete objective")
    } finally {
      setSaving(null)
    }
  }

  const busy = saving !== null

  const formFields = (
    <div className="space-y-3">
      {isCreate && (
        <div className="space-y-2">
          <Label>Goal *</Label>
          <Select
            value={selectedGoalId}
            onValueChange={setSelectedGoalId}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a goal..." />
            </SelectTrigger>
            <SelectContent>
              {goals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.office.name} — {g.resultLevel} (Year {g.plan.planningYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <FormFieldRow<ObjectiveFormValues>
        name="resultLevel"
        label="Result Level"
        placeholder="e.g. Output 1.1"
        disabled={busy}
      />
      <FormFieldRow<ObjectiveFormValues>
        name="targetResult"
        label="Target Result"
        disabled={busy}
      />
      <FormTextareaRow<ObjectiveFormValues>
        name="keyActions"
        label="Key Actions"
        placeholder="Enter one action per line"
        disabled={busy}
      />
      <FormTextareaRow<ObjectiveFormValues>
        name="keyRisk"
        label="Key Risk"
        placeholder="Enter one risk per line"
        disabled={busy}
      />
      <FormTextareaRow<ObjectiveFormValues>
        name="mitigationMeasures"
        label="Mitigation Measures"
        placeholder="Enter one mitigation measure per line"
        disabled={busy}
      />
      <FormFieldRow<ObjectiveFormValues>
        name="kpi"
        label="Key Performance Indicator (KPI)"
        disabled={busy}
      />
      <FormFieldRow<ObjectiveFormValues>
        name="target"
        label="Target"
        disabled={busy}
      />
      <FormFieldRow<ObjectiveFormValues>
        name="responsiblePerson"
        label="Responsible Office / Person"
        disabled={busy}
      />
      <FormFieldRow<ObjectiveFormValues>
        name="timeline"
        label="Timeline"
        placeholder="e.g. 4th qtr 2026"
        disabled={busy}
      />
      <FormFieldRow<ObjectiveFormValues>
        name="fundSource"
        label="Fund Source"
        optional
        disabled={busy}
      />
      <FormField
        control={form.control}
        name="meansOfVerification"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Means of Verification *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe how progress will be verified"
                disabled={busy}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!isCreate && (
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value as string ?? ""}
                onValueChange={field.onChange}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )

  return (
    <Form {...form}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : isCreate ? (
            <form onSubmit={form.handleSubmit(handleCreate)}>
              <DialogHeader>
                <DialogTitle>Create New Objective</DialogTitle>
                <DialogDescription>
                  Fill in the details to create a new objective under a goal.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">{formFields}</div>
              <DialogFooter className="mt-4 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !selectedGoalId}>
                  {saving === "create" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {saving === "create" ? "Creating..." : "Create Objective"}
                </Button>
              </DialogFooter>
            </form>
          ) : objective ? (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle>Objective Details</DialogTitle>
                <DialogDescription>
                  View and manage this objective.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <ListChecks className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{objective.goal.office.name}</p>
                    <span className="text-muted-foreground">·</span>
                    <p className="text-sm text-muted-foreground">
                      Year {objective.goal.plan.planningYear}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {objective.id}
                  </p>
                </div>
                <Badge variant={STATUS_COLORS[objective.status]}>
                  {objective.status === "NOT_STARTED"
                    ? "Not Started"
                    : objective.status === "IN_PROGRESS"
                      ? "In Progress"
                      : "Completed"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Parent Goal
                  </p>
                  <p className="text-sm">{objective.goal.resultLevel}</p>
                </div>

                {canUpdateProgress && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div>
                      <p className="text-sm font-medium">Update progress</p>
                      <p className="text-xs text-muted-foreground">
                        Approved plan details are locked; only execution status can be changed.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={progressStatus}
                        onValueChange={(value) =>
                          setProgressStatus(value as Goal["status"])
                        }
                        disabled={busy}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={updateProgress}
                        disabled={busy || progressStatus === objective.status}
                      >
                        {saving === "progress" && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Save Progress
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Plan Status
                  </p>
                  <Badge
                    variant={
                      objective.goal.plan.status === "DRAFT"
                        ? "outline"
                        : objective.goal.plan.status === "SUBMITTED"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {objective.goal.plan.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Result Level
                  </p>
                  <p className="text-sm">{objective.resultLevel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    KPI
                  </p>
                  <p className="text-sm">{objective.keyPerformanceIndicator}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Target Result
                  </p>
                  <p className="text-sm">{objective.targetResult}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Key Actions
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{formatBulletedLines(objective.keyActions)}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Key Risk
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{formatBulletedLines(objective.keyRisk)}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Mitigation Measures
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{formatBulletedLines(objective.mitigationMeasures)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Target
                  </p>
                  <p className="text-sm">{objective.target}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Responsible
                  </p>
                  <p className="text-sm">{objective.responsibleOfficePerson}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Timeline
                  </p>
                  <p className="text-sm">{objective.timeline}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Created By
                  </p>
                  <p className="text-sm">{objective.createdBy.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Fund Source
                  </p>
                  <p className="text-sm">{objective.fundSource ?? "—"}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Means of Verification
                  </p>
                  <p className="text-sm">{objective.meansOfVerification}</p>
                </div>
              </div>

              {canEdit && (
                <form onSubmit={form.handleSubmit(handleUpdate)}>
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Edit Objective</p>
                    {formFields}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button type="submit" className="flex-1" disabled={busy}>
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
                      {saving === "delete" && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Delete
                    </Button>
                  </div>
                </form>
              )}

              <DialogFooter showCloseButton />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10">
              <ListChecks className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Objective not found
              </p>
            </div>
          )}
        </DialogContent>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete Objective"
          description={`Are you sure you want to delete "${objective?.resultLevel}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteObjective}
        />
      </Dialog>
    </Form>
  )
}
