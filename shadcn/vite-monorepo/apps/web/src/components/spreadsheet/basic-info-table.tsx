import { EditableCell } from "./editable-cell"

export interface BasicInfoData {
  campus: string
  officeName: string
  programProjectActivityKRA: string
  strategicAlignment: string
  breakthroughGoals: string
  strategicObjectives: string
  planningYear: number | string
  datePrepared: string | null
}

export interface BasicInfoTableProps {
  data: BasicInfoData
  isReadOnly?: boolean
  availableOffices?: Array<{ id: string; name: string }>
  onUpdateField: (field: keyof BasicInfoData, value: string | number) => Promise<void> | void
}

export function BasicInfoTable({
  data,
  isReadOnly = false,
  availableOffices = [],
  onUpdateField,
}: BasicInfoTableProps) {
  const formattedDate = data.datePrepared
    ? data.datePrepared.includes("T")
      ? data.datePrepared.split("T")[0]
      : data.datePrepared
    : ""

  return (
    <div className="overflow-x-auto">
      <div className="excel-section-title">A. BASIC INFORMATION</div>
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
            <td className="bg-slate-50 font-medium">Campus</td>
            <td>
              <EditableCell
                value={data.campus}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("campus", val)}
                placeholder="e.g. University-wide, Talisay, Fortune Towne..."
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Office/Unit</td>
            <td>
              <div className="relative">
                <EditableCell
                  value={data.officeName}
                  readOnly={isReadOnly}
                  onSave={(val) => onUpdateField("officeName", val)}
                  placeholder="e.g. Information Technology Services Unit, PMU..."
                  list="available-offices-datalist"
                  className="font-semibold text-slate-900"
                />
                {availableOffices && availableOffices.length > 0 && !isReadOnly && (
                  <datalist id="available-offices-datalist">
                    {availableOffices.map((office) => (
                      <option key={office.id} value={office.name} />
                    ))}
                  </datalist>
                )}
              </div>
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Program/Project/Activity/KRA</td>
            <td>
              <EditableCell
                type="textarea"
                value={data.programProjectActivityKRA}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("programProjectActivityKRA", val)}
                placeholder="e.g. General Administration and Support"
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Strategic Alignment/Planning Document</td>
            <td>
              <EditableCell
                type="textarea"
                value={data.strategicAlignment}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("strategicAlignment", val)}
                placeholder="e.g. CHMSU Strategic Plan 2025-2029 / ISSP"
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Breakthrough Goals</td>
            <td>
              <EditableCell
                type="textarea"
                value={data.breakthroughGoals}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("breakthroughGoals", val)}
                placeholder="e.g. Digital and Technology Transformation"
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Strategic Objectives</td>
            <td>
              <EditableCell
                type="textarea"
                value={data.strategicObjectives}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("strategicObjectives", val)}
                placeholder="e.g. To integrate smart, safe, and sustainable technologies..."
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Planning Year</td>
            <td>
              <EditableCell
                type="number"
                value={data.planningYear}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("planningYear", val)}
                placeholder="e.g. 2026"
              />
            </td>
          </tr>
          <tr>
            <td className="bg-slate-50 font-medium">Date Prepared</td>
            <td>
              <EditableCell
                type="date"
                value={formattedDate}
                readOnly={isReadOnly}
                onSave={(val) => onUpdateField("datePrepared", val)}
                placeholder="YYYY-MM-DD"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
