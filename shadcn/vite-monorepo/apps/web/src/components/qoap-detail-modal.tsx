import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Loader2, ClipboardList, Plus } from "lucide-react"
import { toast } from "sonner"
import {
  qoapApi,
  qomApi,
  getApiMessage,
  type Qoap,
  type Qom,
} from "@/lib/api"
import { MONTH_LABELS } from "@/lib/schemas"

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  BIANNUAL: "Biannual",
  ANNUAL: "Annual",
}

interface Props {
  qoapId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
  onAddQom: () => void
  onEditQom: (qom: Qom) => void
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
        {children ?? "—"}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

export function QoapDetailModal({
  qoapId,
  open,
  onOpenChange,
  canManage,
  onAddQom,
  onEditQom,
}: Props) {
  const [qoap, setQoap] = useState<Qoap | null>(null)
  const [qoms, setQoms] = useState<Qom[]>([])
  const [loading, setLoading] = useState(true)
  const [qomsLoading, setQomsLoading] = useState(false)

  const loadQoap = useCallback(() => {
    if (!qoapId) return
    setLoading(true)
    qoapApi
      .getById(qoapId)
      .then((res) => setQoap(res))
      .catch((error: unknown) =>
        toast.error(getApiMessage(error, "Failed to load QOAP"))
      )
      .finally(() => setLoading(false))
  }, [qoapId])

  const loadQoms = useCallback(() => {
    if (!qoapId) return
    setQomsLoading(true)
    qomApi
      .getByQoap(qoapId, { take: 200 })
      .then((res) => setQoms(res.data))
      .catch(() => setQoms([]))
      .finally(() => setQomsLoading(false))
  }, [qoapId])

  useEffect(() => {
    if (!open || !qoapId) return
    setQoap(null)
    setQoms([])
    loadQoap()
    loadQoms()
  }, [open, qoapId, loadQoap, loadQoms])

  const frequency = qoap?.monitoringFrequency

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            QOAP Details
          </DialogTitle>
          <DialogDescription>
            {qoap?.office.name ?? "Quality Objectives and Action Plans"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !qoap ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Could not load QOAP details.
            </p>
          ) : (
            <>
              <Section title="RBAP Goal Context">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Breakthrough Goals and Strategic Objectives">
                      {qoap.goal.plan.breakthroughGoals}
                      {qoap.goal.plan.strategicObjectives
                        ? `\n${qoap.goal.plan.strategicObjectives}`
                        : ""}
                    </Field>
                  </div>
                  <Field label="Key Actions">{qoap.goal.keyActions}</Field>
                  <Field label="Key Performance Indicator">
                    {qoap.goal.keyPerformanceIndicator}
                  </Field>
                  <Field label="Target/s">{qoap.goal.target}</Field>
                  <Field label="Target Completion Date">
                    {qoap.goal.timeline}
                  </Field>
                  <Field label="Responsible Persons and Partners">
                    {qoap.goal.responsibleOfficePerson}
                  </Field>
                </div>
              </Section>

              <Section title="QM Fields">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Functional Objective">
                      {qoap.functionalObjective}
                    </Field>
                  </div>
                  <Field label="Indicators">{qoap.indicators}</Field>
                  <Field label="Indicator Formula">
                    {qoap.indicatorFormula}
                  </Field>
                  <Field label="Resources">{qoap.resources}</Field>
                  <Field label="Intended Outcomes">
                    {qoap.intendedOutcomes}
                  </Field>
                  <Field label="Frequency of Monitoring">
                    <Badge variant="secondary">
                      {FREQUENCY_LABELS[frequency?.toUpperCase() ?? ""] ??
                        frequency}
                    </Badge>
                  </Field>
                </div>
              </Section>

              <Section title="Monitoring Records (QOM)">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {qoms.length} record{qoms.length === 1 ? "" : "s"}
                  </p>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={onAddQom}>
                      <Plus className="size-4" />
                      <span className="ml-1.5">New Monitoring Record</span>
                    </Button>
                  )}
                </div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Recency Date</TableHead>
                        <TableHead>Previous Date</TableHead>
                        <TableHead>Overall Result</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qomsLoading && qoms.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            <Loader2 className="mx-auto size-5 animate-spin" />
                          </TableCell>
                        </TableRow>
                      ) : qoms.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No monitoring records yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        qoms.map((qom) => {
                          const months = Object.entries(qom.performance)
                            .filter(([, value]) => value?.trim())
                          return (
                            <TableRow key={qom.id}>
                              <TableCell className="tabular-nums">
                                {qom.monitoringNo}
                              </TableCell>
                              <TableCell>
                                {new Date(qom.recencyDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {qom.previousMonitoringDate
                                  ? new Date(
                                      qom.previousMonitoringDate
                                    ).toLocaleDateString()
                                  : "—"}
                              </TableCell>
                              <TableCell className="max-w-40 truncate">
                                {qom.overallDataResult ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-52">
                                {months.length === 0 ? (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {months.map(([key, value]) => (
                                      <span
                                        key={key}
                                        className="rounded bg-muted px-1.5 py-0.5 text-[10px]"
                                        title={value}
                                      >
                                        {MONTH_LABELS[key as keyof typeof MONTH_LABELS] ??
                                          key}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => onEditQom(qom)}
                                  >
                                    Edit
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
