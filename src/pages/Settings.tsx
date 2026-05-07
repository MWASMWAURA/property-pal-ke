import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { User, Building2, Mail, Phone, MapPin, MessageSquare } from "lucide-react";

const Settings = () => {
  const { profile, saveProfile, startDemo, resetToOwnData } = useData();

  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    company: profile?.company || "",
    city: profile?.city || "",
    preferredChannel: profile?.preferredChannel || "whatsapp",
    collectionMonthStart: profile?.collectionMonthStart || 1,
  });

  const handleSave = () => {
    if (!form.name || !form.email) {
      toast({ title: "Required fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    saveProfile(form);
    toast({ title: "Profile updated", description: "Your settings have been saved." });
  };

  return (
    <AppShell title="Settings" subtitle="Manage your profile and preferences">
      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center">
              <User className="size-5" />
            </div>
            <h2 className="text-xl font-bold">Profile Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="size-4" /> Full Name *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="size-4" /> Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="size-4" /> Phone ✓ Verified
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="+254 712 345 678"
                disabled={true}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="size-4" /> Company
              </Label>
              <Input
                id="company"
                value={form.company}
                onChange={e => setForm({...form, company: e.target.value})}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="size-4" /> City
              </Label>
              <Input
                id="city"
                value={form.city}
                onChange={e => setForm({...form, city: e.target.value})}
                placeholder="e.g. Nairobi"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="size-4" /> Preferred Communication Channel
              </Label>
              <Select value={form.preferredChannel} onValueChange={v => setForm({...form, preferredChannel: v as any})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp (Recommended)</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collectionMonthStart">Collection Month Start Day</Label>
              <Select value={form.collectionMonthStart.toString()} onValueChange={v => setForm({...form, collectionMonthStart: parseInt(v)})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When does your collection period start? Revenue charts will group payments by these custom months.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
              Save Changes
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Demo Mode</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Explore the app with sample Nairobi property data, or switch back to your own data.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startDemo}>
              Load Demo Data
            </Button>
            <Button variant="outline" onClick={resetToOwnData}>
              Use My Data
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default Settings;