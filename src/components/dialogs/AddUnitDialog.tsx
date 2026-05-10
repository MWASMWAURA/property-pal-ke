import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Home } from "lucide-react";

export const AddUnitDialog = ({ trigger, property }: { trigger: React.ReactNode; property: { id: string; name: string } }) => {
  const { updateProperty } = useData();
  const [open, setOpen] = useState(false);
  const [unitName, setUnitName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim()) return;

    // Check if unit name already exists
    if (property.unitNames.includes(unitName.trim())) {
      toast({ title: "Unit already exists", description: `Unit ${unitName} already exists in ${property.name}.`, variant: "destructive" });
      return;
    }

    // Increment the property's unit count and add to unitNames
    updateProperty(property.id, {
      units: property.units + 1,
      unitNames: [...property.unitNames, unitName.trim()]
    });
    toast({ title: "Unit added", description: `Unit ${unitName} added to ${property.name}.` });
    setUnitName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-2">
            <Home className="size-5"/>
          </div>
          <DialogTitle>Add a unit</DialogTitle>
          <DialogDescription>Add a new vacant unit to {property.name}. You can assign a tenant to it later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unit-name">Unit name</Label>
            <Input id="unit-name" placeholder="e.g. B-105" value={unitName} onChange={e => setUnitName(e.target.value)} required/>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="gradient-primary text-primary-foreground">Add unit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};