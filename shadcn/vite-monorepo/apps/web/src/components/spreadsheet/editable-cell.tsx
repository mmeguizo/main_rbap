import { useState, useEffect, useRef, type KeyboardEvent } from "react"
import { Loader2 } from "lucide-react"

export interface EditableCellProps {
  value: string | number | null | undefined
  onSave?: (newValue: string | number) => Promise<void> | void
  type?: "text" | "number" | "textarea" | "date"
  readOnly?: boolean
  placeholder?: string
  className?: string
  isCurrency?: boolean
  align?: "left" | "center" | "right"
  children?: React.ReactNode
  list?: string
}

function formatDisplayValue(val: string | number | null | undefined, isCurrency?: boolean): string {
  if (val === null || val === undefined || val === "") return ""
  if (typeof val === "number" || (!isNaN(Number(val)) && typeof val === "string" && val.trim() !== "")) {
    const num = Number(val)
    if (isCurrency) {
      return num.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }
  return String(val)
}

export function EditableCell({
  value,
  onSave,
  type = "text",
  readOnly = false,
  placeholder = "—",
  className = "",
  isCurrency = false,
  align = "left",
  children,
  list,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value !== null && value !== undefined ? String(value) : "")
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!editing) {
      setDraft(value !== null && value !== undefined ? String(value) : "")
    }
  }, [value, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if ("select" in inputRef.current) {
        inputRef.current.select()
      }
    }
  }, [editing])

  const handleStartEditing = () => {
    if (readOnly) return
    setDraft(value !== null && value !== undefined ? String(value) : "")
    setEditing(true)
  }

  const handleCommit = async () => {
    setEditing(false)
    const originalStr = value !== null && value !== undefined ? String(value) : ""
    if (draft.trim() === originalStr.trim()) return

    if (onSave) {
      setSaving(true)
      try {
        if (type === "number") {
          const numVal = draft.trim() === "" ? 0 : Number(draft.replace(/,/g, ""))
          await onSave(isNaN(numVal) ? 0 : numVal)
        } else {
          await onSave(draft)
        }
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 800)
      } catch {
        // Revert on error
        setDraft(originalStr)
      } finally {
        setSaving(false)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      setDraft(value !== null && value !== undefined ? String(value) : "")
      setEditing(false)
      return
    }

    if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault()
      handleCommit()
    }
  }

  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"

  if (editing && !readOnly) {
    return (
      <div className={`excel-cell-editing ${alignClass} ${className}`}>
        {type === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="excel-cell-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === "number" ? "text" : type}
            className={`excel-cell-input ${alignClass}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            list={list}
          />
        )}
      </div>
    )
  }

  const displayVal = formatDisplayValue(value, isCurrency)

  return (
    <div
      onClick={handleStartEditing}
      className={`excel-cell-display ${alignClass} ${readOnly ? "excel-cell-readonly" : ""} ${
        savedFlash ? "excel-cell-saved" : ""
      } ${className}`}
      title={!readOnly ? "Click to edit" : undefined}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={(e) => {
        if (!readOnly && (e.key === "Enter" || e.key === "F2")) {
          e.preventDefault()
          handleStartEditing()
        }
      }}
    >
      {saving ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground italic">
          <Loader2 className="size-3 animate-spin text-green-600" />
          <span className="text-[10px]">Saving...</span>
        </span>
      ) : children ? (
        children
      ) : displayVal ? (
        <span>{displayVal}</span>
      ) : (
        <span className="text-muted-foreground/60 select-none">{placeholder}</span>
      )}
    </div>
  )
}
