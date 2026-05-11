import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

export const AddPropertyDialog = ({ trigger }: { trigger: React.ReactNode }) => {
  const { addProperty } = useData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", units: 1, occupied: 0, unitNames: [] as string[] });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.location) return;

    // Generate default unit names if units specified but no custom unitNames
    const unitNames = form.unitNames.length > 0 ? form.unitNames :
      Array.from({ length: form.units }, (_, i) => `Unit ${i + 1}`);

    addProperty({ ...form, image: "", unitNames });
    toast({ title: "Property added", description: `${form.name} is now in your portfolio.` });
    setForm({ name: "", location: "", units: 1, occupied: 0, unitNames: [] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-2">
            <Building2 className="size-5"/>
          </div>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>Add a new building to your portfolio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Property name</Label>
            <Input id="p-name" placeholder="e.g. Riverside Heights" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-loc">Location</Label>
            <Input id="p-loc" placeholder="e.g. Kilimani, Nairobi" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-units">Total units</Label>
              <Input id="p-units" type="number" min={1} value={form.units} onChange={e => setForm({...form, units: +e.target.value})}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-occ">Occupied</Label>
              <Input id="p-occ" type="number" min={0} max={form.units} value={form.occupied} onChange={e => setForm({...form, occupied: +e.target.value})}/>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="gradient-primary text-primary-foreground">Save property</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
