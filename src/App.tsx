import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import { DataProvider } from "./lib/data-store";
import { OnboardingDialog } from "./components/onboarding/OnboardingDialog";
import { TourGuide } from "./components/onboarding/TourGuide";
import { PWAInstallPrompt } from "./hooks/use-pwa";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DataProvider>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
          <OnboardingDialog />
          <TourGuide />
          <PWAInstallPrompt />
        </DataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
