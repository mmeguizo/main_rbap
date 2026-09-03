import { useEffect } from "react"

export function useRefreshOnFocus(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh()
      }
    }
    const handleFocus = () => refresh()
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleFocus)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleFocus)
    }
  }, [refresh, enabled])
}
