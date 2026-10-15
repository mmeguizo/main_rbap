import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, indeterminate, onCheckedChange, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLInputElement>) || innerRef

    React.useEffect(() => {
      if (ref && "current" in ref && ref.current) {
        ref.current.indeterminate = !!indeterminate
      }
    }, [indeterminate, ref])

    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          "size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-700 transition-colors",
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"
