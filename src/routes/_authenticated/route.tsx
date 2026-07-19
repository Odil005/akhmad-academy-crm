import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LogOut, LayoutDashboard, Users, BookOpen, CreditCard, Menu, X, Settings, ShoppingBag, Smile, Search, Wallet, CalendarDays, ClipboardCheck, DoorOpen, BarChart3, Phone, ScanFace, GraduationCap, Inbox, Upload, MessageSquare, DollarSign } from "lucide-react";
import { PremiumBackground } from "@/components/PremiumBackground";

type Role = "director" | "admin" | "teacher" | "student";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as Role);
    return { user: data.user, roles };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, roles } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user.id]);

  const isStaff = roles.includes("director") || roles.includes("admin");
  const isAdmin = roles.includes("admin");
  const isDirector = roles.includes("director");
  const isTeacher = roles.includes("teacher");
  const canSeeGroups = isStaff || isTeacher;

  const nav: { to: string; label: string; icon: typeof Users; show: boolean }[] = [
    { to: "/teacher-panel", label: "O'qituvchi paneli", icon: Users, show: isTeacher },
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/search", label: "Qidiruv", icon: Search, show: isStaff },
    { to: "/leads", label: "Lidlar", icon: Inbox, show: isAdmin },
    { to: "/students", label: "O'quvchilar", icon: Users, show: isStaff },
    { to: "/groups", label: "Guruhlar", icon: BookOpen, show: canSeeGroups },
    { to: "/schedule", label: "Dars jadvali", icon: CalendarDays, show: true },
    { to: "/attendance", label: "Davomat", icon: ClipboardCheck, show: isStaff || isTeacher },
    { to: "/grades", label: "Baholar", icon: GraduationCap, show: true },
    { to: "/rooms", label: "Xonalar", icon: DoorOpen, show: isStaff },
    { to: "/payments", label: "To'lovlar", icon: CreditCard, show: isStaff },
    { to: "/finance", label: "Moliya", icon: DollarSign, show: isStaff },
    { to: "/behavior", label: "Xulq baholash", icon: Smile, show: isTeacher },
    { to: "/messages", label: "Xabarlar", icon: MessageSquare, show: isStaff || isTeacher },
    { to: "/marketplace", label: "Marketplace", icon: ShoppingBag, show: true },
    { to: "/teacher-balance", label: "O'qituvchi balansi", icon: Wallet, show: isDirector },
    { to: "/calls", label: "Qo'ng'iroqlar", icon: Phone, show: isStaff },
    { to: "/face-id", label: "Face ID", icon: ScanFace, show: isTeacher },
    { to: "/reports", label: "Hisobotlar", icon: BarChart3, show: isDirector },
    { to: "/import", label: "Excel import", icon: Upload, show: isStaff },
    { to: "/settings", label: "Sozlamalar", icon: Settings, show: isStaff },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = roles[0] ?? "student";

  return (
    <div className="relative min-h-screen text-foreground">
      <PremiumBackground />

      {/* Sidebar (desktop) */}
      <aside className="glass-strong fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-primary/10 lg:block">
        <SidebarInner
          nav={nav}
          pathname={pathname}
          fullName={profile?.full_name ?? user.email ?? ""}
          role={primaryRole}
          signOut={signOut}
        />
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-primary/10 px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg border border-primary/20 bg-card/40 p-2 transition hover:bg-primary/10">
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm font-extrabold">
          Edu<span className="gold-text">Nest</span> CRM
        </div>
        <button onClick={signOut} className="rounded-lg border border-primary/20 bg-card/40 p-2 transition hover:bg-destructive/10">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="glass-strong absolute inset-y-0 left-0 flex w-72 flex-col border-r border-primary/15">
            <div className="flex items-center justify-between p-4">
              <div className="text-sm font-bold">Menu</div>
              <button onClick={() => setOpen(false)} className="rounded-lg border border-primary/20 p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarInner
                nav={nav}
                pathname={pathname}
                fullName={profile?.full_name ?? user.email ?? ""}
                role={primaryRole}
                signOut={signOut}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div key={pathname} className="animate-page-in mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarInner({
  nav,
  pathname,
  fullName,
  role,
  signOut,
  onNavigate,
}: {
  nav: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; show: boolean }[];
  pathname: string;
  fullName: string;
  role: Role;
  signOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-primary/10 px-6 py-5">
        <div className="text-lg font-extrabold tracking-tight">
          Edu<span className="gold-text">Nest</span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">
          CRM Platform
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.filter((n) => n.show).map((n) => {
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.86_0.17_92/0.5)]"
                  : "text-foreground/75 hover:translate-x-0.5 hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-primary-foreground/70" />
              )}
              <n.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-primary/10 p-4">
        <div className="mb-3 rounded-xl border border-primary/15 bg-card/40 px-3 py-2.5">
          <div className="truncate text-sm font-semibold text-foreground">{fullName}</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            {role}
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-card/40 px-3 py-2 text-sm font-semibold text-foreground/80 transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Chiqish
        </button>
      </div>
    </div>
  );
}
