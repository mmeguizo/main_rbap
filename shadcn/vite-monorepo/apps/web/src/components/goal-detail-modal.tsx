import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { goalsApi, plansApi, remarksApi, getApiMessage, type Goal, type Plan, type Remark } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@/components/label"
import { Textarea } from "@/components/textarea"
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
import { Loader2, Target, Trash2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { goalFormSchema, type GoalFormValues } from "@/lib/schemas"
import { FormFieldRow, FormTextareaRow } from "@/components/form-field-row"
import { formatBulletedLines } from "@/lib/text-format"

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

interface Props {
  goalId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  initialRemarkId?: string
}

export function GoalDetailModal({
  goalId,
  open,
  onOpenChange,
  onUpdated,
  initialRemarkId,
}: Props) {
  const { user } = useAuth()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [remarks, setRemarks] = useState<Remark[]>([])
  const [loadingRemarks, setLoadingRemarks] = useState(false)
  const [newRemark, setNewRemark] = useState("")
  const [postingRemark, setPostingRemark] = useState(false)

  const isCreate = !goalId

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
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
      setRemarks([])
      setNewRemark("")
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
      setSelectedPlanId("")
    })
    if (isCreate) {
      Promise.resolve().then(() => {
        setLoading(false)
        setGoal(null)
      })
      plansApi
        .getAll({ take: 50, skip: 0 })
        .then((res) => {
          setPlans(res.data)
        })
        .catch(() => toast.error("Failed to load plans"))
      return
    }
    Promise.all([
      goalsApi.getById(goalId!),
      plansApi.getAll({ take: 50, skip: 0 }).then((r) => r.data),
    ])
      .then(([g, p]) => {
        setGoal(g)
        setPlans(p)
        setSelectedPlanId(g.planId)
        form.reset({
          resultLevel: g.resultLevel,
          targetResult: g.targetResult,
          keyActions: g.keyActions,
          keyRisk: g.keyRisk,
          mitigationMeasures: g.mitigationMeasures,
          kpi: g.keyPerformanceIndicator,
          target: g.target,
          responsiblePerson: g.responsibleOfficePerson,
          timeline: g.timeline,
          fundSource: g.fundSource ?? "",
          meansOfVerification: g.meansOfVerification,
          status: g.status,
        })
      })
      .catch(() => toast.error("Failed to load goal"))
      .finally(() => {
        setLoading(false)
        if (!isCreate && goalId) {
          setLoadingRemarks(true)
          remarksApi.getByGoal(goalId, { take: 50, skip: 0 })
            .then((r) => {
              setRemarks(r.data)
              if (initialRemarkId) {
                setTimeout(() => {
                  document.getElementById(`remark-${initialRemarkId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 100)
              }
            })
            .catch(() => toast.error("Failed to load remarks"))
            .finally(() => setLoadingRemarks(false))
        }
      })
  }, [goalId, open, form, isCreate])

  const canEdit =
    isCreate ||
    ((goal?.plan?.status === "DRAFT" ||
      goal?.plan?.status === "SUBMITTED") &&
      canWriteOffice(user?.role, user?.office?.id, goal?.office?.id))

  const handleCreate = async (values: GoalFormValues) => {
    if (!selectedPlanId) {
      toast.error("Please select a plan")
      return
    }
    setSaving("create")
    try {
      await goalsApi.create(selectedPlanId, {
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
      toast.error("Failed to create goal")
    } finally {
      setSaving(null)
    }
  }

  const handleUpdate = async (values: GoalFormValues) => {
    if (!goal) return
    setSaving("update")
    try {
      await goalsApi.update(goal.planId, goal.id, {
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
        status: values.status as Goal["status"],
      })
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to update goal")
    } finally {
      setSaving(null)
    }
  }

  const deleteGoal = async () => {
    if (!goal) return
    setSaving("delete")
    try {
      await goalsApi.delete(goal.planId, goal.id)
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Failed to delete goal")
    } finally {
      setSaving(null)
    }
  }

  const busy = saving !== null

  const formFields = (
    <div className="space-y-3">
      {isCreate && (
        <div className="space-y-2">
          <Label>Plan *</Label>
          <Select
            value={selectedPlanId}
            onValueChange={setSelectedPlanId}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a plan..." />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.office.name} — Year {p.planningYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <FormFieldRow
        name="resultLevel"
        label="Result Level"
        placeholder="e.g. Outcome A"
        disabled={busy}
      />
      <FormFieldRow name="targetResult" label="Target Result" disabled={busy} />
      <FormTextareaRow
        name="keyActions"
        label="Key Actions"
        placeholder="Enter one action per line"
        disabled={busy}
      />
      <FormTextareaRow
        name="keyRisk"
        label="Key Risk"
        placeholder="Enter one risk per line"
        disabled={busy}
      />
      <FormTextareaRow
        name="mitigationMeasures"
        label="Mitigation Measures"
        placeholder="Enter one mitigation measure per line"
        disabled={busy}
      />
      <FormFieldRow
        name="kpi"
        label="Key Performance Indicator (KPI)"
        disabled={busy}
      />
      <FormFieldRow name="target" label="Target" disabled={busy} />
      <FormFieldRow
        name="responsiblePerson"
        label="Responsible Office / Person"
        disabled={busy}
      />
      <FormFieldRow
        name="timeline"
        label="Timeline"
        placeholder="e.g. 4th qtr 2026"
        disabled={busy}
      />
      <FormFieldRow
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
                <DialogTitle>Create New Goal</DialogTitle>
                <DialogDescription>
                  Fill in the details to create a new goal under a plan.
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
                <Button type="submit" disabled={busy || !selectedPlanId}>
                  {saving === "create" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {saving === "create" ? "Creating..." : "Create Goal"}
                </Button>
              </DialogFooter>
            </form>
          ) : goal ? (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle>Goal Details</DialogTitle>
                <DialogDescription>
                  View and manage this goal.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Target className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{goal.office.name}</p>
                    <span className="text-muted-foreground">·</span>
                    <p className="text-sm text-muted-foreground">
                      Year {goal.plan.planningYear}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {goal.id}
                  </p>
                </div>
                <Badge variant={STATUS_COLORS[goal.status]}>
                  {goal.status === "NOT_STARTED"
                    ? "Not Started"
                    : goal.status === "IN_PROGRESS"
                      ? "In Progress"
                      : "Completed"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Plan
                  </p>
                  <p className="text-sm">
                    {goal.office.name} — Year {goal.plan.planningYear}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Plan Status
                  </p>
                  <Badge
                    variant={
                      goal.plan.status === "DRAFT"
                        ? "outline"
                        : goal.plan.status === "SUBMITTED"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {goal.plan.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Result Level
                  </p>
                  <p className="text-sm">{goal.resultLevel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    KPI
                  </p>
                  <p className="text-sm">{goal.keyPerformanceIndicator}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Target Result
                  </p>
                  <p className="text-sm">{goal.targetResult}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Key Actions
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{formatBulletedLines(goal.keyActions)}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Key Risk
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{formatBulletedLines(goal.keyRisk)}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Mitigation Measures
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{formatBulletedLines(goal.mitigationMeasures)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Target
                  </p>
                  <p className="text-sm">{goal.target}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Responsible
                  </p>
                  <p className="text-sm">{goal.responsibleOfficePerson}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Timeline
                  </p>
                  <p className="text-sm">{goal.timeline}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Objectives
                  </p>
                  <p className="text-sm">{goal._count.objectives}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Fund Source
                  </p>
                  <p className="text-sm">{goal.fundSource ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Created By
                  </p>
                  <p className="text-sm">{goal.createdBy.name}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Means of Verification
                  </p>
                  <p className="text-sm">{goal.meansOfVerification}</p>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    <MessageSquare className="mr-1.5 inline size-4" />
                    Remarks ({remarks.length})
                  </p>
                </div>

                {loadingRemarks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : remarks.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">No remarks yet.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {remarks.map((remark) => (
                      <div key={remark.id} id={`remark-${remark.id}`} className="rounded-lg border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{remark.author.name}</span>
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              {remark.author.role === "OFFICE_HEAD"
                                ? "Office Head"
                                : remark.author.role === "DIRECTORS"
                                  ? "Director"
                                  : remark.author.role === "VICE_PRESIDENTS"
                                    ? "VP"
                                    : remark.author.role === "PRESIDENTS"
                                      ? "President"
                                      : "Admin"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatRelativeTime(remark.createdAt)}
                            </span>
                          </div>
                          {(remark.author.id === user?.id || user?.role === "ADMIN") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-5 shrink-0"
                              onClick={async () => {
                                try {
                                  await remarksApi.delete(remark.goalId, remark.id)
                                  setRemarks((prev) => prev.filter((r) => r.id !== remark.id))
                                } catch { toast.error("Failed to delete remark") }
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{remark.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a remark..."
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value.slice(0, 2000))}
                    disabled={postingRemark}
                    className="min-h-[60px] text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60">{newRemark.length}/2000</span>
                    <Button
                      size="sm"
                      disabled={postingRemark || !newRemark.trim()}
                      onClick={async () => {
                        if (!goalId) return
                        setPostingRemark(true)
                        try {
                          const remark = await remarksApi.create(goalId, { content: newRemark.trim() })
                          setRemarks((prev) => [remark, ...prev])
                          setNewRemark("")
                        } catch (error: unknown) {
                          toast.error(getApiMessage(error, "Failed to post remark"))
                        } finally {
                          setPostingRemark(false)
                        }
                      }}
                    >
                      {postingRemark && <Loader2 className="mr-1 size-3 animate-spin" />}
                      Post
                    </Button>
                  </div>
                </div>
              </div>

              {canEdit && (
                <form onSubmit={form.handleSubmit(handleUpdate)}>
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Edit Goal</p>
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
              <Target className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Goal not found</p>
            </div>
          )}
        </DialogContent>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete Goal"
          description={`Are you sure you want to delete "${goal?.resultLevel}"? This will also delete all associated objectives. This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteGoal}
        />
      </Dialog>
    </Form>
  )
}
