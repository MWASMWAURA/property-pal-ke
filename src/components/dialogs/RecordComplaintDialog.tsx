import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { MessageSquareWarning } from "lucide-react";

export const RecordComplaintDialog = ({
  trigger, defaultTenantId,
}: { trigger: React.ReactNode; defaultTenantId?: string }) => {
  const { tenants, recordComplaint } = useData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tenantId: defaultTenantId ?? "",
    category: "Plumbing",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    description: "",
    notify: true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId || !form.description.trim()) return;
    const c = await recordComplaint({
      tenantId: form.tenantId,
      category: form.category,
      description: form.description.trim(),
      priority: form.priority,
      source: "landlord",
      notify: form.notify,
    });
    toast({
      title: "Complaint logged",
      description: form.notify ? `Tenant notified via WhatsApp · Ref #${c.id.slice(-6).toUpperCase()}` : `Saved · Ref #${c.id.slice(-6).toUpperCase()}`,

    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="size-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center mb-2">
            <MessageSquareWarning className="size-5" />
          </div>
          <DialogTitle>Log a complaint on behalf of tenant</DialogTitle>
          <DialogDescription>Useful when a tenant calls you instead of using WhatsApp.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tenant</Label>
            <Select value={form.tenantId} onValueChange={(v) => setForm({ ...form, tenantId: v })}>
              <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
              <SelectContent>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name} · {t.unit}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Plumbing", "Electrical", "General", "Carpentry", "Painting", "Security", "Cleaning"].map(c =>
                    <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} placeholder="Describe the issue…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-semibold">Notify tenant on WhatsApp</div>
              <div className="text-xs text-muted-foreground">Bot will confirm complaint with reference number.</div>
            </div>
            <Switch checked={form.notify} onCheckedChange={(v) => setForm({ ...form, notify: v })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="gradient-primary text-primary-foreground">Log complaint</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
