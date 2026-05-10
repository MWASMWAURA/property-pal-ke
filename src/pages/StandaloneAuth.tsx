import { useState } from "react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { Building2 } from "lucide-react";

const StandaloneAuth = () => {
  const [authOpen, setAuthOpen] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot-password">("login");

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="size-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">PropertyHub Kenya</h1>
          <p className="text-muted-foreground mt-2">Manage your rentals smarter</p>
        </div>

        {/* Auth Dialog */}
        <AuthDialog
          open={authOpen}
          onOpenChange={setAuthOpen}
          mode={authMode}
          onModeChange={setAuthMode}
        />

        {/* Auth Links */}
        {!authOpen && (
          <div className="mt-6 space-y-2">
            <button
              onClick={openLogin}
              className="block w-full text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Sign in to your account
            </button>
            <div className="text-xs text-muted-foreground">
              Don't have an account?{" "}
              <button
                onClick={openRegister}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Get started
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-xs text-muted-foreground">
          <p>Built for Kenyan landlords</p>
        </div>
      </div>
    </div>
  );
};

export default StandaloneAuth;