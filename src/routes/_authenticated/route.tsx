import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  Menu,
  X,
  Settings,
  ShoppingBag,
  Smile,
  Search,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  BarChart3,
  Phone,
  ScanFace,
  GraduationCap,
  MapPin,
  Inbox,
  Upload,
  MessageSquare,
  DollarSign,
  Brain,
  Target,
  AlertTriangle,
  Lock,


} from "lucide-react";
import { lazy, Suspense } from "react";
import {
  isAdmin as hasAdminRole,
  isDirector as hasDirectorRole,
  isStaff as hasStaffRole,
} from "@/lib/authz";
import {
  clearAuthenticatedRouteCache,
  getAuthenticatedRouteContext,
} from "@/lib/authenticated-route-cache";
import { SystemAlertIndicator } from "@/components/SystemAlertIndicator";
// Jarvis is a heavy assistant panel — keep it out of the initial bundle.
const Jarvis = lazy(() => import("@/components/Jarvis").then((m) => ({ default: m.Jarvis })));
const logoAsset = { url: "/logo-256.webp" };

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const context = await getAuthenticatedRouteContext();
    if (!context) throw redirect({ to: "/auth" });
    return context;
  },
  component: AuthenticatedLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
};

function AuthenticatedLayout() {
  const { user, roles } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
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
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const preloadCoreRoutes = () => {
      void Promise.all([
        router.preloadRoute({ to: "/students" }),
        router.preloadRoute({ to: "/groups" }),
        router.preloadRoute({ to: "/schedule" }),
      ]);
    };
    const timer = window.setTimeout(preloadCoreRoutes, 300);
    return () => window.clearTimeout(timer);
  }, [router]);

  const isStaff = hasStaffRole(roles);
  const isAdmin = hasAdminRole(roles);
  const isDirector = hasDirectorRole(roles);
  const isTeacher = roles.includes("teacher");
  const canSeeGroups = isStaff || isTeacher;

  const nav: NavItem[] = [
    { to: "/teacher-panel", label: "O'qituvchi paneli", icon: Users, show: isTeacher },
    {
      to: "/video-lessons",
      label: "Video darslar",
      icon: GraduationCap,
      show: isTeacher || roles.includes("student"),
    },
    { to: "/knowledge-game", label: "Bilim o'yini", icon: Brain, show: true },
    { to: "/roadmap", label: "Maqsad xaritasi", icon: Target, show: true },

    { to: "/dashboard", label: "Boshqaruv", icon: LayoutDashboard, show: true },
    { to: "/students", label: "O'quvchilar", icon: Users, show: isStaff },
    { to: "/groups", label: "Guruhlar", icon: BookOpen, show: canSeeGroups },
    {
      to: "/teachers",
      label: "O'qituvchilar ro'yxati",
      icon: GraduationCap,
      show: isStaff,
    },
    { to: "/schedule", label: "Dars jadvali", icon: CalendarDays, show: true },
    { to: "/checkin-locations", label: "Face ID lokatsiya", icon: MapPin, show: isStaff },
    { to: "/attendance", label: "Davomat", icon: ClipboardCheck, show: isStaff || isTeacher },
    { to: "/payments", label: "To'lovlar", icon: CreditCard, show: isStaff },
    { to: "/finance", label: "Moliya", icon: DollarSign, show: isStaff },
    { to: "/debtors", label: "Qarzdorlar", icon: AlertTriangle, show: isStaff },
    { to: "/cash-shifts", label: "Kassa yopilishi", icon: Lock, show: isStaff },
    { to: "/leads", label: "Lidlar", icon: Inbox, show: isAdmin },
    { to: "/calls", label: "Qo'ng'iroqlar", icon: Phone, show: isStaff },
    { to: "/messages", label: "Xabarlar", icon: MessageSquare, show: isStaff || isTeacher },
    { to: "/rooms", label: "Xonalar", icon: DoorOpen, show: isStaff },
    { to: "/behavior", label: "Dars faolligi", icon: Smile, show: isTeacher },
    { to: "/face-id", label: "Face ID", icon: ScanFace, show: isTeacher },
    { to: "/teacher-balance", label: "O'qituvchi balansi", icon: Wallet, show: isStaff },
    {
      to: "/teacher-kpi",
      label: "Oylik KPI",
      icon: GraduationCap,
      show: isStaff || isTeacher,
    },
    { to: "/marketplace", label: "Marketplace", icon: ShoppingBag, show: true },
    { to: "/reports", label: "Hisobotlar", icon: BarChart3, show: isDirector },
    { to: "/import", label: "Excel import", icon: Upload, show: isStaff },
    { to: "/settings", label: "Sozlamalar", icon: Settings, show: isStaff },
  ];

  const visibleNav = nav.filter((n) => n.show);

  // Administrator menyusi soddalashtiriladi: faqat 4 ta asosiy bo'lim,
  // qolganlari "Boshqa bo'limlar" ichida. Director menyusi to'liq qoladi.
  const adminSimplified = isAdmin && !isDirector;
  const ADMIN_PRIMARY = ["/dashboard", "/students", "/payments", "/groups"];
  const primaryNav = adminSimplified
    ? visibleNav.filter((n) => ADMIN_PRIMARY.includes(n.to))
    : visibleNav;
  const moreNav = adminSimplified ? visibleNav.filter((n) => !ADMIN_PRIMARY.includes(n.to)) : [];

  const signOut = async () => {
    clearAuthenticatedRouteCache();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = roles[0] ?? "student";
  const fullName = profile?.full_name ?? user.email ?? "";
  const initials = fullName.trim().slice(0, 2).toUpperCase();

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <img
          src={logoAsset.url}
          alt="Akhmad Academy"
          className="h-11 w-11 rounded-full object-cover"
          width={44}
          height={44}
          decoding="async"
          fetchPriority="high"
        />
        <div className="leading-tight">
          <div className="text-sm font-extrabold tracking-[0.14em] text-sidebar-primary">
            AKHMAD
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sidebar-foreground/70">
            Academy
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {primaryNav.map((n) => {
          const active = pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <n.icon className="h-[18px] w-[18px]" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}

        {moreNav.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent"
            >
              <Menu className="h-[18px] w-[18px]" />
              <span className="flex-1 text-left">Boshqa bo'limlar</span>
              <ChevronDown className={`h-4 w-4 transition ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen &&
              moreNav.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`ml-3 flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm transition ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <n.icon className="h-4 w-4" />
                    <span className="truncate">{n.label}</span>
                  </Link>
                );
              })}
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{fullName}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-primary">
              {primaryRole}
            </div>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-sidebar-foreground/70 transition hover:bg-destructive/20 hover:text-destructive"
            title="Chiqish"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl">
            {SidebarInner}
          </div>
        </div>
      )}

      <div className="lg:pl-[264px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg border border-border p-2 text-foreground/70 transition hover:bg-secondary lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden text-lg font-bold tracking-tight md:block">
              Xush kelibsiz{fullName ? `, ${fullName.split(" ")[0]}` : ""}!
            </div>

            {isStaff && (
              <Link
                to="/search"
                className="ml-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition hover:border-accent"
              >
                <Search className="h-4 w-4" />
                <span className="truncate">O'quvchi yoki telefon raqamini qidiring</span>
              </Link>
            )}

            {isStaff && <SystemAlertIndicator />}

            <button
              onClick={signOut}
              className="ml-auto rounded-xl border border-border p-2.5 text-foreground/70 transition hover:border-destructive/40 hover:text-destructive lg:ml-3"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main>
          <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {(isStaff || isTeacher) && (
        <Suspense fallback={null}>
          <Jarvis />
        </Suspense>
      )}
    </div>
  );
}
