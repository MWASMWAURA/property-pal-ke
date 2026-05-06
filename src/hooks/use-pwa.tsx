import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      toast({
        title: "App installed!",
        description: "PropertyHub is now on your home screen.",
      });
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return { isInstallable, install };
};

export const PWAInstallPrompt = () => {
  const { isInstallable, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-card border border-border rounded-lg p-4 shadow-lg z-50">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg gradient-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Download className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Install PropertyHub</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add to your home screen for quick access and offline support.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDismissed(true)}
          variant="ghost"
          className="size-6 p-0 flex-shrink-0"
        >
          <X className="size-3" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={install} className="flex-1 gradient-primary text-primary-foreground">
          Install
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDismissed(true)} className="flex-1">
          Later
        </Button>
      </div>
    </div>
  );
};