import { useEffect, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  plansApi,
  goalsApi,
  objectivesApi,
  getApiMessage,
  type Plan,
  type PlanRemark,
  type Goal,
  type Objective,
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
import { Badge } from "@workspace/ui/components/badge"
import {
  Loader2,
  FileText,
  Target,
  ListChecks,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  FileDown,
} from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useAuth } from "@/contexts/useAuth"
import { canWriteOffice } from "@/lib/roles"
import { toast } from "sonner"
import { planFormSchema, type PlanFormValues } from "@/lib/schemas"
import { FormFieldRow } from "@/components/form-field-row"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { GoalDetailModal } from "@/components/goal-detail-modal"
import { ObjectiveDetailModal } from "@/components/objective-detail-modal"
import { Textarea } from "@/components/textarea"

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
}

interface Props {
  planId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function PlanDetailModal({
  planId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const { user } = useAuth()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<PlanRemark[]>([])
  const [returnFeedback, setReturnFeedback] = useState("")

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      planningYear: new Date().getFullYear(),
      campus: "",
      programProjectActivityKRA: "",
      strategicAlignment: "",
      breakthroughGoals: "",
      strategicObjectives: "",
      monitoringFrequency: "Monthly",
      reportingOffice: "",
      datePrepared: "",
    },
  })

  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsTotal, setGoalsTotal] = useState(0)
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [objectivesMap, setObjectivesMap] = useState<
    Record<string, Objective[]>
  >({})
  const [loadingObjectives, setLoadingObjectives] = useState<Set<string>>(
    new Set()
  )

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    description: string
    confirmLabel: string
    variant?: "destructive" | "default"
    onConfirm: () => void
  } | null>(null)

  const [childGoalId, setChildGoalId] = useState<string | undefined>(undefined)
  const [childGoalModal, setChildGoalModal] = useState(false)
  const [childObjectiveId, setChildObjectiveId] = useState<string | undefined>(
    undefined
  )
  const [childObjectiveModal, setChildObjectiveModal] = useState(false)

  const isCreate = !planId

  useEffect(() => {
    if (!open) return
    // Schedule state updates in a microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      setSaving(null)
      if (isCreate) {
        setLoading(false)
        setPlan(null)
        setRemarks([])
        setReturnFeedback("")
        form.reset({
          planningYear: new Date().getFullYear(),
          campus: "",
          programProjectActivityKRA: "",
          strategicAlignment: "",
          breakthroughGoals: "",
          strategicObjectives: "",
          monitoringFrequency: "Monthly",
          reportingOffice: "",
          datePrepared: "",
        })
        setGoals([])
        setExpandedGoals(new Set())
        setObjectivesMap({})
        return
      }
      Promise.all([
        plansApi.getById(planId!),
        goalsApi.getByPlan(planId!, { take: 50, skip: 0 }),
        plansApi.getRemarks(planId!, { take: 50, skip: 0 }),
      ])
        .then(([p, g, r]) => {
          setPlan(p)
          setGoals(g.data)
          setGoalsTotal(g.meta.total)
          setRemarks(r.data)
          setReturnFeedback("")
          form.reset({
            planningYear: p.planningYear,
            campus: p.campus,
            programProjectActivityKRA: p.programProjectActivityKRA,
            strategicAlignment: p.strategicAlignment,
            breakthroughGoals: p.breakthroughGoals,
            strategicObjectives: p.strategicObjectives,
            monitoringFrequency: p.monitoringFrequency,
            reportingOffice: p.reportingOffice ?? "",
            datePrepared: p.datePrepared?.split("T")[0] ?? "",
          })
        })
        .catch(() => toast.error("Failed to load plan"))
        .finally(() => setLoading(false))
    })
  }, [planId, open, isCreate, form])

  const toggleGoalExpand = useCallback(
    (goalId: string) => {
      setExpandedGoals((prev) => {
        const next = new Set(prev)
        if (next.has(goalId)) {
          next.delete(goalId)
        } else {
          next.add(goalId)
        }
        return next
      })
      if (!objectivesMap[goalId]) {
        setLoadingObjectives((l) => new Set(l).add(goalId))
        const pid = plan?.id
        if (pid) {
          objectivesApi
            .getByGoal(pid, goalId, { take: 50, skip: 0 })
            .then((r) => {
              setObjectivesMap((m) => ({ ...m, [goalId]: r.data }))
            })
            .catch(() => toast.error("Failed to load objectives"))
            .finally(() => {
              setLoadingObjectives((l) => {
                const n = new Set(l)
                n.delete(goalId)
                return n
              })
            })
        }
      }
    },
    [plan?.id, objectivesMap]
  )

  const isEditable =
    isCreate || plan?.status === "DRAFT" || plan?.status === "SUBMITTED"

  const updatePlan = async (values: PlanFormValues) => {
    if (!plan) return
    setSaving("update")
    try {
      await plansApi.update(plan.id, {
        planningYear: values.planningYear,
        campus: values.campus,
        programProjectActivityKRA: values.programProjectActivityKRA,
        strategicAlignment: values.strategicAlignment,
        breakthroughGoals: values.breakthroughGoals,
        strategicObjectives: values.strategicObjectives,
        monitoringFrequency: values.monitoringFrequency,
        reportingOffice: values.reportingOffice || undefined,
        datePrepared: values.datePrepared || undefined,
      })
      onUpdated()
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update plan"))
    } finally {
      setSaving(null)
    }
  }

  const submitPlan = async () => {
    if (!plan) return
    setSaving("submit")
    try {
      await plansApi.submit(plan.id)
      onUpdated()
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to submit plan"))
    } finally {
      setSaving(null)
    }
  }

  const approvePlan = async () => {
    if (!plan) return
    setSaving("approve")
    try {
      await plansApi.approve(plan.id)
      onUpdated()
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to approve plan"))
    } finally {
      setSaving(null)
    }
  }

  const returnPlan = async () => {
    if (!plan) return
    const content = returnFeedback.trim()
    if (!content) {
      toast.error("Add feedback before returning the plan.")
      return
    }
    setSaving("return")
    try {
      const updatedPlan = await plansApi.returnPlan(plan.id, content)
      setPlan(updatedPlan)
      setReturnFeedback("")
      const updatedRemarks = await plansApi.getRemarks(plan.id, {
        take: 50,
        skip: 0,
      })
      setRemarks(updatedRemarks.data)
      onUpdated()
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to return plan"))
    } finally {
      setSaving(null)
    }
  }

  const createPlan = async (values: PlanFormValues) => {
    setSaving("create")
    try {
      await plansApi.create({
        planningYear: values.planningYear,
        campus: values.campus,
        programProjectActivityKRA: values.programProjectActivityKRA,
        strategicAlignment: values.strategicAlignment,
        breakthroughGoals: values.breakthroughGoals,
        strategicObjectives: values.strategicObjectives,
        monitoringFrequency: values.monitoringFrequency,
        reportingOffice: values.reportingOffice || undefined,
        datePrepared: values.datePrepared || undefined,
      })
      onUpdated()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to create plan"))
    } finally {
      setSaving(null)
    }
  }

  const deletePlan = async () => {
    if (!plan) return
    setSaving("delete")
    try {
      await plansApi.delete(plan.id)
      onUpdated()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to delete plan"))
    } finally {
      setSaving(null)
    }
  }

  const openGoalModal = (goalId: string) => {
    setChildGoalId(goalId)
    setChildGoalModal(true)
  }

  const openNewGoalModal = () => {
    setChildGoalId(undefined)
    setChildGoalModal(true)
  }

  const openObjectiveModal = (objectiveId: string) => {
    setChildObjectiveId(objectiveId)
    setChildObjectiveModal(true)
  }

  const openNewObjectiveModal = () => {
    setChildObjectiveId(undefined)
    setChildObjectiveModal(true)
  }

  const refreshGoals = useCallback(() => {
    const pid = plan?.id
    if (!pid) return
    goalsApi
      .getByPlan(pid, { take: 50, skip: 0 })
      .then((r) => r.data)
      .then(setGoals)
      .catch(() => toast.error("Failed to refresh goals"))
  }, [plan?.id])

  const refreshExpandedObjectives = useCallback(() => {
    const pid = plan?.id
    if (!pid) return
    expandedGoals.forEach((goalId) => {
      if (objectivesMap[goalId]) {
        objectivesApi
          .getByGoal(pid, goalId, { take: 50, skip: 0 })
          .then((r) => {
            setObjectivesMap((m) => ({ ...m, [goalId]: r.data }))
          })
          .catch(() => toast.error("Failed to refresh objectives"))
      }
    })
  }, [plan?.id, expandedGoals, objectivesMap])

  const busy = saving !== null
  const completedGoalCount = goals.filter(
    (goal) => goal.status === "COMPLETED"
  ).length
  const inProgressGoalCount = goals.filter(
    (goal) => goal.status === "IN_PROGRESS"
  ).length
  const notStartedGoalCount = goals.filter(
    (goal) => goal.status === "NOT_STARTED"
  ).length

  return (
    <Form {...form}>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isCreate ? "Create New Plan" : "Plan Details"}</span>
            {!isCreate && plan && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={async () => {
                  try {
                    const blob = await plansApi.exportPdf(plan.id)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `plan-${plan.id}.pdf`
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch (error: unknown) {
                    toast.error(getApiMessage(error, "Failed to export PDF"))
                  }
                }}
              >
                <FileDown className="size-4" />
                Export PDF
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Fill in the details to create a new RBAP plan."
              : "View and manage this RBAP plan."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isCreate ? (
          <form onSubmit={form.handleSubmit(createPlan)}>
            <div className="space-y-3">
              <FormFieldRow<PlanFormValues>
                name="planningYear"
                label="Planning Year"
                type="number"
                disabled={busy}
              />
              <FormFieldRow<PlanFormValues>
                name="campus"
                label="Campus"
                disabled={busy}
              />
              <FormFieldRow<PlanFormValues>
                name="programProjectActivityKRA"
                label="Program / Project / Activity / KRA"
                disabled={busy}
              />
              <FormFieldRow<PlanFormValues>
                name="strategicAlignment"
                label="Strategic Alignment"
                disabled={busy}
              />
              <FormFieldRow<PlanFormValues>
                name="breakthroughGoals"
                label="Breakthrough Goals"
                disabled={busy}
              />
              <FormFieldRow<PlanFormValues>
                name="strategicObjectives"
                label="Strategic Objectives"
                disabled={busy}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="monitoringFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monitoring Frequency</FormLabel>
<Select
                 value={field.value as string ?? ""}
                 onValueChange={field.onChange}
                        disabled={busy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Quarterly">Quarterly</SelectItem>
                          <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                          <SelectItem value="Annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormFieldRow<PlanFormValues>
                  name="datePrepared"
                  label="Date Prepared"
                  type="date"
                  optional
                  disabled={busy}
                />
              </div>
              <FormFieldRow<PlanFormValues>
                name="reportingOffice"
                label="Reporting Office"
                optional
                disabled={busy}
              />
              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {saving === "create" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {saving === "create" ? "Creating..." : "Create Plan"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        ) : plan ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <FileText className="size-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{plan.office.name}</p>
                  <span className="text-muted-foreground">·</span>
                  <p className="text-sm text-muted-foreground">
                    Year {plan.planningYear}
                  </p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {plan.id}
                </p>
              </div>
              <Badge variant={STATUS_COLORS[plan.status]}>
                {plan.status === "SUBMITTED"
                  ? "Submitted"
                  : plan.status.charAt(0) + plan.status.slice(1).toLowerCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Campus
                </p>
                <p className="text-sm">{plan.campus}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Created By
                </p>
                <p className="text-sm">{plan.createdBy.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Monitoring Frequency
                </p>
                <p className="text-sm">{plan.monitoringFrequency}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Goals
                </p>
                <p className="text-sm">{plan._count.goals}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Parent Office
                </p>
                <p className="text-sm">—</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Reporting Office
                </p>
                <p className="text-sm">{plan.reportingOffice ?? "—"}</p>
              </div>
              {plan.datePrepared && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Date Prepared
                  </p>
                  <p className="text-sm">
                    {new Date(plan.datePrepared).toLocaleDateString()}
                  </p>
                </div>
              )}
              {plan.submittedAt && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Submitted
                  </p>
                  <p className="text-sm">
                    {new Date(plan.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {plan.approvedAt && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Approved
                  </p>
                  <p className="text-sm">
                    {new Date(plan.approvedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Goals ({goals.length})</p>
                {isEditable &&
                  canWriteOffice(
                    user?.role,
                    user?.office?.id,
                    plan?.office?.id
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openNewGoalModal}
                      disabled={busy}
                    >
                      <Plus className="size-3.5" />
                      <span className="ml-1">Add Goal</span>
                    </Button>
                  )}
              </div>
              {goals.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Completion progress</span>
                    <span>
                      {completedGoalCount}/
                      {goals.length}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full w-full">
                      <div
                        className="h-full bg-amber-500 transition-all duration-500"
                        style={{
                          width: `${(notStartedGoalCount / goals.length) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{
                          width: `${(inProgressGoalCount / goals.length) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{
                          width: `${(completedGoalCount / goals.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-amber-500" />{" "}
                      {notStartedGoalCount}{" "}
                      Not started
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-blue-500" />{" "}
                      {inProgressGoalCount}{" "}
                      In progress
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500" />{" "}
                      {completedGoalCount}{" "}
                      Completed
                    </span>
                  </div>
                </div>
              )}
              {goals.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">
                  No goals yet.
                </p>
              ) : (
                <>
                  {goalsTotal > 50 && (
                    <p className="py-1 text-xs text-muted-foreground">
                      Showing first 50 of {goalsTotal} goals
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {goals.map((goal) => {
                    const isExpanded = expandedGoals.has(goal.id)
                    const objectives = objectivesMap[goal.id]
                    const isLoadingObjs = loadingObjectives.has(goal.id)
                    const goalStatusColor: Record<
                      string,
                      "outline" | "secondary" | "default"
                    > = {
                      NOT_STARTED: "outline",
                      IN_PROGRESS: "secondary",
                      COMPLETED: "default",
                    }
                    return (
                      <div key={goal.id} className="rounded-lg border bg-card">
                        <div
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 select-none hover:bg-muted/50"
                          onClick={() => toggleGoalExpand(goal.id)}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </Button>
                          <Target className="size-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {goal.resultLevel}
                          </span>
                          <span className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:block">
                            {goal.keyPerformanceIndicator}
                          </span>
                          <Badge
                            variant={goalStatusColor[goal.status]}
                            className="shrink-0 px-1.5 py-0 text-[10px]"
                          >
                            {goal.status === "NOT_STARTED"
                              ? "NS"
                              : goal.status === "IN_PROGRESS"
                                ? "IP"
                                : "C"}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openGoalModal(goal.id)
                                }}
                              >
                                <Eye className="size-3.5" /> View / Edit
                              </DropdownMenuItem>
                              {isEditable &&
                                canWriteOffice(
                                  user?.role,
                                  user?.office?.id,
                                  plan?.office?.id
                                ) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setConfirmDialog({
                                          title: "Delete Goal",
                                          description: `Are you sure you want to delete "${goal.resultLevel}"? This will also delete all associated objectives.`,
                                          confirmLabel: "Delete",
                                          onConfirm: async () => {
                                            try {
                                              await goalsApi.delete(
                                                goal.planId,
                                                goal.id
                                              )
                                              refreshGoals()
                                            } catch (error: unknown) {
                                              toast.error(
                                                getApiMessage(error, "Failed to delete goal")
                                              )
                                            }
                                          },
                                        })
                                      }}
                                    >
                                      <Trash2 className="size-3.5" /> Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {isExpanded && (
                          <div className="space-y-1.5 border-t px-3 py-2">
                            {isLoadingObjs ? (
                              <div className="flex items-center gap-2 py-1">
                                <Loader2 className="size-3 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Loading objectives...
                                </span>
                              </div>
                            ) : objectives && objectives.length > 0 ? (
                              objectives.map((obj) => {
                                const objStatusColor: Record<
                                  string,
                                  "outline" | "secondary" | "default"
                                > = {
                                  NOT_STARTED: "outline",
                                  IN_PROGRESS: "secondary",
                                  COMPLETED: "default",
                                }
                                return (
                                  <div
                                    key={obj.id}
                                    className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                                  >
                                    <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate text-xs">
                                      {obj.resultLevel}
                                    </span>
                                    <span className="hidden max-w-[140px] truncate text-[10px] text-muted-foreground sm:block">
                                      {obj.keyPerformanceIndicator}
                                    </span>
                                    <Badge
                                      variant={objStatusColor[obj.status]}
                                      className="shrink-0 px-1.5 py-0 text-[10px]"
                                    >
                                      {obj.status === "NOT_STARTED"
                                        ? "NS"
                                        : obj.status === "IN_PROGRESS"
                                          ? "IP"
                                          : "C"}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        asChild
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-5 shrink-0"
                                        >
                                          <MoreHorizontal className="size-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-36"
                                      >
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openObjectiveModal(obj.id)
                                          }}
                                        >
                                          <Eye className="size-3.5" /> View /
                                          Edit
                                        </DropdownMenuItem>
                                        {isEditable &&
                                          canWriteOffice(
                                            user?.role,
                                            user?.office?.id,
                                            plan?.office?.id
                                          ) && (
                                            <>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                variant="destructive"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setConfirmDialog({
                                                    title: "Delete Objective",
                                                    description: `Are you sure you want to delete "${obj.resultLevel}"? This action cannot be undone.`,
                                                    confirmLabel: "Delete",
                                                    onConfirm: async () => {
                                                      try {
                                                        await objectivesApi.delete(
                                                          obj.goal.planId,
                                                          obj.goalId,
                                                          obj.id
                                                        )
                                                        const pid = plan?.id
                                                        if (pid) {
                                                          objectivesApi
                                                            .getByGoal(
                                                              pid,
                                                              obj.goalId,
                                                              {
                                                                take: 50,
                                                                skip: 0,
                                                              }
                                                            )
                                                            .then((r) =>
                                                              setObjectivesMap(
                                                                (m) => ({
                                                                  ...m,
                                                                  [obj.goalId]:
                                                                    r.data,
                                                                })
                                                              )
                                                            )
                                                            .catch(() =>
                                                              toast.error(
                                                                "Failed to refresh objectives"
                                                              )
                                                            )
                                                        }
                                                      } catch (error: unknown) {
                                                        toast.error(
                                                          getApiMessage(error, "Failed to delete objective")
                                                        )
                                                      }
                                                    },
                                                  })
                                                }}
                                              >
                                                <Trash2 className="size-3.5" />{" "}
                                                Delete
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )
                              })
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No objectives yet.
                              </p>
                            )}
                            {isEditable &&
                              canWriteOffice(
                                user?.role,
                                user?.office?.id,
                                plan?.office?.id
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={openNewObjectiveModal}
                                  disabled={busy}
                                >
                                  <Plus className="size-3" /> Add Objective
                                </Button>
                              )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

            {isEditable &&
              canWriteOffice(
                user?.role,
                user?.office?.id,
                plan?.office?.id
              ) && (
                <form onSubmit={form.handleSubmit(updatePlan)}>
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Edit Plan</p>

                    <FormFieldRow<PlanFormValues>
                      name="planningYear"
                      label="Planning Year"
                      type="number"
                      disabled={busy}
                    />
                    <FormFieldRow<PlanFormValues>
                      name="campus"
                      label="Campus"
                      disabled={busy}
                    />
                    <FormFieldRow<PlanFormValues>
                      name="programProjectActivityKRA"
                      label="Program / Project / Activity / KRA"
                      disabled={busy}
                    />
                    <FormFieldRow<PlanFormValues>
                      name="strategicAlignment"
                      label="Strategic Alignment"
                      disabled={busy}
                    />
                    <FormFieldRow<PlanFormValues>
                      name="breakthroughGoals"
                      label="Breakthrough Goals"
                      disabled={busy}
                    />
                    <FormFieldRow<PlanFormValues>
                      name="strategicObjectives"
                      label="Strategic Objectives"
                      disabled={busy}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="monitoringFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monitoring Frequency</FormLabel>
                            <Select
                              value={field.value as string ?? ""}
                              onValueChange={field.onChange}
                              disabled={busy}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Quarterly">Quarterly</SelectItem>
                                <SelectItem value="Semi-Annual">
                                  Semi-Annual
                                </SelectItem>
                                <SelectItem value="Annually">Annually</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormFieldRow<PlanFormValues>
                        name="datePrepared"
                        label="Date Prepared"
                        type="date"
                        optional
                        disabled={busy}
                      />
                    </div>

                    <FormFieldRow<PlanFormValues>
                      name="reportingOffice"
                      label="Reporting Office"
                      optional
                      disabled={busy}
                    />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={busy}
                    >
                      {saving === "update" && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      {saving === "update" ? "Saving..." : "Save Changes"}
                    </Button>
                    {plan.status === "DRAFT" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setConfirmDialog({
                              title: "Submit Plan",
                              description:
                                "Are you sure you want to submit this plan for approval? You can still edit it after submission until it is approved.",
                              confirmLabel: "Submit",
                              variant: "default",
                              onConfirm: submitPlan,
                            })
                          }
                          disabled={busy}
                        >
                          {saving === "submit" && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          {saving === "submit" ? "Submitting..." : "Submit"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() =>
                            setConfirmDialog({
                              title: "Delete Plan",
                              description:
                                "Are you sure you want to delete this plan? This will also delete all associated goals and objectives. This action cannot be undone.",
                              confirmLabel: "Delete",
                              onConfirm: deletePlan,
                            })
                          }
                          disabled={busy}
                        >
                          {saving === "delete" && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              )}

            {plan.status === "SUBMITTED" &&
              plan.createdBy.supervisor?.id === user?.id && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <p className="text-sm font-medium">Review decision</p>
                    <p className="text-xs text-muted-foreground">
                      Approval locks the plan. Returning it sends it back as an editable draft.
                    </p>
                  </div>
                  <Textarea
                    placeholder="Explain what needs to be revised before resubmission..."
                    value={returnFeedback}
                    onChange={(event) => setReturnFeedback(event.target.value)}
                    maxLength={2000}
                    disabled={busy}
                  />
                  <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      setConfirmDialog({
                        title: "Approve Plan",
                        description:
                          "Are you sure you want to approve this plan? Once approved, it cannot be modified.",
                        confirmLabel: "Approve",
                        variant: "default",
                        onConfirm: approvePlan,
                      })
                    }
                    disabled={busy}
                  >
                    {saving === "approve" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {saving === "approve" ? "Approving..." : "Approve Plan"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      setConfirmDialog({
                        title: "Return Plan for Revision",
                        description:
                          "Return this plan to the owner with the feedback above? The owner will be able to edit and resubmit it.",
                        confirmLabel: "Return for Revision",
                        variant: "default",
                        onConfirm: returnPlan,
                      })
                    }
                    disabled={busy || !returnFeedback.trim()}
                  >
                    {saving === "return" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {saving === "return"
                      ? "Returning..."
                      : "Return for Revision"}
                  </Button>
                  </div>
                </div>
              )}

            {remarks.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm font-semibold">Plan feedback</p>
                  <p className="text-xs text-muted-foreground">
                    Reviewer comments and plan history
                  </p>
                </div>
                <div className="space-y-2">
                  {remarks.map((remark) => (
                    <div
                      key={remark.id}
                      className="rounded-md border bg-muted/30 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium">
                          {remark.author.name} · {remark.author.role}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(remark.createdAt).toLocaleString("en-PH")}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {remark.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <FileText className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Plan not found</p>
          </div>
        )}

        {!isCreate && <DialogFooter showCloseButton />}
      </DialogContent>

      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        variant={confirmDialog?.variant}
        onConfirm={() => {
          confirmDialog?.onConfirm()
          setConfirmDialog(null)
        }}
      />

      {!isCreate && (
        <>
          <GoalDetailModal
            goalId={childGoalId}
            open={childGoalModal}
            onOpenChange={(open) => {
              setChildGoalModal(open)
              if (!open) setChildGoalId(undefined)
            }}
            onUpdated={() => {
              refreshGoals()
              onUpdated()
            }}
          />
          <ObjectiveDetailModal
            objectiveId={childObjectiveId}
            open={childObjectiveModal}
            onOpenChange={(open) => {
              setChildObjectiveModal(open)
              if (!open) setChildObjectiveId(undefined)
            }}
            onUpdated={() => {
              refreshGoals()
              refreshExpandedObjectives()
              onUpdated()
            }}
          />
        </>
      )}
    </Dialog>
    </Form>
  )
}
