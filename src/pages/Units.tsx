import { useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/lib/data-store";
import { formatKsh } from "@/lib/mock-data";
import { Building2, MapPin, User, Plus, ArrowLeft } from "lucide-react";
import { StatusPill } from "./Dashboard";
import { Link } from "react-router-dom";
import { AddTenantDialog } from "@/components/dialogs/AddTenantDialog";

const Units = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { properties, tenants } = useData();

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

  return (
    <AppShell title={`${property.name} Units`} subtitle={`${property.units} total · ${occupiedCount} occupied · ${vacantCount} vacant`}>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/properties">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4" />
            Back to Properties
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{property.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3" />
            {property.location}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {propertyTenants.map(tenant => (
          <Card key={tenant.id} className="p-4 border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono font-bold text-lg">{tenant.unit}</div>
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

        {Array.from({ length: vacantCount }, (_, i) => (
          <Card key={`vacant-${i}`} className="p-4 border-dashed border-muted-foreground/30">
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