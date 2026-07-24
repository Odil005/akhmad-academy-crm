import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LogOut, LayoutDashboard, Users, BookOpen, CreditCard, Menu, X, Settings, ShoppingBag, Smile, Search, Wallet, CalendarDays, ClipboardCheck, DoorOpen, BarChart3, Phone, ScanFace, GraduationCap, Inbox, Upload, MessageSquare, DollarSign, ChevronDown } from "lucide-react";
import { PremiumBackground } from "@/components/PremiumBackground";
import { Jarvis } from "@/components/Jarvis";
import logoAsset from "@/assets/akhmad-logo.png.asset.json";

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

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; show: boolean };

function AuthenticatedLayout() {
  const { user, roles } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user.id]);

  useEffect(() => {
    setMoreOpen(false);
    setOpen(false);
  }, [pathname]);

  const isStaff = roles.includes("director") || roles.includes("admin");
  const isAdmin = roles.includes("admin");
  const isDirector = roles.includes("director");
  const isTeacher = roles.includes("teacher");
  const canSeeGroups = isStaff || isTeacher;

  const nav: NavItem[] = [
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

  const visibleNav = nav.filter((n) => n.show);
  // Primary nav shown inline; the rest goes into a "More" menu
  const PRIMARY_COUNT = 7;
  const primaryNav = visibleNav.slice(0, PRIMARY_COUNT);
  const overflowNav = visibleNav.slice(PRIMARY_COUNT);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = roles[0] ?? "student";
  const fullName = profile?.full_name ?? user.email ?? "";

  return (
    <div className="relative min-h-screen text-foreground">
      <PremiumBackground />

      {/* Top navigation bar */}
      <header className="glass-strong sticky top-0 z-40 border-b border-primary/15">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:px-6">
          {/* Logo */}
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <img
              src={logoAsset.url}
              alt="Akhmad Academy"
              className="h-10 w-10 rounded-full object-cover shadow-md shadow-primary/20"
              width={40}
              height={40}
            />
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-extrabold tracking-tight">
                Akhmad <span className="gold-text">Academy</span>
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                CRM Platform
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-2 hidden flex-1 items-center gap-0.5 overflow-hidden xl:flex">
            {primaryNav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_oklch(0.82_0.16_82/0.55)]"
                      : "text-foreground/75 hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
            {overflowNav.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/75 transition hover:bg-primary/10 hover:text-primary"
                >
                  <Menu className="h-4 w-4" /> Ko'proq <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                    <div className="glass-strong absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-primary/15 p-2 shadow-2xl">
                      {overflowNav.map((n) => {
                        const active = pathname === n.to;
                        return (
                          <Link
                            key={n.to}
                            to={n.to}
                            onClick={() => setMoreOpen(false)}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/80 hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            <n.icon className="h-4 w-4" />
                            <span>{n.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(true)}
            className="ml-auto rounded-lg border border-primary/20 bg-card/40 p-2 transition hover:bg-primary/10 xl:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* User + signout (desktop) */}
          <div className="ml-auto hidden items-center gap-2 xl:flex">
            <div className="rounded-xl border border-primary/15 bg-card/40 px-3 py-1.5 text-right">
              <div className="max-w-[140px] truncate text-xs font-semibold">{fullName}</div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary">{primaryRole}</div>
            </div>
            <button
              onClick={signOut}
              className="rounded-xl border border-primary/15 bg-card/40 p-2 text-foreground/75 transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="glass-strong absolute inset-y-0 right-0 flex w-80 max-w-[90vw] flex-col border-l border-primary/15">
            <div className="flex items-center justify-between border-b border-primary/10 p-4">
              <div className="flex items-center gap-2.5">
                <img src={logoAsset.url} alt="" className="h-9 w-9 rounded-full" />
                <div>
                  <div className="text-sm font-extrabold">Akhmad <span className="gold-text">Academy</span></div>
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-primary/80">CRM</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg border border-primary/20 p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {visibleNav.map((n) => {
                const active = pathname === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80 hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <n.icon className="h-4 w-4" />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-primary/10 p-4">
              <div className="mb-3 rounded-xl border border-primary/15 bg-card/40 px-3 py-2.5">
                <div className="truncate text-sm font-semibold">{fullName}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">{primaryRole}</div>
              </div>
              <button
                onClick={signOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-card/40 px-3 py-2 text-sm font-semibold text-foreground/80 transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Chiqish
              </button>
            </div>
          </aside>
        </div>
      )}

      <main>
        <div key={pathname} className="animate-page-in mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
