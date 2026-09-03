import { useEffect, useState } from "react"
import { FileDown, Loader2, Printer, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { SearchableOfficeSelect } from "@/components/searchable-office-select"
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
import { Input } from "@/components/input"
import {
  getApiMessage,
  officesApi,
  plansApi,
  type PlanReport,
  type PlanStatus,
} from "@/lib/api"

const PAGE_SIZE = 25

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

function statusVariant(status: PlanStatus): "default" | "secondary" | "outline" {
  if (status === "APPROVED") return "default"
  if (status === "SUBMITTED") return "secondary"
  return "outline"
}

function downloadCsv(rows: PlanReport[]): void {
  const headers = [
    "Office",
    "Planning Year",
    "Plan Status",
    "Submission Rate",
    "Submission Status",
    "Total Objectives",
    "Completed Objectives",
    "Target Achievement",
    "Needs Attention",
  ]
  const values = rows.map((row) => [
    row.office.name,
    row.planningYear,
    row.status,
    formatPercent(row.submissionRate),
    row.submissionStatus,
    row.totalObjectives,
    row.completedObjectives,
    formatPercent(row.targetAchievement),
    row.needsAttention ? "Yes" : "No",
  ])
  const csv = [headers, ...values]
    .map((line) => line.map((value) => escapeCsv(value)).join(","))
    .join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "rbap-plan-report.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [rows, setRows] = useState<PlanReport[]>([])
  const [offices, setOffices] = useState<Array<{ id: string; name: string }>>([])
  const [officeId, setOfficeId] = useState("")
  const [year, setYear] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    officesApi
      .getAccessible()
      .then((result) => setOffices(result.map(({ id, name }) => ({ id, name }))))
      .catch((error: unknown) => toast.error(getApiMessage(error, "Failed to load offices")))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    plansApi
      .getReports({
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        officeId: officeId || undefined,
        planningYear: year ? Number(year) : undefined,
        status: status ? (status as PlanStatus) : undefined,
      })
      .then((result) => {
        if (cancelled) return
        setRows(result.data)
        setTotal(result.meta.total)
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(getApiMessage(error, "Failed to load report"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [officeId, page, status, year])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm text-muted-foreground">RBAP monitoring</p>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review submission progress and objective target achievement by office.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
            <FileDown className="mr-2 size-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 print:hidden">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Office</span>
            <SearchableOfficeSelect
              value={officeId || "none"}
              onValueChange={(value) => {
                setOfficeId(value === "none" ? "" : value)
                setPage(1)
              }}
              offices={offices}
              placeholder="Select office"
              searchPlaceholder="Search offices..."
              noneLabel="All offices"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Planning year</span>
            <Input
              type="number"
              min={2000}
              placeholder="All years"
              value={year}
              onChange={(event) => {
                setYear(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Plan status</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOfficeId("")
                setYear("")
                setStatus("")
                setPage(1)
              }}
            >
              <RefreshCw className="mr-2 size-4" /> Reset filters
            </Button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="hidden border-b p-5 print:block">
          <h1 className="text-xl font-semibold">RBAP Plan Monitoring Report</h1>
          <p className="text-sm text-muted-foreground">
            Generated {new Date().toLocaleDateString("en-PH")}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Office</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Objectives</TableHead>
                <TableHead>Target achievement</TableHead>
                <TableHead>Attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No report data found.
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.office.name}</TableCell>
                  <TableCell>{row.planningYear}</TableCell>
                  <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                  <TableCell>
                    <span className={row.submissionRate === 100 ? "text-emerald-600" : "text-amber-600"}>
                      {formatPercent(row.submissionRate)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.submissionStatus}</span>
                  </TableCell>
                  <TableCell>{row.completedObjectives} / {row.totalObjectives}</TableCell>
                  <TableCell>{formatPercent(row.targetAchievement)}</TableCell>
                  <TableCell>
                    <Badge variant={row.needsAttention ? "destructive" : "default"}>
                      {row.needsAttention ? "Needs attention" : "On track"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm print:hidden">
          <span className="text-muted-foreground">
            {total === 0 ? "No records" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
