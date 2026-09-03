export function formatBulletedLines(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*•]|\d+\.)\s*/, ""))
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join("\n")
}
