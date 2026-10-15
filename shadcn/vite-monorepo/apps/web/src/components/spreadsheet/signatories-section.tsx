import { EditableCell } from "./editable-cell"

export interface SignatoriesData {
  preparedBy: string
  reviewedBy: string
  approvedBy: string
}

export interface SignatoriesSectionProps {
  data: SignatoriesData
  isReadOnly?: boolean
  onUpdateField: (field: keyof SignatoriesData, value: string) => Promise<void> | void
}

export function SignatoriesSection({
  data,
  isReadOnly = false,
  onUpdateField,
}: SignatoriesSectionProps) {
  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <table className="excel-table border-none">
        <tbody>
          <tr>
            <td className="w-1/3 border-none p-4">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-700">Prepared by:</p>
                <div className="border-b border-slate-900 pb-1 text-center font-bold">
                  <EditableCell
                    value={data.preparedBy}
                    readOnly={isReadOnly}
                    align="center"
                    onSave={(val) => onUpdateField("preparedBy", String(val))}
                    placeholder="ENTER PREPARER NAME & TITLE"
                    className="font-bold tracking-wide text-slate-900"
                  />
                </div>
                <p className="text-center text-xs text-slate-600">Division/Unit Head/Dean</p>
              </div>
            </td>
            <td className="w-1/3 border-none p-4">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-700">Reviewed by:</p>
                <div className="border-b border-slate-900 pb-1 text-center font-bold">
                  <EditableCell
                    value={data.reviewedBy}
                    readOnly={isReadOnly}
                    align="center"
                    onSave={(val) => onUpdateField("reviewedBy", String(val))}
                    placeholder="ENTER REVIEWER NAME & TITLE"
                    className="font-bold tracking-wide text-slate-900"
                  />
                </div>
                <p className="text-center text-xs text-slate-600">Vice President</p>
              </div>
            </td>
            <td className="w-1/3 border-none p-4">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-700">Approved by:</p>
                <div className="border-b border-slate-900 pb-1 text-center font-bold">
                  <EditableCell
                    value={data.approvedBy}
                    readOnly={isReadOnly}
                    align="center"
                    onSave={(val) => onUpdateField("approvedBy", String(val))}
                    placeholder="ENTER APPROVER NAME & TITLE"
                    className="font-bold tracking-wide text-slate-900"
                  />
                </div>
                <p className="text-center text-xs text-slate-600">SUC III President</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
