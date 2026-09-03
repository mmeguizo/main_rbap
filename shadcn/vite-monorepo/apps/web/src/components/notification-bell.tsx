import { useEffect, useState, useCallback } from "react"
import { Bell } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { notificationsApi, type Notification } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

export function NotificationBell() {
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await notificationsApi.getUnreadCount()
      setUnreadCount(result.count)
    } catch {
      // silently fail - auth may be pending
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await notificationsApi.getAll()
      const sorted = [...result.data].sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setNotifications(sorted)
      setUnreadCount(sorted.filter((n) => !n.read).length)
    } catch {
      toast.error("Failed to load notifications")
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 15000)
    window.addEventListener("focus", fetchUnreadCount)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", fetchUnreadCount)
    }
  }, [fetchUnreadCount])

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      await fetchNotifications()
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    try {
      await notificationsApi.markAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      if (notification.link) {
        navigate(notification.link)
      }
      setOpen(false)
    } catch {
      toast.error("Failed to mark notification as read")
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      toast.error("Failed to mark all notifications as read")
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return "text-green-500"
      case "WARNING":
        return "text-yellow-500"
      case "ERROR":
        return "text-red-500"
      default:
        return "text-blue-500"
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-pointer flex-col items-start gap-1 p-3"
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className={`text-sm font-medium ${getNotificationIcon(notification.type)}`}>
                  {notification.title}
                </span>
                {!notification.read && (
                  <div className="size-2 rounded-full bg-primary" aria-label="Unread" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {notification.message}
              </p>
              <time className="text-[10px] text-muted-foreground/60">
                {new Date(notification.createdAt).toLocaleString()}
              </time>
            </DropdownMenuItem>
          ))
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-sm"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}