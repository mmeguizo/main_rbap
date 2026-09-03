import { useEffect, useState, useCallback } from "react"
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus"
import { officesApi, getApiMessage, type OfficeTreeNode } from "@/lib/api"
import { OfficeDetailModal } from "@/components/office-detail-modal"
import { EmptyState } from "@/components/empty-state"
import { Building, ChevronRight, ChevronDown, LayoutList, ChartNetwork } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

type ViewMode = "list" | "chart"

function TreeNode({ node, depth, onUpdated }: { node: OfficeTreeNode; depth: number; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(node.children.length === 0 ? true : depth < 2)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer min-w-0"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => setModalOpen(true)}
      >
        {node.children.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="p-0.5 hover:bg-muted rounded shrink-0"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        <Building className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium truncate block">{node.name}</span>
          {node.head && <span className="text-sm text-muted-foreground truncate block">· {node.head.name}</span>}
        </div>
        <Badge variant="secondary" className="shrink-0">
          {node.memberCount}
        </Badge>
      </div>
      {expanded && node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} onUpdated={onUpdated} />
      ))}
      {modalOpen && (
        <OfficeDetailModal
          officeId={node.id}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onUpdated={onUpdated}
        />
      )}
    </div>
  )
}

function OrgChartNode({ node, x, y, nodeWidth, nodeHeight, verticalSpacing, onNodeClick }: {
  node: OfficeTreeNode
  x: number
  y: number
  nodeWidth: number
  nodeHeight: number
  verticalSpacing: number
  onNodeClick: (node: OfficeTreeNode) => void
}) {
  return (
    <g>
      <foreignObject
        x={x - nodeWidth / 2}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
      >
        <div
          className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-card p-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
          style={{ width: nodeWidth, height: nodeHeight }}
          onClick={() => onNodeClick(node)}
        >
          <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-center leading-snug break-words line-clamp-3">{node.name}</span>
          {node.head && (
            <span className="text-[10px] text-muted-foreground text-center truncate w-full leading-tight">
              {node.head.name}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
            {node.memberCount}
          </Badge>
        </div>
      </foreignObject>
      {node.children.map((child) => {
        const childY = y + nodeHeight + verticalSpacing
        return (
          <g key={child.id}>
            <line
              x1={x}
              y1={y + nodeHeight}
              x2={x}
              y2={childY}
              stroke="currentColor"
              strokeWidth="1"
              className="text-border"
            />
            <OrgChartNode
              node={child}
              x={x}
              y={childY}
              nodeWidth={nodeWidth}
              nodeHeight={nodeHeight}
              verticalSpacing={verticalSpacing}
              onNodeClick={onNodeClick}
            />
          </g>
        )
      })}
    </g>
  )
}

function OrgChartView({ treeData, onUpdated }: { treeData: OfficeTreeNode[]; onUpdated: () => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedOffice, setSelectedOffice] = useState<OfficeTreeNode | null>(null)

  const handleNodeClick = (node: OfficeTreeNode) => {
    setSelectedOffice(node)
    setModalOpen(true)
  }

  const nodeWidth = 180
  const nodeHeight = 120
  const verticalSpacing = 60
  const horizontalSpacing = 220

  const totalHeight = treeData.reduce((sum, node) => {
    const childCount = node.children.reduce((c, child) => c + child.children.length, 0)
    return sum + nodeHeight + (node.children.length + childCount) * (verticalSpacing + nodeHeight)
  }, 40)

  const totalWidth = Math.max(800, horizontalSpacing * Math.max(1, treeData.length))

  return (
    <div className="overflow-auto">
      <svg width={totalWidth} height={Math.max(totalHeight, 200)}>
        {treeData.map((node, index) => (
          <OrgChartNode
            key={node.id}
            node={node}
            x={horizontalSpacing * (index + 1)}
            y={20}
            nodeWidth={nodeWidth}
            nodeHeight={nodeHeight}
            verticalSpacing={verticalSpacing}
            onNodeClick={handleNodeClick}
          />
        ))}
      </svg>
      {selectedOffice && (
        <OfficeDetailModal
          officeId={selectedOffice.id}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onUpdated={onUpdated}
        />
      )}
    </div>
  )
}

export function OfficeTreePage() {
  const [treeData, setTreeData] = useState<OfficeTreeNode[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const fetchTree = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await officesApi.getTree()
      setTreeData(data)
    } catch (error: unknown) {
      const msg = getApiMessage(error, "Failed to load office tree")
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useRefreshOnFocus(fetchTree)

  useEffect(() => {
    fetchTree()
  }, [fetchTree])

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building}
          title="Failed to load offices"
          description={error}
        />
      </div>
    )
  }

  if (!treeData || treeData.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building}
          title="No offices found"
          description="Office tree is empty"
        />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Office Tree</h1>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <LayoutList className="h-4 w-4" />
            List
          </Button>
          <Button
            variant={viewMode === "chart" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("chart")}
          >
            <ChartNetwork className="h-4 w-4" />
            Chart
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="space-y-2">
          {treeData.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} onUpdated={fetchTree} />
          ))}
        </div>
      ) : (
        <OrgChartView treeData={treeData} onUpdated={fetchTree} />
      )}
    </div>
  )
}