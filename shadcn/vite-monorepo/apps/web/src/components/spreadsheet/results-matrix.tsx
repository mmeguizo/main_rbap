import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { EditableCell } from "./editable-cell"
import type { PlanDocumentRow } from "@/lib/api"

export interface ResultsMatrixProps {
  goals: PlanDocumentRow[]
  isReadOnly?: boolean
  selectedRowId: string | null
  onSelectRow: (id: string | null, type: "goal" | "objective", goalId: string) => void
  onUpdateGoal: (goalId: string, field: string, value: string | number) => Promise<void> | void
  onUpdateObjective: (
    goalId: string,
    objectiveId: string,
    field: string,
    value: string | number
  ) => Promise<void> | void
  onAddOutcome: () => void
  onAddOutput: (goalId: string) => void
  onDeleteGoal: (goalId: string) => void
  onDeleteObjective: (goalId: string, objectiveId: string) => void
}

export function ResultsMatrix({
  goals,
  isReadOnly = false,
  selectedRowId,
  onSelectRow,
  onUpdateGoal,
  onUpdateObjective,
  onAddOutcome,
  onAddOutput,
  onDeleteGoal,
  onDeleteObjective,
}: ResultsMatrixProps) {
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set())

  const toggleCollapse = (goalId: string) => {
    setCollapsedGoals((prev) => {
      const next = new Set(prev)
      if (next.has(goalId)) {
        next.delete(goalId)
      } else {
        next.add(goalId)
      }
      return next
    })
  }

  // Calculate totals across all rows
  const totalBudgetRequirements = goals.reduce((sum, g) => {
    const goalReq = Number(g.budgetRequirements) || 0
    return sum + goalReq
  }, 0)

  const totalBudgetAllocation = goals.reduce((sum, g) => {
    const goalAlloc = Number(g.budgetAllocation) || 0
    return sum + goalAlloc
  }, 0)

  const totalBudgetDeficit = totalBudgetRequirements - totalBudgetAllocation

  return (
    <div className="overflow-x-auto">
      <div className="excel-section-title flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>B. RESULTS-BASED ACTION PLAN MATRIX</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({goals.length} Parent Outcomes ·{" "}
            {goals.reduce((acc, g) => acc + (g.objectives?.length || 0), 0)} Child Outputs)
          </span>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddOutcome}
              className="h-7 text-xs gap-1 border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold"
            >
              <Plus className="size-3.5" />
              <span>+ Add Parent Row (Outcome)</span>
            </Button>
          </div>
        )}
      </div>

      <table className="excel-table min-w-[2100px]">
        <thead>
          <tr className="excel-sticky-header">
            {!isReadOnly && (
              <th className="excel-header-sage excel-col-selector" style={{ width: "40px" }}>
                #
              </th>
            )}
            <th
              className="excel-header-sage text-left"
              style={{ width: "200px", minWidth: "200px" }}
            >
              Result Level (Hierarchy)
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "230px", minWidth: "230px" }}
            >
              Target Result (SMART)
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "220px", minWidth: "220px" }}
            >
              Key Actions/Activities
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "220px", minWidth: "220px" }}
            >
              Key Risk
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "220px", minWidth: "220px" }}
            >
              Mitigation/Control Measures
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "240px", minWidth: "240px" }}
            >
              Key Performance Output/Outcome Indicators
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "200px", minWidth: "200px" }}
            >
              Target
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "160px", minWidth: "160px" }}
            >
              Responsible Office/Person
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "150px", minWidth: "150px" }}
            >
              Timeline
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "130px", minWidth: "130px" }}
            >
              Fund Source
            </th>
            <th
              className="excel-header-sage text-right"
              style={{ width: "150px", minWidth: "150px" }}
            >
              Budget Requirements
            </th>
            <th
              className="excel-header-sage text-right"
              style={{ width: "150px", minWidth: "150px" }}
            >
              Budget Allocation
            </th>
            <th
              className="excel-header-sage text-right"
              style={{ width: "140px", minWidth: "140px" }}
            >
              Budget Deficit
            </th>
            <th
              className="excel-header-sage text-left"
              style={{ width: "200px", minWidth: "200px" }}
            >
              Means of Verification (MOV)
            </th>
            {!isReadOnly && (
              <th className="excel-header-sage text-center" style={{ width: "130px", minWidth: "130px" }}>
                Row Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {goals.length === 0 ? (
            <tr>
              <td
                colSpan={isReadOnly ? 14 : 16}
                className="py-12 text-center bg-slate-50 border border-slate-300"
              >
                <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                  <p className="text-sm font-bold text-slate-800">The matrix has no rows yet</p>
                  <p className="text-xs text-muted-foreground">
                    Click the button below to add your first <strong>Parent Row (Outcome A)</strong>. Once added, you can nest child rows (Outputs) directly under it.
                  </p>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      onClick={onAddOutcome}
                      className="mt-2 bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 font-semibold text-xs shadow-sm"
                    >
                      <Plus className="size-4" />
                      <span>+ Add First Parent Row (Outcome A)</span>
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            goals.map((goal, goalIndex) => {
              const letter = String.fromCharCode(65 + (goalIndex % 26))
              const fallbackOutcomeCode = `Outcome ${letter}`
              const outcomeCode = goal.resultLevel || goal.code || fallbackOutcomeCode
              const objectives = goal.objectives || []
              const isCollapsed = collapsedGoals.has(goal.id)
              const isGoalSelected = selectedRowId === goal.id

              const goalReq = Number(goal.budgetRequirements) || 0
              const goalAlloc = Number(goal.budgetAllocation) || 0
              const goalDeficit = goalReq - goalAlloc

              return (
                <tbody key={`goal-group-${goal.id}`} className="contents">
                  {/* Parent Row (Goal / Outcome) */}
                  <tr
                    className={`excel-row-outcome border-t-2 border-slate-400 ${
                      isGoalSelected ? "excel-row-selected" : ""
                    }`}
                    onClick={() => onSelectRow(goal.id, "goal", goal.id)}
                  >
                    {!isReadOnly && (
                      <td className="excel-col-selector">
                        <div className="flex items-center justify-center gap-0.5">
                          {objectives.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCollapse(goal.id)
                              }}
                              className="text-slate-600 hover:text-slate-900"
                              title={isCollapsed ? "Expand child rows" : "Collapse child rows"}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>
                          )}
                          <span className="text-[10px] font-bold">{goalIndex + 1}</span>
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex shrink-0 items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 uppercase tracking-wider border border-emerald-300 select-none">
                          Parent
                        </span>
                        <EditableCell
                          value={outcomeCode}
                          readOnly={isReadOnly}
                          onSave={(val) => onUpdateGoal(goal.id, "resultLevel", val)}
                          placeholder="e.g. Outcome A"
                          className="font-bold text-slate-900"
                        />
                      </div>
                    </td>
                    <td>
                      <EditableCell
                        type="textarea"
                        value={goal.targetResult}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "targetResult", val)}
                        placeholder="Target Result (SMART)"
                      />
                    </td>
                    <td>
                      <EditableCell
                        type="textarea"
                        value={goal.keyActions}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "keyActions", val)}
                        placeholder="Key actions"
                      />
                    </td>
                    <td>
                      <EditableCell
                        type="textarea"
                        value={goal.keyRisk}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "keyRisk", val)}
                        placeholder="Key risk"
                      />
                    </td>
                    <td>
                      <EditableCell
                        type="textarea"
                        value={goal.mitigationMeasures}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "mitigationMeasures", val)}
                        placeholder="Mitigation measures"
                      />
                    </td>
                    <td>
                      <EditableCell
                        type="textarea"
                        value={goal.keyPerformanceIndicator}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "keyPerformanceIndicator", val)}
                        placeholder="KPI"
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={goal.target}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "target", val)}
                        placeholder="Target"
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={goal.responsibleOfficePerson}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "responsibleOfficePerson", val)}
                        placeholder="Responsible office / person"
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={goal.timeline}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "timeline", val)}
                        placeholder="Timeline (e.g. 4th qtr 2026)"
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={goal.fundSource}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "fundSource", val)}
                        placeholder="Fund source (e.g. GAA/Income)"
                      />
                    </td>
                    <td className="excel-cell-number">
                      <EditableCell
                        type="number"
                        isCurrency
                        align="right"
                        value={goalReq}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "budgetRequirements", Number(val))}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="excel-cell-number">
                      <EditableCell
                        type="number"
                        isCurrency
                        align="right"
                        value={goalAlloc}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "budgetAllocation", Number(val))}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="excel-cell-formula" title="Formula: Requirements - Allocation">
                      {goalDeficit.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <EditableCell
                        type="textarea"
                        value={goal.meansOfVerification}
                        readOnly={isReadOnly}
                        onSave={(val) => onUpdateGoal(goal.id, "meansOfVerification", val)}
                        placeholder="Means of verification (MOV)"
                      />
                    </td>
                    {!isReadOnly && (
                      <td className="text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[11px] px-2 gap-1 border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold shadow-xs"
                            title={`Nest child row under ${outcomeCode}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onAddOutput(goal.id)
                            }}
                          >
                            <Plus className="size-3" />
                            <span>Nest Child</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 text-destructive hover:bg-red-100 hover:text-destructive"
                            title={`Delete ${outcomeCode} and all its child rows`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteGoal(goal.id)
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* Child Rows (Objectives / Outputs) */}
                  {!isCollapsed &&
                    objectives.map((obj, objIndex) => {
                      const fallbackOutputCode = `Output ${letter}.${objIndex + 1}`
                      const outputCode = obj.resultLevel || obj.code || fallbackOutputCode
                      const isObjSelected = selectedRowId === obj.id
                      const objReq = Number(obj.budgetRequirements) || 0
                      const objAlloc = Number(obj.budgetAllocation) || 0
                      const objDeficit = objReq - objAlloc

                      return (
                        <tr
                          key={obj.id}
                          className={`excel-row-output ${
                            isObjSelected ? "excel-row-selected" : ""
                          }`}
                          onClick={() => onSelectRow(obj.id, "objective", goal.id)}
                        >
                          {!isReadOnly && (
                            <td className="excel-col-selector">
                              <span className="text-[10px] text-muted-foreground">
                                {goalIndex + 1}.{objIndex + 1}
                              </span>
                            </td>
                          )}
                          <td className="pl-4">
                            <div className="flex items-center gap-1.5">
                              <CornerDownRight className="size-3.5 shrink-0 text-slate-400" />
                              <span className="inline-flex shrink-0 items-center rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-600 uppercase border border-slate-200 select-none">
                                Child
                              </span>
                              <EditableCell
                                value={outputCode}
                                readOnly={isReadOnly}
                                onSave={(val) =>
                                  onUpdateObjective(goal.id, obj.id, "resultLevel", val)
                                }
                                placeholder="e.g. Output A.1"
                                className="text-slate-800"
                              />
                            </div>
                          </td>
                          <td>
                            <EditableCell
                              type="textarea"
                              value={obj.targetResult}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "targetResult", val)
                              }
                              placeholder="Target Result"
                            />
                          </td>
                          <td>
                            <EditableCell
                              type="textarea"
                              value={obj.keyActions}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "keyActions", val)
                              }
                              placeholder="Key actions"
                            />
                          </td>
                          <td>
                            <EditableCell
                              type="textarea"
                              value={obj.keyRisk}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "keyRisk", val)
                              }
                              placeholder="Key risk"
                            />
                          </td>
                          <td>
                            <EditableCell
                              type="textarea"
                              value={obj.mitigationMeasures}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "mitigationMeasures", val)
                              }
                              placeholder="Mitigation measures"
                            />
                          </td>
                          <td>
                            <EditableCell
                              type="textarea"
                              value={obj.keyPerformanceIndicator}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "keyPerformanceIndicator", val)
                              }
                              placeholder="KPI"
                            />
                          </td>
                          <td>
                            <EditableCell
                              value={obj.target}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "target", val)
                              }
                              placeholder="Target"
                            />
                          </td>
                          <td>
                            <EditableCell
                              value={obj.responsibleOfficePerson}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "responsibleOfficePerson", val)
                              }
                              placeholder="Responsible office / person"
                            />
                          </td>
                          <td>
                            <EditableCell
                              value={obj.timeline}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "timeline", val)
                              }
                              placeholder="Timeline"
                            />
                          </td>
                          <td>
                            <EditableCell
                              value={obj.fundSource}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "fundSource", val)
                              }
                              placeholder="Fund source"
                            />
                          </td>
                          <td className="excel-cell-number">
                            <EditableCell
                              type="number"
                              isCurrency
                              align="right"
                              value={objReq}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(
                                  goal.id,
                                  obj.id,
                                  "budgetRequirements",
                                  Number(val)
                                )
                              }
                              placeholder="0.00"
                            />
                          </td>
                          <td className="excel-cell-number">
                            <EditableCell
                              type="number"
                              isCurrency
                              align="right"
                              value={objAlloc}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(
                                  goal.id,
                                  obj.id,
                                  "budgetAllocation",
                                  Number(val)
                                )
                              }
                              placeholder="0.00"
                            />
                          </td>
                          <td
                            className="excel-cell-formula"
                            title="Formula: Requirements - Allocation"
                          >
                            {objDeficit.toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            <EditableCell
                              type="textarea"
                              value={obj.meansOfVerification}
                              readOnly={isReadOnly}
                              onSave={(val) =>
                                onUpdateObjective(goal.id, obj.id, "meansOfVerification", val)
                              }
                              placeholder="MOV"
                            />
                          </td>
                          {!isReadOnly && (
                            <td className="text-center align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive hover:bg-red-100 hover:text-destructive"
                                title={`Delete ${outputCode}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteObjective(goal.id, obj.id)
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      )
                    })}

                  {/* Quick Row: Nest another child under this specific Parent */}
                  {!isReadOnly && !isCollapsed && (
                    <tr className="bg-slate-50/70 border-b border-dashed border-slate-300 hover:bg-slate-100/70">
                      <td className="excel-col-selector" />
                      <td colSpan={14} className="py-1 px-4 text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddOutput(goal.id)
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                        >
                          <Plus className="size-3.5 text-emerald-600" />
                          <span>+ Add another child row under {outcomeCode}</span>
                        </button>
                      </td>
                      <td />
                    </tr>
                  )}
                </tbody>
              )
            })
          )}

          {/* Quick Row: Add next Parent Row */}
          {!isReadOnly && goals.length > 0 && (
            <tr className="bg-emerald-50/40 border-t-2 border-emerald-300 hover:bg-emerald-50 transition-colors">
              <td className="excel-col-selector" />
              <td colSpan={14} className="py-2.5 px-4 text-left">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddOutcome()
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
                >
                  <span className="flex size-4 items-center justify-center rounded bg-emerald-700 text-white font-bold text-[10px]">
                    +
                  </span>
                  <span>
                    Add New Parent Row (Outcome{" "}
                    {String.fromCharCode(65 + (goals.length % 26))})
                  </span>
                </button>
              </td>
              <td />
            </tr>
          )}

          {/* Totals Summary Row */}
          {goals.length > 0 && (
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
              {!isReadOnly && <td className="excel-col-selector" />}
              <td colSpan={10} className="text-right py-2 pr-3 uppercase tracking-wider text-xs">
                Total Budget Summary:
              </td>
              <td className="excel-cell-number font-bold text-slate-900 py-2">
                ₱
                {totalBudgetRequirements.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="excel-cell-number font-bold text-slate-900 py-2">
                ₱
                {totalBudgetAllocation.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="excel-cell-formula font-bold text-slate-900 py-2">
                ₱
                {totalBudgetDeficit.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td colSpan={!isReadOnly ? 2 : 1} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
