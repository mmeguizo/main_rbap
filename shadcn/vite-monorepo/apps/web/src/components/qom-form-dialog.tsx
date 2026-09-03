import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@/components/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form"
import { toast } from "sonner"
import { qomApi, getApiMessage, type Qom } from "@/lib/api"
import {
  qomFormSchema,
  MONTH_KEYS,
  MONTH_LABELS,
  type QomFormValues,
} from "@/lib/schemas"
import { cn } from "@workspace/ui/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  qoapId: string
  editing?: Qom | null
}

export function QomFormDialog({
  open,
  onOpenChange,
  onSaved,
  qoapId,
  editing,
}: Props) {
  const form = useForm<QomFormValues>({
    resolver: zodResolver(qomFormSchema),
    defaultValues: {
      monitoringNo: 1,
      recencyDate: "",
      previousMonitoringDate: "",
      performance: {},
      overallDataResult: "",
      movDataSource: "",
    },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.reset({
        monitoringNo: editing.monitoringNo,
        recencyDate: editing.recencyDate?.slice(0, 10) ?? "",
        previousMonitoringDate: editing.previousMonitoringDate?.slice(0, 10) ?? "",
        performance: { ...editing.performance },
        overallDataResult: editing.overallDataResult ?? "",
        movDataSource: editing.movDataSource ?? "",
      })
    } else {
      form.reset({
        monitoringNo: 1,
        recencyDate: "",
        previousMonitoringDate: "",
        performance: {},
        overallDataResult: "",
        movDataSource: "",
      })
    }
  }, [open, editing, form])

  const handleSave = async (values: QomFormValues) => {
    const payload = {
      monitoringNo: values.monitoringNo,
      recencyDate: values.recencyDate,
      previousMonitoringDate: values.previousMonitoringDate || undefined,
      performance: values.performance ?? {},
      overallDataResult: values.overallDataResult || undefined,
      movDataSource: values.movDataSource || undefined,
    }
    try {
      if (editing) {
        await qomApi.update(qoapId, editing.id, payload)
        toast.success("Monitoring record updated")
      } else {
        await qomApi.create(qoapId, payload)
        toast.success("Monitoring record created")
      }
      onSaved()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(getApiMessage(error, editing ? "Failed to update record" : "Failed to create record"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Monitoring Record" : "New Monitoring Record"}
          </DialogTitle>
          <DialogDescription>
            Record Jan-Dec performance for this QOM entry.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="monitoringNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monitoring No *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recencyDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recency Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={typeof field.value === "string" ? field.value : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="previousMonitoringDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous Monitoring Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={typeof field.value === "string" ? field.value : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Jan-Dec Performance (– = not monitored)
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {MONTH_KEYS.map((month) => (
                  <FormField
                    key={month}
                    control={form.control}
                    name={`performance.${month}`}
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] uppercase text-muted-foreground">
                          {MONTH_LABELS[month]}
                        </FormLabel>
                        <FormControl>
                          <Input
                            value={typeof field.value === "string" ? field.value : ""}
                            onChange={field.onChange}
                            className="h-8 text-xs"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="overallDataResult"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Data Result</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 2/3 milestones achieved"
                        {...field}
                        value={typeof field.value === "string" ? field.value : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="movDataSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MOV / Data Source</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. QMS quarterly report"
                        {...field}
                        value={typeof field.value === "string" ? field.value : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter showCloseButton>
              <Button type="submit" className={cn("w-full")}>
                {editing ? "Save Changes" : "Create Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}