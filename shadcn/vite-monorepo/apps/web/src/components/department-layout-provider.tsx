import * as React from "react"
import { useAuth } from "@/contexts/useAuth"
import { isQmWorkspaceActive } from "@/lib/qm"

const QM_THEME_CLASS = "theme-qm"

/**
 * Applies the QM department theme class only while the signed-in user belongs
 * to the Quality Management office. The class is removed on logout or office
 * change, and the default Planning theme is left untouched.
 */
export function DepartmentLayoutProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const isQm = isQmWorkspaceActive(user)

  React.useEffect(() => {
    const root = document.documentElement
    if (isQm) {
      root.classList.add(QM_THEME_CLASS)
    } else {
      root.classList.remove(QM_THEME_CLASS)
    }
    return () => {
      root.classList.remove(QM_THEME_CLASS)
    }
  }, [isQm])

  return <>{children}</>
}
