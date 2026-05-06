import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard.tsx";
import Properties from "./pages/Properties.tsx";
import Units from "./pages/Units.tsx";
import Tenants from "./pages/Tenants.tsx";
import Collections from "./pages/Collections.tsx";
import Maintenance from "./pages/Maintenance.tsx";
import Messages from "./pages/Messages.tsx";
import Reports from "./pages/Reports.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";
import Landing from "./pages/Landing.tsx";
import Pricing from "./pages/Pricing.tsx";
import { DataProvider, useData } from "./lib/data-store";
import { OnboardingDialog } from "./components/onboarding/OnboardingDialog";
import { TourGuide } from "./components/onboarding/TourGuide";
import { PWAInstallPrompt } from "./hooks/use-pwa";
import { Button } from "./components/ui/button";
import { LogOut, User } from "lucide-react";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated, isLoading, logout, profile } = useData();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Public routes when not authenticated
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Protected routes when authenticated
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/properties/:propertyId/units" element={<Units />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Logout button in top right */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 shadow-sm">
          <User className="size-4" />
          <span className="text-sm font-medium">{profile?.name}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={logout}
            className="h-6 w-6 p-0"
          >
            <LogOut className="size-3" />
          </Button>
        </div>
      </div>
      <OnboardingDialog />
      <TourGuide />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DataProvider>
          <AppRoutes />
          <PWAInstallPrompt />
        </DataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
