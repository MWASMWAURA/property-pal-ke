import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "./NotificationsBell";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Topbar = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
    <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <div className="hidden md:flex items-center relative max-w-sm flex-1">
        <Search className="absolute left-3 size-4 text-muted-foreground" />
        <Input placeholder="Search tenant, unit, property…" className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background" />
      </div>
      <NotificationsBell />
      <RecordPaymentDialog
        trigger={
          <Button className="gradient-primary text-primary-foreground hover:opacity-90 hidden sm:inline-flex">
            <Plus className="size-4" /> New Payment
          </Button>
        }
      />
    </div>
  </header>
);
