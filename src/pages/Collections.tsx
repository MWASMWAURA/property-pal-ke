import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKsh } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { StatusPill } from "./Dashboard";
import { Download, MessageCircle, Plus } from "lucide-react";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { BulkImportDialog } from "@/components/dialogs/BulkImportDialog";
import { toast } from "@/hooks/use-toast";

const Collections = () => {
  const { tenants, sendWhatsApp } = useData();
  const total = tenants.reduce((s, t) => s + t.rent, 0);
  const collected = tenants.filter(t => t.status === "paid").reduce((s, t) => s + t.rent, 0);
  const overdue = tenants.filter(t => t.status === "overdue").reduce((s, t) => s + t.rent, 0);

  const bulkRemind = () => {
    const overdueT = tenants.filter(t => t.status === "overdue");
    overdueT.forEach(t => sendWhatsApp(t.id, `Hi ${t.name}, your rent of ${formatKsh(t.rent)} is overdue. Kindly settle ASAP. Reply BALANCE for details.`, "landlord"));
    toast({ title: "Bulk reminder sent", description: `${overdueT.length} overdue tenants notified via WhatsApp.` });
  };

  return (
    <AppShell title="Collections" subtitle="Track rent payments across all properties">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 shadow-card border-border/60">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Expected</div>
          <div className="text-2xl font-bold font-mono-num">{formatKsh(total)}</div>
        </Card>
        <Card className="p-5 shadow-card border-border/60 border-success/30">
          <div className="text-xs uppercase tracking-wider text-success">Collected</div>
          <div className="text-2xl font-bold font-mono-num text-success">{formatKsh(collected)}</div>
        </Card>
        <Card className="p-5 shadow-card border-border/60 border-destructive/30">
          <div className="text-xs uppercase tracking-wider text-destructive">Overdue</div>
          <div className="text-2xl font-bold font-mono-num text-destructive">{formatKsh(overdue)}</div>
        </Card>
      </div>

      <Card className="shadow-card border-border/60 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-2 justify-between">
          <h2 className="font-bold">All Payments</h2>
          <div className="flex flex-wrap gap-2">
            <BulkImportDialog trigger={<Button size="sm" variant="outline"><Download className="size-3.5" /> Bulk Import</Button>} />
            <Button size="sm" variant="outline" onClick={bulkRemind}><MessageCircle className="size-3.5" /> Bulk Remind</Button>
            <RecordPaymentDialog trigger={<Button size="sm" className="gradient-primary text-primary-foreground"><Plus className="size-3.5" /> Record Payment</Button>} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-5 py-3">Tenant</th>
                <th className="text-left font-semibold px-5 py-3 hidden md:table-cell">Property / Unit</th>
                <th className="text-right font-semibold px-5 py-3">Amount</th>
                <th className="text-left font-semibold px-5 py-3 hidden sm:table-cell">Method</th>
                <th className="text-left font-semibold px-5 py-3 hidden md:table-cell">Due</th>
                <th className="text-left font-semibold px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3.5 font-semibold">{t.name}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{t.property} · {t.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono-num font-semibold">{formatKsh(t.rent)}</td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">{t.method}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{t.dueDate}</td>
                  <td className="px-5 py-3.5"><StatusPill status={t.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
};
export default Collections;
