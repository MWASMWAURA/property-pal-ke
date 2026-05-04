import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";

const typeColor: Record<string, string> = {
  complaint: "bg-warning/15 text-warning",
  maintenance: "bg-warning/15 text-warning",
  payment: "bg-success/15 text-success",
  whatsapp: "bg-info/15 text-info",
  system: "bg-muted text-muted-foreground",
};

export const NotificationsBell = () => {
  const { notifications, markAllNotificationsRead, markNotificationRead } = useData();
  const unread = notifications.filter(n => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="font-bold text-sm">Notifications</div>
          {unread > 0 && (
            <button onClick={markAllNotificationsRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Check className="size-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up 🎉</div>
          ) : notifications.map(n => (
            <button
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={cn(
                "w-full text-left p-3 border-b border-border hover:bg-muted/40 transition flex items-start gap-3",
                !n.read && "bg-primary/5"
              )}
            >
              <span className={cn("size-2 mt-2 rounded-full shrink-0", n.read ? "bg-transparent" : "bg-primary")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", typeColor[n.type] ?? "bg-muted")}>{n.type}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString("en-KE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                </div>
                <div className="font-semibold text-sm truncate">{n.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
