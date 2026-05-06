import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Building2, User, Mail, Phone, Lock, MapPin, MessageSquare } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "login" | "register";
  onModeChange?: (mode: "login" | "register") => void;
}

export const AuthDialog = ({ open, onOpenChange, mode = "login", onModeChange }: AuthDialogProps) => {
  const { register, login, isLoading } = useData();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    city: "Nairobi",
    password: "",
    confirmPassword: "",
    preferredChannel: "whatsapp" as "whatsapp" | "sms" | "email",
    collectionMonthStart: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        if (form.password !== form.confirmPassword) {
          toast({
            title: "Passwords don't match",
            description: "Please make sure your passwords match.",
            variant: "destructive",
          });
          return;
        }

        await register({
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          city: form.city,
          password: form.password,
          preferredChannel: form.preferredChannel,
          collectionMonthStart: form.collectionMonthStart,
        });

        toast({
          title: "Welcome to PropertyHub!",
          description: "Your account has been created successfully.",
        });
      } else {
        await login(form.email, form.password);
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      }

      onOpenChange(false);
      navigate("/");
    } catch (error: any) {
      toast({
        title: mode === "register" ? "Registration failed" : "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      city: "Nairobi",
      password: "",
      confirmPassword: "",
      preferredChannel: "whatsapp",
      collectionMonthStart: 1,
    });
  };

  const switchMode = (newMode: "login" | "register") => {
    resetForm();
    onModeChange?.(newMode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            {mode === "register" ? "Create Your Account" : "Welcome Back"}
          </DialogTitle>
          <DialogDescription>
            {mode === "register"
              ? "Join PropertyHub Kenya to manage your properties and tenants."
              : "Sign in to access your property management dashboard."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 flex-1 px-1">
          {mode === "register" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="text-sm h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+254 ..."
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Optional"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="text-sm h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Collection Month Start</Label>
                <Select
                  value={form.collectionMonthStart.toString()}
                  onValueChange={(v) => setForm({ ...form, collectionMonthStart: parseInt(v) })}
                >
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Preferred Channel</Label>
                <Select
                  value={form.preferredChannel}
                  onValueChange={(v: any) => setForm({ ...form, preferredChannel: v })}
                >
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="text-sm h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">Password *</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="text-sm h-9"
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                className="text-sm h-9"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
            {isSubmitting
              ? (mode === "register" ? "Creating Account..." : "Signing In...")
              : (mode === "register" ? "Create Account" : "Sign In")
            }
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "register" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="text-primary hover:underline"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};