import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Building2, MessageSquare, CheckCircle2 } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "login" | "register" | "forgot-password";
  onModeChange?: (mode: "login" | "register" | "forgot-password") => void;
}

export const AuthDialog = ({
  open,
  onOpenChange,
  mode = "login",
  onModeChange,
}: AuthDialogProps) => {
  const { register, login, isLoading } = useData();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

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
    setCurrentStep(1);
    setOtpCode("");
    setPhoneVerified(false);
    setOtpSent(false);
  };

  const switchMode = (newMode: "login" | "register" | "forgot-password") => {
    resetForm();
    onModeChange?.(newMode);
  };

  const sendOTP = async () => {
    if (!form.name || !form.phone) {
      toast({
        title: "Required Fields",
        description: "Please fill in your name and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("📱 Attempting to send OTP from:", navigator.userAgent);
      console.log("📡 Sending to phone:", form.phone);

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, purpose: "registration" }),
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response headers:", Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log("📦 Response data:", result);

      if (result.success) {
        setOtpSent(true);
        setCurrentStep(2);
        toast({
          title: "Code Sent!",
          description: `A verification code was sent to ${form.phone}.`,
        });
      } else {
        toast({
          title: "Failed to send code",
          description: result.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send verification code.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOTP = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, code: otpCode }),
      });
      const result = await response.json();

      if (result.success) {
        setPhoneVerified(true);
        setCurrentStep(3);
        toast({
          title: "Phone Verified ✓",
          description: "Your phone number has been verified successfully.",
        });
      } else {
        toast({
          title: "Invalid Code",
          description: result.error || "Please check your code and try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to verify code.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }
    if (!phoneVerified) {
      toast({
        title: "Phone not verified",
        description: "Please go back and verify your phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
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
      onOpenChange(false);
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(form.email, form.password);
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      onOpenChange(false);
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Reset Link Sent!",
          description: "Check your email for password reset instructions.",
        });
        switchMode("login");
      } else {
        toast({
          title: "Failed to send reset link",
          description: result.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send reset link.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = ["Your Info", "Verify Phone", "Set Password"];

  const stepDescriptions = [
    "Tell us about yourself and how we can reach you.",
    `Enter the 6-digit code sent to ${form.phone || "your phone"}.`,
    "Almost done — set up your login credentials.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="size-5" />
            {mode === "register" ? "Create Your Account" : mode === "forgot-password" ? "Reset Password" : "Welcome Back"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {mode === "register"
              ? stepDescriptions[currentStep - 1]
              : mode === "forgot-password"
              ? "Enter your email address and we'll send you a reset link."
              : "Sign in to access your property management dashboard."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator — register only */}
        {mode === "register" && (
          <div className="flex items-center justify-center gap-1 py-2">
            {stepLabels.map((label, i) => {
              const step = i + 1;
              const isComplete = step < currentStep;
              const isActive = step === currentStep;
              return (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        isComplete
                          ? "bg-green-500 text-white"
                          : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="size-4" /> : step}
                    </div>
                    <span
                      className={`text-[10px] font-medium hidden sm:block ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-10 h-0.5 mb-4 mx-1 transition-colors ${
                        step < currentStep ? "bg-green-500" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 1: Basic Info + Phone ── */}
        {mode === "register" && currentStep === 1 && (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm">
                  Company
                </Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Optional"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm">
                  City
                </Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Nairobi"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Collection Start Day</Label>
                <Select
                  value={form.collectionMonthStart.toString()}
                  onValueChange={(v) =>
                    setForm({ ...form, collectionMonthStart: parseInt(v) })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                        {day === 1
                          ? "st"
                          : day === 2
                          ? "nd"
                          : day === 3
                          ? "rd"
                          : "th"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Preferred Channel</Label>
                <Select
                  value={form.preferredChannel}
                  onValueChange={(v: any) =>
                    setForm({ ...form, preferredChannel: v })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+254 700 000 000"
                className="h-9 text-sm"
              />
            </div>

            <Button
              onClick={sendOTP}
              disabled={isSubmitting || !form.name || !form.phone}
              className="w-full"
            >
              {isSubmitting ? (
                "Sending Code..."
              ) : (
                <>
                  <MessageSquare className="size-4 mr-2" />
                  Send Verification Code
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        )}

        {/* ── STEP 2: OTP Verification ── */}
        {mode === "register" && currentStep === 2 && (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-muted/50 p-4 text-center space-y-1">
              <p className="text-sm font-medium">Code sent to</p>
              <p className="text-base font-semibold text-primary">{form.phone}</p>
              <p className="text-xs text-muted-foreground">
                Didn't receive it?{" "}
                <button
                  type="button"
                  onClick={sendOTP}
                  disabled={isSubmitting}
                  className="text-primary hover:underline"
                >
                  Resend
                </button>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm">
                6-Digit Verification Code
              </Label>
              <Input
                id="otp"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] h-12 font-mono"
                maxLength={6}
                autoFocus
              />
            </div>

            <Button
              onClick={verifyOTP}
              disabled={isSubmitting || otpCode.length !== 6}
              className="w-full"
            >
              {isSubmitting ? "Verifying..." : "Verify & Continue"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setCurrentStep(1)}
            >
              ← Back
            </Button>
          </div>
        )}

        {/* ── STEP 3: Email & Password ── */}
        {mode === "register" && currentStep === 3 && (
          <form onSubmit={handleRegister} className="space-y-4 pt-1">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
              <CheckCircle2 className="size-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                Phone verified: {form.phone}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                className="h-9 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Create a strong password"
                className="h-9 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                placeholder="Repeat your password"
                className="h-9 text-sm"
                required
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                isSubmitting ||
                isLoading ||
                !form.email ||
                !form.password ||
                form.password !== form.confirmPassword
              }
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setCurrentStep(2)}
            >
              ← Back
            </Button>
          </form>
        )}

        {/* ── FORGOT PASSWORD MODE ── */}
        {mode === "forgot-password" && (
          <form onSubmit={handleForgotPassword} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                className="h-9 text-sm"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── LOGIN MODE ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                className="h-9 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                className="h-9 text-sm"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => onModeChange?.('forgot-password')}
                className="text-primary hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-primary hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};