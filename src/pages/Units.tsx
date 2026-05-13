import { useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/lib/data-store";
import { formatKsh } from "@/lib/mock-data";
import { Building2, MapPin, User, Plus, ArrowLeft, Home, Trash2, Info } from "lucide-react";
import { StatusPill } from "./Dashboard";
import { Link } from "react-router-dom";
import { AddTenantDialog } from "@/components/dialogs/AddTenantDialog";
import { AddUnitDialog } from "@/components/dialogs/AddUnitDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const Units = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { properties, tenants, deleteUnit } = useData();

  const property = properties.find(p => p.id === propertyId);
  if (!property) {
    return (
      <AppShell title="Property not found" subtitle="The property you're looking for doesn't exist">
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Property not found.</p>
          <Link to="/properties">
            <Button className="mt-4">Back to Properties</Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  const propertyTenants = tenants.filter(t => t.property === property.name);
  const occupiedCount = propertyTenants.length;
  const vacantCount = property.units - occupiedCount;

  // Use specific unit names if available, otherwise fall back to generic vacant units
  const occupiedUnits = propertyTenants.map(t => t.unit);
  const vacantUnits = property.unitNames && property.unitNames.length > 0
    ? property.unitNames.filter(unitName => !occupiedUnits.includes(unitName))
    : [];

  return (
    <AppShell title={`${property.name} Units`} subtitle={`${property.units} total · ${propertyTenants.length} occupied · ${vacantCount} vacant`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <Link to="/properties" className="order-1 sm:order-1">
          <Button variant="outline" size="sm" className="w-full sm:w-auto touch-manipulation min-h-[44px]">
            <ArrowLeft className="size-4" />
            <span className="hidden xs:inline">Back to Properties</span>
            <span className="xs:hidden">Back</span>
          </Button>
        </Link>
        <div className="flex-1 order-3 sm:order-2 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold">{property.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
            <MapPin className="size-3" />
            {property.location}
          </p>
        </div>
        <div className="order-2 sm:order-3">
          <AddUnitDialog property={property} trigger={
            <Button className="gradient-primary text-primary-foreground w-full sm:w-auto touch-manipulation min-h-[44px]">
              <Plus className="size-4" />
              Add Unit
            </Button>
          } />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {propertyTenants.map(tenant => (
          <Card key={tenant.id} className="p-4 border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="font-mono font-bold text-lg">{tenant.unit}</div>
                <div
                  className="text-xs text-muted-foreground cursor-help"
                  title="To delete this unit, first remove the tenant from the Tenants page"
                >
                  <Info className="size-3" />
                </div>
              </div>
              <StatusPill status={tenant.status} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <span className="font-semibold">{tenant.name}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Rent: {formatKsh(tenant.rent)}
              </div>
              <div className="text-xs text-muted-foreground">
                Due: {tenant.dueDate}
              </div>
              <div className="text-xs text-muted-foreground">
                Lease ends: {tenant.leaseEnd}
              </div>
            </div>
          </Card>
        ))}

        {/* Show specific vacant units if available */}
        {vacantUnits.map(unitName => (
          <Card key={`vacant-${unitName}`} className="p-4 border-dashed border-muted-foreground/30">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono font-bold text-lg">{unitName}</div>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-destructive hover:text-destructive">
                      <Trash2 className="size-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-full max-w-sm sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete unit</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete unit {unitName}? This will permanently remove the unit from {property.name}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          const success = deleteUnit(property.id, unitName);
                          if (!success) {
                            toast({
                              title: "Cannot delete occupied unit",
                              description: "Remove the tenant first before deleting this unit.",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Badge variant="secondary">Vacant</Badge>
              </div>
            </div>

            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground mb-2">Unit available</div>
              <AddTenantDialog
                defaultProperty={property.name}
                defaultUnit={unitName}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-3" />
                    Add Tenant
                  </Button>
                }
              />
            </div>
          </Card>
        ))}

        {/* Show generic vacant units for properties without specific unit names */}
        {vacantUnits.length === 0 && vacantCount > 0 && Array.from({ length: vacantCount }, (_, i) => (
          <Card key={`vacant-generic-${i}`} className="p-4 border-dashed border-muted-foreground/30">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono font-bold text-lg">Vacant</div>
              <Badge variant="secondary">Vacant</Badge>
            </div>

            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground mb-2">Unit available</div>
              <AddTenantDialog
                defaultProperty={property.name}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-3" />
                    Add Tenant
                  </Button>
                }
              />
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
};

export default Units;