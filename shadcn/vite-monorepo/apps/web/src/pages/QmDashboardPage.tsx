import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ClipboardList, ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card"
import { getApiMessage, qoapApi } from "@/lib/api"
import { useAuth } from "@/contexts/useAuth"

export default function QmDashboardPage() {
  const { user } = useAuth()
  const [totalQoaps, setTotalQoaps] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSummary = () => {
    setLoading(true)
    qoapApi
      .getAll({ take: 1, skip: 0 })
      .then((result) => setTotalQoaps(result.meta.total))
      .catch((error: unknown) => {
        toast.error(getApiMessage(error, "Failed to load QM dashboard"))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSummary()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Quality Management Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor Quality Objectives and Action Plans without exposing RBAP
          dashboard reports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total QOAPs</CardTitle>
            <ClipboardList className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loading ? "—" : totalQoaps ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">
              Quality plans across accessible offices
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              QOAP and QOM workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Open the QM plan workspace to review plans and monitoring records.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="icon" onClick={loadSummary} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                <span className="sr-only">Refresh QOAP count</span>
              </Button>
              <Link to="/qoap">
                <Button className="gap-1">
                  Open QOAP <ExternalLink className="size-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
