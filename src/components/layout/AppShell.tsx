import { ReactNode } from "react";
import { Sidebar, MobileNav } from "./Sidebar";
import { Topbar } from "./Topbar";

export const AppShell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <Sidebar />
    <div className="lg:pl-64">
      <Topbar title={title} subtitle={subtitle} />
      <main className="px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-[1600px] mx-auto">
        {children}
      </main>
    </div>
    <MobileNav />
  </div>
);
