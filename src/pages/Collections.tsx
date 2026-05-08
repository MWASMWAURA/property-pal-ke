import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKsh } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { api } from "@/lib/api";
import { StatusPill } from "./Dashboard";
import { Download, MessageCircle, Plus } from "lucide-react";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { BulkImportDialog } from "@/components/dialogs/BulkImportDialog";
import { toast } from "@/hooks/use-toast";

const Collections = () => {
  const { tenants, payments, sendWhatsApp } = useData();
  const location = useLocation();
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  useEffect(() => {
    if (location.search.includes('import=bulk')) {
      setBulkImportOpen(true);
    }
  }, [location.search]);

  // Calculate totals based on actual balances
  const totalExpected = tenants.reduce((s, t) => s + t.rent, 0);
  const collected = payments.reduce((s, p) => s + p.amount, 0);

  // Calculate outstanding balances (only positive balances, overpayments don't create negative balances)
  const tenantBalances = tenants.map(tenant => {
    const tenantPayments = payments.filter(p => p.tenantId === tenant.id);
    const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
      ...tenant,
      balance: Math.max(0, tenant.rent - totalPaid),
      totalPaid: totalPaid,
      overpayment: Math.max(0, totalPaid - tenant.rent)
    };
  });

  const pending = tenantBalances
    .filter(t => t.status === "pending" && t.balance > 0)
    .reduce((s, t) => s + t.balance, 0);

  const overdue = tenantBalances
    .filter(t => t.status === "overdue" && t.balance > 0)
    .reduce((s, t) => s + t.balance, 0);

  const bulkRemind = async () => {
    const overdueT = tenants.filter(t => t.status === "overdue" && t.phone);
    
    try {
      await api.bulkRemind(overdueT.map(t => ({
        id: t.id, name: t.name, rent: t.rent, phone: t.phone
      })));
      // Also update local WA threads for Messages page
      overdueT.forEach(t => {
        sendWhatsApp(t.id, 
          `Hi ${t.name}, your rent of ${formatKsh(t.rent)} is overdue. Please settle at your earliest. Send BALANCE for details.`,
          'out', 'landlord'
        );
      });
      toast({
        title: "Bulk reminder sent via WhatsApp",
        description: `${overdueT.length} tenants notified.`
      });
    } catch {
      toast({
        title: "Server offline",
        description: "Messages saved locally but not sent.",
        variant: "destructive"
      });
    }
  };

  return (
    <AppShell title="Collections" subtitle="Track rent payments across all properties">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 shadow-card border-border/60">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Expected</div>
          <div className="text-2xl font-bold font-mono-num">{formatKsh(total)}</div>
        </Card>
        <Card className="p-5 shadow-card border-border/60 border-success/30">
          <div className="text-xs uppercase tracking-wider text-success">Collected</div>
          <div className="text-2xl font-bold font-mono-num text-success">{formatKsh(collected)}</div>
        </Card>
        <Card className="p-5 shadow-card border-border/60 border-warning/30">
          <div className="text-xs uppercase tracking-wider text-warning">Pending</div>
          <div className="text-2xl font-bold font-mono-num text-warning">{formatKsh(pending)}</div>
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
            <BulkImportDialog
              trigger={<Button size="sm" variant="outline"><Download className="size-3.5" /> Bulk Import</Button>}
              open={bulkImportOpen}
              onOpenChange={setBulkImportOpen}
            />
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
                <th className="text-right font-semibold px-5 py-3">Rent</th>
                <th className="text-right font-semibold px-5 py-3 hidden sm:table-cell">Balance</th>
                <th className="text-right font-semibold px-5 py-3 hidden md:table-cell">Overpaid</th>
                <th className="text-left font-semibold px-5 py-3 hidden sm:table-cell">Method</th>
                <th className="text-left font-semibold px-5 py-3 hidden md:table-cell">Due</th>
                <th className="text-left font-semibold px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenantBalances.map(t => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3.5 font-semibold">{t.name}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{t.property} · {t.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono-num">{formatKsh(t.rent)}</td>
                  <td className="px-5 py-3.5 text-right font-mono-num font-semibold hidden sm:table-cell">{formatKsh(t.balance)}</td>
                  <td className="px-5 py-3.5 text-right font-mono-num text-success hidden md:table-cell">{t.overpayment > 0 ? formatKsh(t.overpayment) : '-'}</td>
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
