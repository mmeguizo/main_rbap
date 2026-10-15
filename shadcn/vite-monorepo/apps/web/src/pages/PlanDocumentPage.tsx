import { useEffect, useState, useTransition } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  FileDown,
  Printer,
  Plus,
  Send,
  CheckCircle,
  RotateCcw,
  Loader2,
  Trash2,
  Save,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Textarea } from "@/components/textarea"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  plansApi,
  goalsApi,
  objectivesApi,
  officesApi,
  getApiMessage,
  type Plan,
  type PlanDocument,
  type PlanDocumentRow,
  type PlanRemark,
} from "@/lib/api"
import { useAuth } from "@/contexts/useAuth"
import { canWriteOffice, hasMinRole, ROLE_HIERARCHY } from "@/lib/roles"
import { toast } from "sonner"

import "@/components/spreadsheet/spreadsheet.css"
import { BasicInfoTable, type BasicInfoData } from "@/components/spreadsheet/basic-info-table"
import { ResultsMatrix } from "@/components/spreadsheet/results-matrix"
import { MonitoringTable, type MonitoringData } from "@/components/spreadsheet/monitoring-table"
import { SignatoriesSection, type SignatoriesData } from "@/components/spreadsheet/signatories-section"

export default function PlanDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [, startTransition] = useTransition()

  const isNewPlan = !id || id === "new"

  // Document state for existing plans
  const [document, setDocument] = useState<PlanDocument | null>(null)
  const [remarks, setRemarks] = useState<PlanRemark[]>([])
  const [planOptions, setPlanOptions] = useState<Plan[]>([])
  const [loading, setLoading] = useState(!isNewPlan)

  // Selected row state in spreadsheet
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [selectedRowGoalId, setSelectedRowGoalId] = useState<string | null>(null)
  const [selectedRowType, setSelectedRowType] = useState<"goal" | "objective" | null>(null)

  // State for new plan creation - starts completely clean for user input
  const [newPlanData, setNewPlanData] = useState<BasicInfoData>({
    campus: "University-wide",
    officeName: user?.office?.name || "",
    programProjectActivityKRA: "",
    strategicAlignment: "",
    breakthroughGoals: "",
    strategicObjectives: "",
    planningYear: new Date().getFullYear(),
    datePrepared: new Date().toISOString().split("T")[0],
  })

  const [newPlanMonitoring, setNewPlanMonitoring] = useState<MonitoringData>({
    frequency: "",
    reportingOffice: "",
  })

  const [newPlanSignatories, setNewPlanSignatories] = useState<SignatoriesData>({
    preparedBy: "",
    reviewedBy: "",
    approvedBy: "",
  })

  // Starts completely empty - zero rows initially until user adds a Parent Row
  const [newPlanGoals, setNewPlanGoals] = useState<PlanDocumentRow[]>([])

  const [creating, setCreating] = useState(false)

  // Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    description: string
    confirmLabel?: string
    variant?: "destructive" | "default"
    onConfirm: () => void
  } | null>(null)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnFeedback, setReturnFeedback] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [availableOffices, setAvailableOffices] = useState<Array<{ id: string; name: string }>>([])

  // Fetch plan switcher options
  useEffect(() => {
    let cancelled = false
    plansApi
      .getAll({ take: 30, skip: 0 })
      .then((res) => {
        if (!cancelled) setPlanOptions(res.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch accessible / all offices for editable Office/Unit cell
  useEffect(() => {
    let cancelled = false
    officesApi
      .getAccessible()
      .then((res) => {
        if (!cancelled && res && res.length > 0) {
          setAvailableOffices(res)
        } else if (!cancelled) {
          officesApi
            .getAll(200, 0)
            .then((all) => {
              if (!cancelled) setAvailableOffices(all.data)
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        officesApi
          .getAll(200, 0)
          .then((all) => {
            if (!cancelled) setAvailableOffices(all.data)
          })
          .catch(() => {})
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Update office name when user loads
  useEffect(() => {
    if (user?.office?.name && isNewPlan) {
      setNewPlanData((prev) => ({
        ...prev,
        officeName: prev.officeName || user.office?.name || "",
      }))
    }
  }, [user, isNewPlan])

  // Fetch current plan document
  const loadPlanDocument = (planId: string) => {
    setLoading(true)
    Promise.all([
      plansApi.getDocument(planId),
      plansApi.getRemarks(planId, { take: 50, skip: 0 }),
    ])
      .then(([docData, remarksData]) => {
        setDocument(docData)
        setRemarks(remarksData.data)
      })
      .catch((error: unknown) => {
        toast.error(getApiMessage(error, "Failed to load RBAP plan document"))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    if (id && id !== "new") {
      loadPlanDocument(id)
    }
  }, [id])

  const backPath = hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS) ? "/plans" : "/my-plans"

  const isReadOnly =
    !isNewPlan &&
    (document?.status === "APPROVED" ||
      !canWriteOffice(user?.role, user?.office?.id, document?.office?.id))

  // Permissions for workflow actions
  const isOwner =
    !isNewPlan &&
    document &&
    canWriteOffice(user?.role, user?.office?.id, document.office.id)
  const canSubmit = isOwner && document?.status === "DRAFT"
  const canApprove =
    !isNewPlan &&
    document?.status === "SUBMITTED" &&
    hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS)

  // Handle Create New Plan & Save All Rows
  const handleCreatePlan = async () => {
    setCreating(true)
    try {
      const year = Number(newPlanData.planningYear) || new Date().getFullYear()
      const campus = newPlanData.campus?.trim() || "University-wide"
      const kra =
        newPlanData.programProjectActivityKRA?.trim() || "General Administration and Support"
      const alignment =
        newPlanData.strategicAlignment?.trim() || "CHMSU Strategic Plan 2025-2029 / ISSP"
      const bGoals =
        newPlanData.breakthroughGoals?.trim() || "Digital and Technology Transformation"
      const sObjs =
        newPlanData.strategicObjectives?.trim() ||
        "To integrate smart, safe, and sustainable technologies in university operations."

      const targetOfficeName = newPlanData.officeName?.trim() || user?.office?.name || ""
      const matchedOffice = availableOffices.find(
        (o) => o.name.trim().toLowerCase() === targetOfficeName.toLowerCase()
      )

      const created = await plansApi.create({
        planningYear: year,
        campus,
        programProjectActivityKRA: kra,
        strategicAlignment: alignment,
        breakthroughGoals: bGoals,
        strategicObjectives: sObjs,
        datePrepared: newPlanData.datePrepared || undefined,
        monitoringFrequency: newPlanMonitoring.frequency || undefined,
        reportingOffice: newPlanMonitoring.reportingOffice || undefined,
        officeId: matchedOffice?.id || undefined,
        officeName: targetOfficeName || undefined,
      })

      // Create initial outcomes and outputs
      for (let gIdx = 0; gIdx < newPlanGoals.length; gIdx++) {
        const goal = newPlanGoals[gIdx]
        const createdGoal = await goalsApi.create(created.id, {
          resultLevel: goal.resultLevel || `Outcome ${String.fromCharCode(65 + (gIdx % 26))}`,
          targetResult: goal.targetResult || "",
          keyActions: goal.keyActions || "",
          keyRisk: goal.keyRisk || "",
          mitigationMeasures: goal.mitigationMeasures || "",
          keyPerformanceIndicator: goal.keyPerformanceIndicator || "",
          target: goal.target || "",
          responsibleOfficePerson: goal.responsibleOfficePerson || "",
          timeline: goal.timeline || "",
          fundSource: goal.fundSource || "",
          budgetRequirements: Number(goal.budgetRequirements) || 0,
          budgetAllocation: Number(goal.budgetAllocation) || 0,
          budgetDeficit:
            (Number(goal.budgetRequirements) || 0) - (Number(goal.budgetAllocation) || 0),
          meansOfVerification: goal.meansOfVerification || "",
          displayOrder: gIdx,
        })

        if (goal.objectives && goal.objectives.length > 0) {
          for (let oIdx = 0; oIdx < goal.objectives.length; oIdx++) {
            const obj = goal.objectives[oIdx]
            await objectivesApi.create(created.id, createdGoal.id, {
              resultLevel:
                obj.resultLevel ||
                `Output ${String.fromCharCode(65 + (gIdx % 26))}.${oIdx + 1}`,
              targetResult: obj.targetResult || "",
              keyActions: obj.keyActions || "",
              keyRisk: obj.keyRisk || "",
              mitigationMeasures: obj.mitigationMeasures || "",
              keyPerformanceIndicator: obj.keyPerformanceIndicator || "",
              target: obj.target || "",
              responsibleOfficePerson: obj.responsibleOfficePerson || "",
              timeline: obj.timeline || "",
              fundSource: obj.fundSource || "",
              budgetRequirements: Number(obj.budgetRequirements) || 0,
              budgetAllocation: Number(obj.budgetAllocation) || 0,
              budgetDeficit:
                (Number(obj.budgetRequirements) || 0) - (Number(obj.budgetAllocation) || 0),
              meansOfVerification: obj.meansOfVerification || "",
              displayOrder: oIdx,
            })
          }
        }
      }

      // Update monitoring signatories
      if (
        newPlanMonitoring.frequency ||
        newPlanMonitoring.reportingOffice ||
        newPlanSignatories.preparedBy ||
        newPlanSignatories.reviewedBy ||
        newPlanSignatories.approvedBy
      ) {
        await plansApi.updateMonitoring(created.id, {
          frequency: newPlanMonitoring.frequency || undefined,
          reportingOffice: newPlanMonitoring.reportingOffice || undefined,
          preparedBy: newPlanSignatories.preparedBy || undefined,
          reviewedBy: newPlanSignatories.reviewedBy || undefined,
          approvedBy: newPlanSignatories.approvedBy || undefined,
        })
      }

      toast.success("RBAP Plan created and saved successfully!")
      startTransition(() => {
        navigate(`/plans/${created.id}/edit`, { replace: true })
      })
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to create RBAP plan"))
    } finally {
      setCreating(false)
    }
  }

  // Handle Section A Updates
  const handleUpdateBasicInfo = async (
    field: keyof BasicInfoData,
    value: string | number
  ) => {
    if (isNewPlan) {
      setNewPlanData((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (!document) return

    try {
      await plansApi.update(document.id, {
        [field]: field === "planningYear" ? Number(value) : value,
      })
      setDocument((prev) =>
        prev
          ? {
              ...prev,
              [field]: field === "planningYear" ? Number(value) : value,
            }
          : null
      )
      toast.success("Saved basic info", { duration: 1500 })
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update basic info"))
      throw error
    }
  }

  // Handle Section C Updates
  const handleUpdateMonitoring = async (
    field: keyof MonitoringData,
    value: string
  ) => {
    if (isNewPlan) {
      setNewPlanMonitoring((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (!document) return

    try {
      const updated = await plansApi.updateMonitoring(document.id, {
        [field]: value,
      })
      setDocument(updated)
      toast.success("Saved monitoring info", { duration: 1500 })
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update monitoring"))
      throw error
    }
  }

  // Handle Signatories Updates
  const handleUpdateSignatories = async (
    field: keyof SignatoriesData,
    value: string
  ) => {
    if (isNewPlan) {
      setNewPlanSignatories((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (!document) return

    try {
      const updated = await plansApi.updateMonitoring(document.id, {
        [field]: value,
      })
      setDocument(updated)
      toast.success("Saved signatory details", { duration: 1500 })
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update signatories"))
      throw error
    }
  }

  // Handle Goal (Outcome) Updates
  const handleUpdateGoal = async (
    goalId: string,
    field: string,
    value: string | number
  ) => {
    if (isNewPlan) {
      setNewPlanGoals((prev) =>
        prev.map((g) => {
          if (g.id !== goalId) return g
          const updates: Record<string, unknown> = { [field]: value }
          if (field === "budgetRequirements" || field === "budgetAllocation") {
            const req =
              field === "budgetRequirements" ? Number(value) : Number(g.budgetRequirements)
            const alloc =
              field === "budgetAllocation" ? Number(value) : Number(g.budgetAllocation)
            updates.budgetDeficit = req - alloc
          }
          return { ...g, ...updates }
        })
      )
      return
    }

    if (!document) return
    const goal = document.goals.find((g) => g.id === goalId)
    if (!goal) return

    const updates: Record<string, unknown> = { [field]: value }
    if (field === "budgetRequirements" || field === "budgetAllocation") {
      const req = field === "budgetRequirements" ? Number(value) : Number(goal.budgetRequirements)
      const alloc = field === "budgetAllocation" ? Number(value) : Number(goal.budgetAllocation)
      updates.budgetDeficit = req - alloc
    }

    try {
      await goalsApi.update(document.id, goalId, updates)
      setDocument((prev) => {
        if (!prev) return null
        return {
          ...prev,
          goals: prev.goals.map((g) =>
            g.id === goalId ? { ...g, ...updates } : g
          ),
        }
      })
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update outcome"))
      throw error
    }
  }

  // Handle Objective (Output) Updates
  const handleUpdateObjective = async (
    goalId: string,
    objectiveId: string,
    field: string,
    value: string | number
  ) => {
    if (isNewPlan) {
      setNewPlanGoals((prev) =>
        prev.map((g) => {
          if (g.id !== goalId) return g
          return {
            ...g,
            objectives: (g.objectives || []).map((o) => {
              if (o.id !== objectiveId) return o
              const updates: Record<string, unknown> = { [field]: value }
              if (field === "budgetRequirements" || field === "budgetAllocation") {
                const req =
                  field === "budgetRequirements" ? Number(value) : Number(o.budgetRequirements)
                const alloc =
                  field === "budgetAllocation" ? Number(value) : Number(o.budgetAllocation)
                updates.budgetDeficit = req - alloc
              }
              return { ...o, ...updates }
            }),
          }
        })
      )
      return
    }

    if (!document) return
    const goal = document.goals.find((g) => g.id === goalId)
    const obj = goal?.objectives?.find((o) => o.id === objectiveId)
    if (!obj) return

    const updates: Record<string, unknown> = { [field]: value }
    if (field === "budgetRequirements" || field === "budgetAllocation") {
      const req = field === "budgetRequirements" ? Number(value) : Number(obj.budgetRequirements)
      const alloc = field === "budgetAllocation" ? Number(value) : Number(obj.budgetAllocation)
      updates.budgetDeficit = req - alloc
    }

    try {
      await objectivesApi.update(document.id, goalId, objectiveId, updates)
      setDocument((prev) => {
        if (!prev) return null
        return {
          ...prev,
          goals: prev.goals.map((g) => {
            if (g.id !== goalId) return g
            return {
              ...g,
              objectives: (g.objectives || []).map((o) =>
                o.id === objectiveId ? { ...o, ...updates } : o
              ),
            }
          }),
        }
      })
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to update output"))
      throw error
    }
  }

  // Add Outcome (Goal / Parent) Row
  const handleAddOutcome = async () => {
    const currentGoals = isNewPlan ? newPlanGoals : document?.goals || []
    const currentCount = currentGoals.length
    const letter = String.fromCharCode(65 + (currentCount % 26))
    const code = `Outcome ${letter}`

    if (isNewPlan) {
      const newGoalRowId = `temp-goal-${Date.now()}`
      setNewPlanGoals((prev) => [
        ...prev,
        {
          id: newGoalRowId,
          code,
          displayOrder: currentCount,
          resultLevel: code,
          targetResult: "",
          keyActions: "",
          keyRisk: "",
          mitigationMeasures: "",
          keyPerformanceIndicator: "",
          target: "",
          responsibleOfficePerson: "",
          timeline: "",
          fundSource: "",
          budgetRequirements: 0,
          budgetAllocation: 0,
          budgetDeficit: 0,
          meansOfVerification: "",
          status: "NOT_STARTED",
          objectives: [],
        },
      ])
      setSelectedRowId(newGoalRowId)
      setSelectedRowGoalId(newGoalRowId)
      setSelectedRowType("goal")
      toast.success(`Added Parent Row: ${code}`)
      return
    }

    if (!document) return
    setActionLoading(true)
    try {
      const newGoal = await goalsApi.create(document.id, {
        resultLevel: code,
        targetResult: "",
        keyActions: "",
        keyRisk: "",
        mitigationMeasures: "",
        keyPerformanceIndicator: "",
        target: "",
        responsibleOfficePerson: "",
        timeline: "",
        fundSource: "",
        budgetRequirements: 0,
        budgetAllocation: 0,
        budgetDeficit: 0,
        meansOfVerification: "",
        displayOrder: currentCount,
      })

      setDocument((prev) => {
        if (!prev) return null
        return {
          ...prev,
          goals: [
            ...prev.goals,
            {
              ...newGoal,
              objectives: [],
            },
          ],
        }
      })
      setSelectedRowId(newGoal.id)
      setSelectedRowGoalId(newGoal.id)
      setSelectedRowType("goal")
      toast.success(`Added Parent Row: ${code}`)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to add outcome row"))
    } finally {
      setActionLoading(false)
    }
  }

  // Add Output (Objective / Child) Row
  const handleAddOutput = async (parentGoalId?: string) => {
    const currentGoals = isNewPlan ? newPlanGoals : document?.goals || []
    if (currentGoals.length === 0) {
      toast.error("Please add a Parent Row (Outcome) first before nesting a Child Row (Output)")
      return
    }

    const targetGoalId = parentGoalId || selectedRowGoalId || currentGoals[0]?.id
    const goal = currentGoals.find((g) => g.id === targetGoalId)
    if (!goal) {
      toast.error("Please select a Parent Row (Outcome) to nest this Child Row into")
      return
    }

    const goalIndex = currentGoals.indexOf(goal)
    const letter = String.fromCharCode(65 + (goalIndex % 26))
    const childCount = goal.objectives?.length || 0
    const code = `Output ${letter}.${childCount + 1}`

    if (isNewPlan) {
      const newChildId = `temp-obj-${Date.now()}`
      setNewPlanGoals((prev) =>
        prev.map((g) => {
          if (g.id !== targetGoalId) return g
          return {
            ...g,
            objectives: [
              ...(g.objectives || []),
              {
                id: newChildId,
                code,
                displayOrder: childCount,
                resultLevel: code,
                targetResult: "",
                keyActions: "",
                keyRisk: "",
                mitigationMeasures: "",
                keyPerformanceIndicator: "",
                target: "",
                responsibleOfficePerson: "",
                timeline: "",
                fundSource: "",
                budgetRequirements: 0,
                budgetAllocation: 0,
                budgetDeficit: 0,
                meansOfVerification: "",
                status: "NOT_STARTED",
              },
            ],
          }
        })
      )
      setSelectedRowId(newChildId)
      setSelectedRowGoalId(targetGoalId)
      setSelectedRowType("objective")
      toast.success(`Nested Child Row: ${code} under ${goal.resultLevel || `Outcome ${letter}`}`)
      return
    }

    if (!document) return
    setActionLoading(true)
    try {
      const newObj = await objectivesApi.create(document.id, targetGoalId, {
        resultLevel: code,
        targetResult: "",
        keyActions: "",
        keyRisk: "",
        mitigationMeasures: "",
        keyPerformanceIndicator: "",
        target: "",
        responsibleOfficePerson: "",
        timeline: "",
        fundSource: "",
        budgetRequirements: 0,
        budgetAllocation: 0,
        budgetDeficit: 0,
        meansOfVerification: "",
        displayOrder: childCount,
      })

      setDocument((prev) => {
        if (!prev) return null
        return {
          ...prev,
          goals: prev.goals.map((g) => {
            if (g.id !== targetGoalId) return g
            return {
              ...g,
              objectives: [...(g.objectives || []), newObj],
            }
          }),
        }
      })
      setSelectedRowId(newObj.id)
      setSelectedRowGoalId(targetGoalId)
      setSelectedRowType("objective")
      toast.success(`Nested Child Row: ${code} under ${goal.resultLevel || `Outcome ${letter}`}`)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to add output row"))
    } finally {
      setActionLoading(false)
    }
  }

  // Delete Goal
  const handleDeleteGoal = (goalId: string) => {
    const currentGoals = isNewPlan ? newPlanGoals : document?.goals || []
    const goal = currentGoals.find((g) => g.id === goalId)
    const title = goal?.resultLevel || "this outcome"

    setConfirmDialog({
      title: `Delete ${title}?`,
      description: `Are you sure you want to delete ${title}? All associated outputs will also be removed.`,
      confirmLabel: "Delete Outcome",
      variant: "destructive",
      onConfirm: async () => {
        if (isNewPlan) {
          setNewPlanGoals((prev) => prev.filter((g) => g.id !== goalId))
          if (selectedRowId === goalId) {
            setSelectedRowId(null)
            setSelectedRowGoalId(null)
            setSelectedRowType(null)
          }
          toast.success("Outcome deleted")
          return
        }

        if (!document) return
        try {
          await goalsApi.delete(document.id, goalId)
          setDocument((prev) =>
            prev ? { ...prev, goals: prev.goals.filter((g) => g.id !== goalId) } : null
          )
          if (selectedRowId === goalId) {
            setSelectedRowId(null)
            setSelectedRowGoalId(null)
            setSelectedRowType(null)
          }
          toast.success("Outcome deleted")
        } catch (error: unknown) {
          toast.error(getApiMessage(error, "Failed to delete outcome"))
        }
      },
    })
  }

  // Delete Objective
  const handleDeleteObjective = (goalId: string, objectiveId: string) => {
    const currentGoals = isNewPlan ? newPlanGoals : document?.goals || []
    const goal = currentGoals.find((g) => g.id === goalId)
    const obj = goal?.objectives?.find((o) => o.id === objectiveId)
    const title = obj?.resultLevel || "this output"

    setConfirmDialog({
      title: `Delete ${title}?`,
      description: `Are you sure you want to delete ${title}?`,
      confirmLabel: "Delete Output",
      variant: "destructive",
      onConfirm: async () => {
        if (isNewPlan) {
          setNewPlanGoals((prev) =>
            prev.map((g) => {
              if (g.id !== goalId) return g
              return {
                ...g,
                objectives: (g.objectives || []).filter((o) => o.id !== objectiveId),
              }
            })
          )
          if (selectedRowId === objectiveId) {
            setSelectedRowId(null)
            setSelectedRowGoalId(null)
            setSelectedRowType(null)
          }
          toast.success("Output deleted")
          return
        }

        if (!document) return
        try {
          await objectivesApi.delete(document.id, goalId, objectiveId)
          setDocument((prev) => {
            if (!prev) return null
            return {
              ...prev,
              goals: prev.goals.map((g) => {
                if (g.id !== goalId) return g
                return {
                  ...g,
                  objectives: (g.objectives || []).filter((o) => o.id !== objectiveId),
                }
              }),
            }
          })
          if (selectedRowId === objectiveId) {
            setSelectedRowId(null)
            setSelectedRowGoalId(null)
            setSelectedRowType(null)
          }
          toast.success("Output deleted")
        } catch (error: unknown) {
          toast.error(getApiMessage(error, "Failed to delete output"))
        }
      },
    })
  }

  // Delete currently selected row
  const handleDeleteSelectedRow = () => {
    if (!selectedRowId || !selectedRowGoalId || !selectedRowType) return
    if (selectedRowType === "goal") {
      handleDeleteGoal(selectedRowId)
    } else {
      handleDeleteObjective(selectedRowGoalId, selectedRowId)
    }
  }

  // Export Excel workbook
  const handleExportExcel = async () => {
    if (!document) return
    try {
      const blob = await plansApi.exportDocument(document.id)
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement("a")
      a.href = url
      a.download = `rbap-plan-${document.planningYear}-${document.office.name.replace(/\s+/g, "_")}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel workbook exported successfully")
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to export Excel workbook"))
    }
  }

  // Print view
  const handlePrint = () => {
    window.print()
  }

  // Submit Plan
  const handleSubmitPlan = () => {
    if (!document) return
    setConfirmDialog({
      title: "Submit Plan for Review",
      description:
        "Are you sure you want to submit this plan? Once submitted, it will be locked for review by your designated supervisor.",
      confirmLabel: "Submit Plan",
      variant: "default",
      onConfirm: async () => {
        try {
          const res = await plansApi.submit(document.id)
          setDocument((prev) => (prev ? { ...prev, status: res.status } : null))
          toast.success("Plan submitted successfully")
        } catch (error: unknown) {
          toast.error(getApiMessage(error, "Failed to submit plan"))
        }
      },
    })
  }

  // Approve Plan
  const handleApprovePlan = () => {
    if (!document) return
    setConfirmDialog({
      title: "Approve RBAP Plan",
      description: `Approve this RBAP plan for ${document.office.name} (FY ${document.planningYear})?`,
      confirmLabel: "Approve",
      variant: "default",
      onConfirm: async () => {
        try {
          const res = await plansApi.approve(document.id)
          setDocument((prev) => (prev ? { ...prev, status: res.status } : null))
          toast.success("Plan approved successfully")
        } catch (error: unknown) {
          toast.error(getApiMessage(error, "Failed to approve plan"))
        }
      },
    })
  }

  // Return Plan with Feedback
  const handleReturnPlan = async () => {
    if (!document || !returnFeedback.trim()) {
      toast.error("Please provide feedback for resubmission")
      return
    }
    setActionLoading(true)
    try {
      const res = await plansApi.returnPlan(document.id, returnFeedback.trim())
      setDocument((prev) => (prev ? { ...prev, status: res.status } : null))
      setReturnDialogOpen(false)
      setReturnFeedback("")
      const rem = await plansApi.getRemarks(document.id, { take: 50, skip: 0 })
      setRemarks(rem.data)
      toast.success("Plan returned for revision")
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to return plan"))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-green-600" />
        <p className="text-sm font-medium text-slate-600">Loading RBAP spreadsheet...</p>
      </div>
    )
  }

  if (!isNewPlan && !document) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="outline" onClick={() => navigate(backPath)}>
          <ArrowLeft className="mr-2 size-4" />
          Back to plans
        </Button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <p className="font-semibold">Plan not found or access denied.</p>
        </div>
      </div>
    )
  }

  const planningYear = isNewPlan ? newPlanData.planningYear : document?.planningYear
  const officeName = isNewPlan
    ? newPlanData.officeName || user?.office?.name || "Your Office"
    : document?.office.name
  const status = isNewPlan ? "DRAFT" : document?.status || "DRAFT"
  const activeGoals = isNewPlan ? newPlanGoals : document?.goals || []

  return (
    <div className="excel-spreadsheet-container space-y-4 pb-20">
      {/* Top sticky Excel toolbar */}
      <div className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="gap-1.5">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="h-4 w-px bg-slate-300" />

          {/* Quick Plan Switcher */}
          {!isNewPlan && (
            <select
              className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-green-600"
              value={document?.id ?? ""}
              onChange={(e) => {
                if (e.target.value) navigate(`/plans/${e.target.value}/edit`)
              }}
              aria-label="Switch plan"
            >
              {planOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.office.name} · {p.planningYear} · {p.status}
                </option>
              ))}
            </select>
          )}

          <Badge
            variant={
              status === "APPROVED"
                ? "default"
                : status === "SUBMITTED"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs font-semibold"
          >
            {status}
          </Badge>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Outcome and Add Output available in both new plan and edit mode */}
          {!isReadOnly && (
            <>
              <Button
                onClick={handleAddOutcome}
                disabled={actionLoading}
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold"
              >
                <Plus className="size-3.5" />
                <span>+ Add Parent Row (Outcome)</span>
              </Button>

              <Button
                onClick={() => handleAddOutput()}
                disabled={actionLoading || activeGoals.length === 0}
                variant="outline"
                size="sm"
                className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
                title={
                  activeGoals.length === 0
                    ? "Add an Outcome parent row first"
                    : selectedRowGoalId
                    ? "Nest child row under selected outcome"
                    : "Nest child row"
                }
              >
                <Plus className="size-3.5" />
                <span>+ Nest Child Row (Output)</span>
              </Button>

              {selectedRowId && (
                <Button
                  onClick={handleDeleteSelectedRow}
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:bg-red-50 hover:text-destructive"
                  title="Delete selected row"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Selected</span>
                </Button>
              )}
            </>
          )}

          {isNewPlan ? (
            <Button
              onClick={handleCreatePlan}
              disabled={creating}
              className="bg-green-700 hover:bg-green-800 text-white gap-1.5 font-semibold"
              size="sm"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span>Save & Create Plan</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-1 text-slate-700"
              >
                <FileDown className="size-3.5" />
                <span className="hidden sm:inline">Export Excel</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1 text-slate-700"
              >
                <Printer className="size-3.5" />
                <span className="hidden sm:inline">Print</span>
              </Button>

              {canSubmit && (
                <Button
                  onClick={handleSubmitPlan}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                >
                  <Send className="size-3.5" />
                  <span>Submit Plan</span>
                </Button>
              )}

              {canApprove && (
                <>
                  <Button
                    onClick={handleApprovePlan}
                    size="sm"
                    className="bg-green-700 hover:bg-green-800 text-white gap-1"
                  >
                    <CheckCircle className="size-3.5" />
                    <span>Approve</span>
                  </Button>
                  <Button
                    onClick={() => setReturnDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Return</span>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Sheet Container */}
      <div className="mx-auto max-w-[2400px] bg-white p-4 sm:p-6 shadow-sm border border-slate-200">
        {/* Title matching ict_sample.xlsx Row 1-2 */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            RESULTS-BASED ACTION PLAN
          </h1>
          <p className="mt-1 text-base font-bold text-slate-800">
            For FY {planningYear}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{officeName}</p>
        </div>

        {/* Section A: Basic Information */}
        <BasicInfoTable
          data={
            isNewPlan
              ? newPlanData
              : {
                  campus: document?.campus || "",
                  officeName: document?.office.name || "",
                  programProjectActivityKRA: document?.programProjectActivityKRA || "",
                  strategicAlignment: document?.strategicAlignment || "",
                  breakthroughGoals: document?.breakthroughGoals || "",
                  strategicObjectives: document?.strategicObjectives || "",
                  planningYear: document?.planningYear || new Date().getFullYear(),
                  datePrepared: document?.datePrepared
                    ? new Date(document.datePrepared).toISOString().split("T")[0]
                    : null,
                }
          }
          isReadOnly={isReadOnly}
          availableOffices={availableOffices}
          onUpdateField={handleUpdateBasicInfo}
        />

        {/* Section B: Results Matrix (Always visible like a real Excel sheet) */}
        <div className="mt-6">
          <ResultsMatrix
            goals={activeGoals}
            isReadOnly={isReadOnly}
            selectedRowId={selectedRowId}
            onSelectRow={(rowId, type, goalId) => {
              setSelectedRowId(rowId)
              setSelectedRowType(type)
              setSelectedRowGoalId(goalId)
            }}
            onUpdateGoal={handleUpdateGoal}
            onUpdateObjective={handleUpdateObjective}
            onAddOutcome={handleAddOutcome}
            onAddOutput={handleAddOutput}
            onDeleteGoal={handleDeleteGoal}
            onDeleteObjective={handleDeleteObjective}
          />
        </div>

        {/* Section C: Monitoring */}
        <div className="mt-6">
          <MonitoringTable
            data={
              isNewPlan
                ? newPlanMonitoring
                : {
                    frequency:
                      document?.monitoring?.frequency ||
                      document?.monitoringFrequency ||
                      "",
                    reportingOffice:
                      document?.monitoring?.reportingOffice ||
                      document?.reportingOffice ||
                      "",
                  }
            }
            isReadOnly={isReadOnly}
            onUpdateField={handleUpdateMonitoring}
          />
        </div>

        {/* Signatories */}
        <SignatoriesSection
          data={
            isNewPlan
              ? newPlanSignatories
              : {
                  preparedBy: document?.monitoring?.preparedBy || "",
                  reviewedBy: document?.monitoring?.reviewedBy || "",
                  approvedBy: document?.monitoring?.approvedBy || "",
                }
          }
          isReadOnly={isReadOnly}
          onUpdateField={handleUpdateSignatories}
        />

        {/* Bottom Save Action for new plan creation */}
        {isNewPlan && (
          <div className="no-print mt-8 flex items-center justify-end border-t pt-4">
            <Button
              onClick={handleCreatePlan}
              disabled={creating}
              className="bg-green-700 hover:bg-green-800 text-white gap-2 font-semibold px-6 py-2"
              size="lg"
            >
              {creating ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Save className="size-5" />
              )}
              <span>Save & Create Plan</span>
            </Button>
          </div>
        )}

        {/* Plan Feedback remarks timeline (if any) */}
        {!isNewPlan && remarks.length > 0 && (
          <div className="no-print mt-8 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-bold text-slate-800">Plan Feedback & Remarks</h2>
            <p className="text-xs text-muted-foreground">
              Supervisor reviewer feedback history
            </p>
            <div className="mt-3 space-y-2">
              {remarks.map((r) => (
                <div key={r.id} className="rounded border bg-white p-3 text-xs shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>
                      {r.author.name} · {r.author.role}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-PH")}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-800 whitespace-pre-wrap">{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        variant={confirmDialog?.variant ?? "destructive"}
        onConfirm={() => {
          confirmDialog?.onConfirm()
          setConfirmDialog(null)
        }}
      />

      {/* Return for Revision Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Plan for Revision</DialogTitle>
            <DialogDescription>
              Please enter instructions or reasons for returning this plan back to DRAFT status.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              rows={4}
              placeholder="e.g. Please adjust the budget requirements in Outcome B..."
              value={returnFeedback}
              onChange={(e) => setReturnFeedback(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnDialogOpen(false)
                setReturnFeedback("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReturnPlan}
              disabled={actionLoading || !returnFeedback.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {actionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Return Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
