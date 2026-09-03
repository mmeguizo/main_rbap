import { Fragment, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronRight, Edit3, FileDown, Loader2, Save } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@/components/input"
import { Textarea } from "@/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { plansApi, getApiMessage, type Plan, type PlanDocument, type PlanDocumentRow, type PlanRemark } from "@/lib/api"
import { PlanDetailModal } from "@/components/plan-detail-modal"
import { toast } from "sonner"
import { useAuth } from "@/contexts/useAuth"
import { canWriteOffice, hasMinRole, ROLE_HIERARCHY } from "@/lib/roles"
import { formatBulletedLines } from "@/lib/text-format"

const columns: Array<[keyof PlanDocumentRow, string]> = [
  ["resultLevel", "Result level"],
  ["targetResult", "Target result"],
  ["keyActions", "Key actions"],
  ["keyRisk", "Key risk"],
  ["mitigationMeasures", "Mitigation / control"],
  ["keyPerformanceIndicator", "KPI"],
  ["target", "Target"],
  ["responsibleOfficePerson", "Responsible office / person"],
  ["timeline", "Timeline"],
  ["fundSource", "Fund source"],
  ["meansOfVerification", "MOV"],
]

function value(row: PlanDocumentRow, key: keyof PlanDocumentRow) {
  const raw = row[key]
  if (raw === null || raw === undefined) return "—"
  return String(raw)
}

function matrixValue(row: PlanDocumentRow, key: keyof PlanDocumentRow) {
  const result = value(row, key)
  if (
    result === "—" ||
    !["keyActions", "keyRisk", "mitigationMeasures"].includes(key)
  ) {
    return result
  }
  return formatBulletedLines(result)
}

export default function PlanDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [document, setDocument] = useState<PlanDocument | null>(null)
  const [remarks, setRemarks] = useState<PlanRemark[]>([])
  const [planOptions, setPlanOptions] = useState<Plan[]>([])
  const [planSearch, setPlanSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [monitoringOpen, setMonitoringOpen] = useState(false)
  const [rowEditorOpen, setRowEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [monitoring, setMonitoring] = useState({
    frequency: "Quarterly",
    reportingOffice: "",
    preparedBy: "",
    reviewedBy: "",
    approvedBy: "",
  })

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      plansApi
        .getAll({ take: 20, skip: 0, search: planSearch || undefined })
        .then((response) => {
          if (!cancelled) setPlanOptions(response.data)
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            toast.error(getApiMessage(error, "Failed to load plan options"))
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [planSearch])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      plansApi.getDocument(id),
      plansApi.getRemarks(id, { take: 50, skip: 0 }),
    ]).then(([data, remarkResponse]) => {
      if (cancelled) return
      setDocument(data)
      setRemarks(remarkResponse.data)
      const m = data.monitoring
      setMonitoring({
        frequency: m?.frequency ?? data.monitoringFrequency ?? "Quarterly",
        reportingOffice: m?.reportingOffice ?? data.reportingOffice ?? "",
        preparedBy: m?.preparedBy ?? "",
        reviewedBy: m?.reviewedBy ?? "",
        approvedBy: m?.approvedBy ?? "",
      })
    }).catch((error: unknown) => {
      if (!cancelled) toast.error(getApiMessage(error, "Failed to load RBAP document"))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  const isReadOnly =
    document?.status === "APPROVED" ||
    !canWriteOffice(user?.role, user?.office?.id, document?.office.id)
  const backPath = hasMinRole(user?.role, ROLE_HIERARCHY.DIRECTORS)
    ? "/plans"
    : "/my-plans"
  const goalCount = document?.goals.length ?? 0
  const outputCount = useMemo(
    () => document?.goals.reduce((total, goal) => total + (goal.objectives?.length ?? 0), 0) ?? 0,
    [document]
  )

  const saveMonitoring = async () => {
    if (!id) return
    setSaving(true)
    try {
      const updated = await plansApi.updateMonitoring(id, monitoring)
      setDocument(updated)
      setMonitoringOpen(false)
      toast.success("Monitoring details saved")
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to save monitoring details"))
    } finally {
      setSaving(false)
    }

  }

  const refreshDocument = () => {
    if (!id) return
    Promise.all([
      plansApi.getDocument(id),
      plansApi.getRemarks(id, { take: 50, skip: 0 }),
    ]).then(([data, remarkResponse]) => {
      setDocument(data)
      setRemarks(remarkResponse.data)
    }).catch((error: unknown) => {
      toast.error(getApiMessage(error, "Failed to refresh document"))
    })
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>
  }
  if (!document) {
    return <div className="space-y-4"><Button variant="outline" onClick={() => navigate(backPath)}><ArrowLeft className="mr-2 size-4" />Back to plans</Button><p>Plan not found.</p></div>
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Input
          className="min-w-[220px] flex-1"
          placeholder="Search plans by office, campus, or KRA..."
          value={planSearch}
          onChange={(event) => setPlanSearch(event.target.value)}
        />
        <select
          className="h-10 min-w-[260px] rounded-md border bg-background px-3 text-sm"
          value={id ?? ""}
          onChange={(event) => {
            if (event.target.value) navigate(`/plans/${event.target.value}/view`)
          }}
          aria-label="Select an RBAP plan"
        >
          {!planOptions.some((plan) => plan.id === document.id) && (
            <option value={document.id}>
              {document.office.name} · {document.planningYear}
            </option>
          )}
          {planOptions.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.office.name} · {plan.planningYear} · {plan.status}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}><ArrowLeft className="size-4" /></Button>
          <div><p className="text-sm text-muted-foreground">RBAP document workspace</p><h1 className="text-2xl font-semibold">{document.office.name} · {document.planningYear}</h1></div>
          <Badge variant={document.status === "APPROVED" ? "default" : document.status === "SUBMITTED" ? "secondary" : "outline"}>{document.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            try {
              const blob = await plansApi.exportDocument(document.id)
              const url = URL.createObjectURL(blob)
              const anchor = window.document.createElement("a")
              anchor.href = url
              anchor.download = `rbap-plan-${document.id}.xlsx`
              anchor.click()
              URL.revokeObjectURL(url)
            } catch (error: unknown) {
              toast.error(getApiMessage(error, "Failed to export document"))
            }
          }}><FileDown className="mr-2 size-4" />Export workbook</Button>
          {!isReadOnly && <Button variant="outline" onClick={() => setRowEditorOpen(true)}><Edit3 className="mr-2 size-4" />Edit rows</Button>}
          {!isReadOnly && <Button variant="outline" onClick={() => setMonitoringOpen(true)}><Edit3 className="mr-2 size-4" />Edit monitoring</Button>}
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">A. Basic information</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Campus", document.campus],
            ["Office / unit", document.office.name],
            ["Program / project / activity / KRA", document.programProjectActivityKRA],
            ["Strategic alignment", document.strategicAlignment],
            ["Breakthrough goals", document.breakthroughGoals],
            ["Strategic objectives", document.strategicObjectives],
            ["Planning year", document.planningYear],
            ["Date prepared", document.datePrepared ? new Date(document.datePrepared).toLocaleDateString() : "—"],
          ].map(([label, content]) => <div key={String(label)}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="whitespace-pre-wrap break-words">{content}</p></div>)}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-semibold">B. Results matrix</h2><p className="text-sm text-muted-foreground">{goalCount} outcomes · {outputCount} outputs</p></div></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1900px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>{columns.map(([, label], index) => <th key={label} className={`border-b p-3 text-left font-medium ${index === 0 ? "sticky left-0 z-20 min-w-[180px] bg-muted" : "min-w-[150px]"}`}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {document.goals.map((goal) => {
                const children = goal.objectives ?? []
                const open = expanded.has(goal.id)
                return <Fragment key={goal.id}>
                  <tr className="bg-primary/5 align-top">
                    {columns.map(([key], index) => <td key={key} className={`border-b p-3 align-top ${index === 0 ? "sticky left-0 z-10 bg-primary/5 font-semibold" : ""}`}><div className="flex gap-2">{index === 0 && children.length > 0 && <button aria-label={open ? "Collapse outputs" : "Expand outputs"} onClick={() => setExpanded((current) => { const next = new Set(current); if (open) next.delete(goal.id); else next.add(goal.id); return next })}>{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button>}<span className="whitespace-pre-wrap break-words">{index === 0 ? (goal.code ?? matrixValue(goal, key)) : matrixValue(goal, key)}</span></div></td>)}
                  </tr>
                  {open && children.map((output) => <tr key={output.id} className="align-top">
                    {columns.map(([key], index) => <td key={key} className={`border-b p-3 align-top ${index === 0 ? "sticky left-0 z-10 bg-card pl-10" : ""}`}><span className="whitespace-pre-wrap break-words">{index === 0 ? (output.code ?? matrixValue(output, key)) : matrixValue(output, key)}</span></td>)}
                  </tr>)}
                </Fragment>
              })}
            </tbody>
          </table>
        </div>
      </section>

      {remarks.length > 0 && <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Plan feedback</h2>
        <p className="mt-1 text-sm text-muted-foreground">Reviewer comments and resubmission guidance</p>
        <div className="mt-4 space-y-3">
          {remarks.map((remark) => <div key={remark.id} className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium">{remark.author.name} · {remark.author.role}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(remark.createdAt).toLocaleString("en-PH")}</p>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{remark.content}</p>
          </div>)}
        </div>
      </section>}

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">C. Monitoring</h2><p className="text-sm text-muted-foreground">RBAP monitoring metadata and signatories (separate from QOAP/QOM)</p></div>{!isReadOnly && <Button variant="outline" onClick={() => setMonitoringOpen(true)}><Edit3 className="mr-2 size-4" />Edit</Button>}</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(monitoring).map(([key, content]) => <div key={key}><p className="text-xs font-medium capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p>{content || "—"}</p></div>)}
        </div>
      </section>

      <Dialog open={monitoringOpen} onOpenChange={setMonitoringOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit RBAP monitoring</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {(["frequency", "reportingOffice", "preparedBy", "reviewedBy", "approvedBy"] as const).map((key) => key === "reportingOffice" ? <Textarea key={key} placeholder="Reporting office" value={monitoring[key]} onChange={(e) => setMonitoring((current) => ({ ...current, [key]: e.target.value }))} /> : <Input key={key} placeholder={key.replace(/([A-Z])/g, " $1")} value={monitoring[key]} onChange={(e) => setMonitoring((current) => ({ ...current, [key]: e.target.value }))} />)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMonitoringOpen(false)}>Cancel</Button><Button onClick={saveMonitoring} disabled={saving}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <PlanDetailModal
        planId={document.id}
        open={rowEditorOpen}
        onOpenChange={setRowEditorOpen}
        onUpdated={refreshDocument}
      />
    </div>
  )
}
