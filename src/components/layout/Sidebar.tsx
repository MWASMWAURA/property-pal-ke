import { NavLink } from "react-router-dom";
import { LayoutDashboard, Building2, Users, Wrench, MessageCircle, Receipt, FileBarChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/properties", icon: Building2, label: "Properties" },
  { to: "/tenants", icon: Users, label: "Tenants" },
  { to: "/collections", icon: Receipt, label: "Collections" },
  { to: "/maintenance", icon: Wrench, label: "Maintenance" },
  { to: "/messages", icon: MessageCircle, label: "WhatsApp" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
];

export const Sidebar = () => (
  <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar text-sidebar-foreground z-40">
    <div className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border">
      <div className="size-10 rounded-xl gradient-gold flex items-center justify-center font-bold text-sidebar-primary-foreground">P</div>
      <div>
        <div className="font-bold text-base text-sidebar-accent-foreground tracking-tight">PropertyHub</div>
        <div className="text-[11px] uppercase tracking-widest text-sidebar-primary font-semibold">Kenya</div>
      </div>
    </div>
    <nav className="flex-1 px-3 py-4 space-y-1">
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-tour={to === "/properties" ? "nav-properties" : to === "/tenants" ? "nav-tenants" : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )
          }
        >
          <Icon className="size-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
    <div className="p-4 border-t border-sidebar-border">
      <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50">
        <Settings className="size-[18px]" /> Settings
      </NavLink>
      <div className="mt-3 px-3 py-3 rounded-lg bg-sidebar-accent/40 flex items-center gap-3">
        <div className="size-9 rounded-full bg-sidebar-primary flex items-center justify-center font-bold text-sidebar-primary-foreground">JK</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-sidebar-accent-foreground truncate">James Kariuki</div>
          <div className="text-xs text-sidebar-foreground/70 truncate">Landlord · 4 properties</div>
        </div>
      </div>
    </div>
  </aside>
);

export const MobileNav = () => (
  <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-sidebar text-sidebar-foreground border-t border-sidebar-border z-40 px-2 py-2 flex justify-around">
    {nav.slice(0, 5).map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        end={to === "/"}
        data-tour={to === "/properties" ? "nav-properties" : to === "/tenants" ? "nav-tenants" : undefined}
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium",
            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70")
        }
      >
        <Icon className="size-5" />
        {label}
      </NavLink>
    ))}
  </nav>
);
