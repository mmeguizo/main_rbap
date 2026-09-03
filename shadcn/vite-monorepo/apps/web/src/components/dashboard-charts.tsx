import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card"

// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_COLORS = {
  DRAFT: "#f59e0b",
  SUBMITTED: "#3b82f6",
  APPROVED: "#22c55e",
}

interface PlanStatusData {
  name: string
  value: number
  color: string
}

interface ByOfficeData {
  name: string
  Draft: number
  Submitted: number
  Approved: number
}

interface PlanStatusChartProps {
  data: PlanStatusData[]
  overview?: { totalPlans: number; approvedPlans: number }
}

function PlanStatusChart({ data, overview }: PlanStatusChartProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Plan Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <ResponsiveContainer width="100%" height={200} className="sm:w-[60%] sm:h-[240px]">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-3 sm:mt-0">
              {data.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="size-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                  <span className="text-sm font-medium">{entry.value}</span>
                </div>
              ))}
              {overview && (
                <div className="pt-2 text-xs text-muted-foreground">
                  {Math.round((overview.approvedPlans / Math.max(overview.totalPlans, 1)) * 100)}% completion rate
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No plan data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface PlansByOfficeChartProps {
  data: ByOfficeData[]
}

function PlansByOfficeChart({ data }: PlansByOfficeChartProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Plans by Office</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} barGap={0} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip />
              <Legend iconSize={8} />
              <Bar dataKey="Draft" fill={STATUS_COLORS.DRAFT} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Submitted" fill={STATUS_COLORS.SUBMITTED} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Approved" fill={STATUS_COLORS.APPROVED} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No office data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DashboardChartsProps {
  planStatusData: PlanStatusData[]
  byOfficeData: ByOfficeData[]
  overview?: { totalPlans: number; approvedPlans: number }
}

export default function DashboardCharts({ planStatusData, byOfficeData, overview }: DashboardChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PlanStatusChart data={planStatusData} overview={overview} />
      <PlansByOfficeChart data={byOfficeData} />
    </div>
  )
}
