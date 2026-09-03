import { useMemo, useRef, useState } from "react"
import { Input } from "@/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

interface OfficeOption {
  id: string
  name: string
}

interface SearchableOfficeSelectProps {
  value: string
  onValueChange: (value: string) => void
  offices: ReadonlyArray<OfficeOption>
  disabled?: boolean
  excludeId?: string
  placeholder?: string
  searchPlaceholder?: string
  noneLabel?: string
}

export function SearchableOfficeSelect({
  value,
  onValueChange,
  offices,
  disabled = false,
  excludeId,
  placeholder = "Select office",
  searchPlaceholder = "Search offices...",
  noneLabel = "— None —",
}: SearchableOfficeSelectProps) {
  const [search, setSearch] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredOffices = useMemo(() => {
    const availableOffices = offices.filter((office) => office.id !== excludeId)
    const query = search.trim().toLowerCase()
    const matchingOffices = query
      ? availableOffices.filter((office) =>
          office.name.toLowerCase().includes(query),
        )
      : availableOffices
    const selectedOffice = availableOffices.find((office) => office.id === value)

    if (
      selectedOffice &&
      !matchingOffices.some((office) => office.id === selectedOffice.id)
    ) {
      return [selectedOffice, ...matchingOffices]
    }

    return matchingOffices
  }, [excludeId, offices, search, value])

  const handleValueChange = (nextValue: string) => {
    onValueChange(nextValue)
    setSearch("")
  }

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        onOpenChange={(open) => {
          if (open) {
            window.setTimeout(() => searchInputRef.current?.focus(), 0)
          } else {
            setSearch("")
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4} className="max-h-52">
          <div className="sticky top-0 z-10 bg-popover p-2">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder={searchPlaceholder}
              disabled={disabled}
              aria-label={searchPlaceholder}
            />
          </div>
          <SelectItem value="none">{noneLabel}</SelectItem>
          {filteredOffices.length > 0 ? (
            filteredOffices.map((office) => (
              <SelectItem key={office.id} value={office.id} className="truncate">
                {office.name}
              </SelectItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No offices found
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
