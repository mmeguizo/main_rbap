import { Input } from "@/components/input"
import { Textarea } from "@/components/textarea"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form"
import {
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  useFormContext,
} from "react-hook-form"

interface FormFieldRowProps<T extends FieldValues> extends Omit<
  ControllerProps<T>,
  "name" | "control" | "render"
> {
  name: FieldPath<T>
  label: string
  placeholder?: string
  type?: string
  optional?: boolean
  disabled?: boolean
}

export function FormFieldRow<T extends FieldValues>({
  name,
  label,
  placeholder,
  type = "text",
  optional = false,
  disabled = false,
}: FormFieldRowProps<T>) {
  return (
    <FormField
      control={useFormContext<T>().control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{optional ? label : `${label} *`}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              {...field}
              value={type === "number" ? field.value : (field.value ?? "")}
              onChange={
                type === "number"
                  ? (e) =>
                      field.onChange(
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                  : field.onChange
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function FormTextareaRow<T extends FieldValues>({
  name,
  label,
  placeholder,
  optional = false,
  disabled = false,
}: Omit<FormFieldRowProps<T>, "type">) {
  return (
    <FormField
      control={useFormContext<T>().control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{optional ? label : `${label} *`}</FormLabel>
          <FormControl>
            <Textarea
              placeholder={placeholder}
              disabled={disabled}
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
