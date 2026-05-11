import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useData, TenantStatus } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Edit } from "lucide-react";

export const EditTenantDialog = ({ trigger, tenantId }: { trigger: React.ReactNode; tenantId: string }) => {
  const { tenants, properties, updateTenant } = useData();
  const [open, setOpen] = useState(false);
  const tenant = tenants.find(t => t.id === tenantId);

  const [form, setForm] = useState({
    name: "", phone: "", unit: "", property: "",
    rent: 30000, status: "pending" as TenantStatus,
    method: "M-Pesa", dueDate: "05/05/2026", leaseEnd: "31/12/2026",
  });

  useEffect(() => {
    if (tenant && open) {
      setForm({
        name: tenant.name,
        phone: tenant.phone,
        unit: tenant.unit,
        property: tenant.property,
        rent: tenant.rent,
        status: tenant.status,
        method: tenant.method,
        dueDate: tenant.dueDate,
        leaseEnd: tenant.leaseEnd,
      });
    }
  }, [tenant, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.unit || !form.property || !tenant) return;
    updateTenant(tenant.id, form);
    toast({ title: "Tenant updated", description: `${form.name}'s information has been updated.` });
    setOpen(false);
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-2">
            <Edit className="size-5"/>
          </div>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogDescription>Update tenant contact information and details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-name">Full name</Label>
              <Input id="t-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-phone">Phone</Label>
              <Input id="t-phone" placeholder="07... or +254..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
             
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={form.property} onValueChange={v => setForm({...form, property: v})}>
                <SelectTrigger><SelectValue placeholder={properties.length ? "Choose property" : "Add a property first"}/></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-unit">Unit</Label>
              <Input id="t-unit" placeholder="e.g. A-204" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} required/>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-rent">Monthly rent (KSh)</Label>
              <Input id="t-rent" type="number" min={0} value={form.rent} onChange={e => setForm({...form, rent: +e.target.value})}/>
            </div>
            <div className="space-y-2">
              <Label>Payment status</Label>
              <Select value={form.status} onValueChange={(v: TenantStatus) => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={form.method} onValueChange={v => setForm({...form, method: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-lease">Lease end</Label>
              <Input id="t-lease" placeholder="dd/mm/yyyy" value={form.leaseEnd} onChange={e => setForm({...form, leaseEnd: e.target.value})}/>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="gradient-primary text-primary-foreground">Update tenant</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};