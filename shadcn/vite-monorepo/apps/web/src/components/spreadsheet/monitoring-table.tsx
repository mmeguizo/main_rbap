import { EditableCell } from "./editable-cell"

export interface MonitoringData {
  frequency: string
  reportingOffice: string
}

export interface MonitoringTableProps {
  data: MonitoringData
  isReadOnly?: boolean
  onUpdateField: (field: keyof MonitoringData, value: string) => Promise<void> | void
}

export function MonitoringTable({
  data,
  isReadOnly = false,
  onUpdateField,
}: MonitoringTableProps) {
  return (
    <div className="overflow-x-auto">
      <div className="excel-section-title">C. MONITORING</div>
      <table className="excel-table">
        <thead>
          <tr>
            <th
              className="excel-header-sage py-2 text-left font-bold"
              style={{ width: "30%", minWidth: "240px" }}
            >
              ITEM
            </th>
            <th className="excel-header-sage py-2 text-left font-bold" style={{ width: "70%" }}>
              DETAILS
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="bg-slate-50 font-medium">Monitoring Frequency</td>
            <td>
              <EditableCell
                value={data.frequency}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("frequency", String(val))}
                placeholder="e.g. Quarterly, Monthly, Semestral, Annual"
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Reporting Office</td>
            <td>
              <EditableCell
                type="textarea"
                value={data.reportingOffice}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("reportingOffice", String(val))}
                placeholder="e.g. Information and Communication Technology Unit"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
