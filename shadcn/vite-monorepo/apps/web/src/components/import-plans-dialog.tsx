import { useRef, useState, type ChangeEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { plansApi } from "@/lib/api"

interface ImportResult {
  plansCreated: number
  goalsCreated: number
  objectivesCreated: number
  errors: string[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function ImportPlansDialog({ open, onOpenChange, onUpdated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) {
      if (f.name.endsWith(".xlsx")) {
        setFile(f)
      } else {
        toast.error("Only .xlsx files are accepted")
      }
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    try {
      const result = await plansApi.importPlans(file)
      setImportResult(result)
      if (result.errors.length > 0) {
        toast.error(`Import completed with ${result.errors.length} error(s)`)
      } else {
        toast.success(`Imported ${result.plansCreated} plan(s), ${result.goalsCreated} goal(s), ${result.objectivesCreated} objective(s)`)
      }
      onUpdated()
      setImporting(false)
    } catch {
      toast.error("Failed to import plans. Check the file format and try again.")
    } finally {
      setImporting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!importing) {
      if (importResult && !open) {
        setImportResult(null)
        setFile(null)
      } else if (!open) {
        setFile(null)
      }
      onOpenChange(open)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Plans</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) file to create plans, goals, and objectives in bulk.
            Maximum file size: 5 MB.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${importResult ? 'pointer-events-none opacity-50' : 'hover:border-primary'}`}
        >
          {file ? (
            <>
              <FileSpreadsheet className="size-10 text-green-600" />
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </>
          ) : (
            <>
              <Upload className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop an .xlsx file here, or click to browse
              </p>
            </>
          )}
        </div>

        {importResult && (
          <div className="space-y-3 rounded-lg border bg-muted/50 p-3 text-sm">
            {importResult.errors.length === 0 ? (
              <p className="font-medium text-green-700 dark:text-green-400">
                Import successful
              </p>
            ) : (
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Import completed with {importResult.errors.length} error(s)
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{importResult.plansCreated}</p>
                <p className="text-xs text-muted-foreground">Plans</p>
              </div>
              <div>
                <p className="text-lg font-bold">{importResult.goalsCreated}</p>
                <p className="text-xs text-muted-foreground">Goals</p>
              </div>
              <div>
                <p className="text-lg font-bold">{importResult.objectivesCreated}</p>
                <p className="text-xs text-muted-foreground">Objectives</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {importResult.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="rounded bg-background/50 p-1">{err}</p>
                ))}
                {importResult.errors.length > 5 && (
                  <p className="p-1 font-medium text-muted-foreground">
                    +{importResult.errors.length - 5} more error(s)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
            {importResult ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleImport} disabled={!file || importing || !!importResult}>
            {importing && <Loader2 className="size-4 animate-spin" />}
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
