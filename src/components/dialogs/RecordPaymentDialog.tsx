import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Receipt } from "lucide-react";

const monthYear = () => {
  const d = new Date();
  return d.toLocaleString("en-KE", { month: "long", year: "numeric" });
};

export const RecordPaymentDialog = ({
  trigger, defaultTenantId,
}: { trigger: React.ReactNode; defaultTenantId?: string }) => {
  const { tenants, recordPayment } = useData();
  const [open, setOpen] = useState(false);
  const initial = () => {
    const t = tenants.find(x => x.id === defaultTenantId) ?? tenants[0];
    return {
      tenantId: t?.id ?? "",
      amount: t?.rent ?? 0,
      method: t?.method ?? "M-Pesa",
      period: monthYear(),
      reference: "",
    };
  };
  const [form, setForm] = useState(initial);

  const tenant = tenants.find(t => t.id === form.tenantId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || form.amount <= 0) return;
    recordPayment({
      tenantId: tenant.id,
      tenantName: tenant.name,
      amount: form.amount,
      period: form.period,
      method: form.method,
      reference: form.reference || undefined,
    });
    toast({ title: "Payment recorded", description: `${tenant.name} · ${form.period}. WhatsApp receipt sent.` });
    setOpen(false);
    setForm(initial());
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm(initial()); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-2">
            <Receipt className="size-5" />
          </div>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Marks tenant as paid and sends a WhatsApp receipt via the bot.</DialogDescription>
        </DialogHeader>
        {tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a tenant first to record payments.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={form.tenantId} onValueChange={(v) => {
                const t = tenants.find(x => x.id === v);
                setForm(f => ({ ...f, tenantId: v, amount: t?.rent ?? f.amount, method: t?.method ?? f.method }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name} · {t.unit}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (KSh)</Label>
                <Input type="number" min={1} value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input placeholder="MPESA code…" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="gradient-primary text-primary-foreground">Save & Notify</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
