import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "./NotificationsBell";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Topbar = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
    <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <div className="relative max-w-sm w-full md:flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search tenant, unit, property…" className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background w-full" />
      </div>
      <div className="flex items-center gap-2 justify-between md:justify-end">
        <NotificationsBell />
        <RecordPaymentDialog
          trigger={
            <Button className="gradient-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-2">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Payment</span>
            </Button>
          }
        />
      </div>
    </div>
  </header>
);
