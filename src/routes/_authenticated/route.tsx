import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
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
  ReceiptText,
  Calculator,

  Lock,


  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { JarvisLauncher } from '@/components/JarvisLauncher';
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
import { GlobalSearch } from "@/components/GlobalSearch";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformAccess } from "@/lib/platform.functions";
import { getMyCenterBrand } from "@/lib/tenant.functions";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

import { TourProvider, useTour } from "@/components/tour/TourProvider";
import { HelpCircle } from "lucide-react";
const logoAsset = { url: "/logo-256.webp?v=akhmad-20261019" };

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("crm-theme");
    return () => document.documentElement.classList.remove("crm-theme");
  }, []);
  const { lang, setLang, t } = useLanguage();


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

  // Intent preloading already warms the destination on link hover/focus.
  // Do not compete with the current page by loading three unrelated screens.

  const isStaff = hasStaffRole(roles);
  const isAdmin = hasAdminRole(roles);
  const isDirector = hasDirectorRole(roles);
  const isTeacher = roles.includes("teacher");
  const canSeeGroups = isStaff || isTeacher;
  const fetchPlatformAccess = useServerFn(getPlatformAccess);
  const fetchBrand = useServerFn(getMyCenterBrand);
  const { data: brand } = useQuery({ queryKey: ["center-brand"], queryFn: () => fetchBrand(), staleTime: 600_000 });
  const platformAccess = useQuery({ queryKey: ["platform", "access"], queryFn: () => fetchPlatformAccess(), staleTime: 300_000 });
  const isPlatformOwner = Boolean(platformAccess.data?.isOwner);

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
    { to: "/methodology", label: "Metodika", icon: BookOpen, show: true },
    { to: "/guide", label: "Video qo'llanma", icon: GraduationCap, show: true },


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
    { to: "/payroll", label: "Oylik hisobi", icon: Calculator, show: isStaff },
    { to: "/salary", label: "Oylik katalogi", icon: Wallet, show: isStaff },

    { to: "/leads", label: "Lidlar", icon: Inbox, show: isAdmin },
    { to: "/messages", label: "Xabarlar", icon: MessageSquare, show: isStaff || isTeacher },
    { to: "/rooms", label: "Xonalar", icon: DoorOpen, show: isStaff },
    { to: "/behavior", label: "Dars faolligi", icon: Smile, show: isTeacher },
    { to: "/face-id", label: "Face ID", icon: ScanFace, show: isTeacher },
    { to: "/face-checkin", label: "Face ID kirish", icon: ScanFace, show: isStaff },
    {
      to: "/teacher-kpi",
      label: "Oylik KPI",
      icon: GraduationCap,
      show: isStaff || isTeacher,
    },
    { to: "/marketplace", label: "Marketplace", icon: ShoppingBag, show: true },
    { to: "/reports", label: "Hisobotlar", icon: BarChart3, show: isDirector },
    { to: "/import", label: "Excel import", icon: Upload, show: isStaff },
    { to: "/platform", label: "UNI CRM Super Admin", icon: Building2, show: isDirector || isPlatformOwner },
    { to: "/settings", label: "Sozlamalar", icon: Settings, show: isStaff },
  ];

  const visibleNav = nav.filter((n) => n.show);

  // Administrator menyusi soddalashtiriladi: faqat 4 ta asosiy bo'lim,
  // qolganlari "Boshqa bo'limlar" ichida. Director menyusi to'liq qoladi.
  const adminSimplified = isAdmin && !isDirector;
  const ADMIN_PRIMARY = ["/dashboard", "/students", "/payments", "/groups"];
  const primaryNav = adminSimplified
    ? visibleNav.filter((n) => ADMIN_PRIMARY.includes(n.to))
    : [...visibleNav].sort((a, b) => (a.to === "/dashboard" ? -1 : b.to === "/dashboard" ? 1 : 0));
  const moreNav = adminSimplified ? visibleNav.filter((n) => !ADMIN_PRIMARY.includes(n.to)) : [];

  const signOut = async () => {
    clearAuthenticatedRouteCache();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = roles[0] ?? "student";
  const brandName = brand && !brand.is_flagship ? brand.name : "Akhmad Academy";
  const fullName = profile?.full_name ?? user.email ?? "";
  const initials = fullName.trim().slice(0, 2).toUpperCase();

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-3 py-4">
        <img
          src={brand && !brand.is_flagship ? (brand.logo_url ?? "/favicon.png") : logoAsset.url}
          alt={brandName}
          className="h-9 w-9 rounded-full object-cover"
          width={44}
          height={44}
          decoding="async"
          fetchPriority="high"
        />
        <div className={`min-w-0 leading-tight ${collapsed ? "lg:hidden" : ""}`}>
          <div className="text-sm font-extrabold text-sidebar-primary">
            {brandName.toUpperCase()}
          </div>
          <div className="text-[10px] font-medium text-sidebar-foreground/60">
            CRM
          </div>
        </div>
        <Button variant="ghost"
          onClick={() => setOpen(false)}
          className="ml-auto rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {primaryNav.map((n) => {
          const active = pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              title={t(n.label)}
              data-tour={`nav-${n.to}`}
              className={`flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-xs font-medium transition ${
                active
                  ? "crm-nav-active text-sidebar-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <n.icon className="h-[18px] w-[18px]" />
              <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{t(n.label)}</span>

            </Link>
          );
        })}

        {moreNav.length > 0 && (
          <div className="pt-2">
            <Button variant="ghost"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent"
            >
              <Menu className="h-[18px] w-[18px]" />
              <span className="flex-1 text-left">{t("Boshqa bo'limlar")}</span>
              <ChevronDown className={`h-4 w-4 transition ${moreOpen ? "rotate-180" : ""}`} />
            </Button>
            {moreOpen &&
              moreNav.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    title={t(n.label)}
              data-tour={`nav-${n.to}`}
                    className={`ml-3 flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm transition ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <n.icon className="h-4 w-4" />
                    <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{t(n.label)}</span>
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
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="truncate text-sm font-semibold">{fullName}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-primary">
              {primaryRole}
            </div>
          </div>
          <Button variant="ghost"
            onClick={signOut}
            className="rounded-lg p-2 text-sidebar-foreground/70 transition hover:bg-destructive/20 hover:text-destructive"
            title="Chiqish"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <TourProvider userId={user.id} roles={roles}>
    <div className="crm-theme crm-shell bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] lg:block ${collapsed ? "w-[68px]" : "w-[220px]"}`}>
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

      <div className={`min-w-0 transition-[padding] ${collapsed ? "lg:pl-[68px]" : "lg:pl-[220px]"}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-3 sm:flex md:px-5">
            <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" onClick={() => setCollapsed(v => !v)} title={collapsed ? "Menyuni ochish" : "Menyuni yig‘ish"} aria-label={collapsed ? "Menyuni ochish" : "Menyuni yig‘ish"}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <Button variant="ghost"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-border p-2 text-foreground/70 transition hover:bg-secondary lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {isStaff && <GlobalSearch />}

            <div
              className="col-span-2 ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5 sm:ml-auto"
              title={t("Til")}
            >
              {(["uz", "ru"] as const).map((code) => (
                <Button variant="ghost"
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase transition ${
                    lang === code
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/60 hover:bg-secondary"
                  }`}
                >
                  {code}
                </Button>
              ))}
            </div>

            <div className="hidden shrink-0 sm:block"><TourHelpButton /></div>

            {isStaff && <div className="hidden shrink-0 sm:block"><SystemAlertIndicator /></div>}
            {isStaff && <Button asChild variant="outline" size="sm" className="hidden shrink-0 md:inline-flex"><Link to="/messages"><MessageSquare /> Xabarlar</Link></Button>}
            {canSeeGroups && <Button asChild size="sm" className="hidden shrink-0 xl:inline-flex"><Link to="/groups"><BookOpen /> Guruhlar</Link></Button>}

            <Button variant="ghost"
              onClick={signOut}
              className="hidden shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition hover:text-destructive sm:block"
              title={t("Chiqish")}
            >
              <LogOut className="h-4 w-4" />
            </Button>

          </div>
        </header>

        <main>
          <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-5 md:py-5">
            <Outlet />
          </div>
        </main>
      </div>

      {(isStaff || isTeacher) && <JarvisLauncher />}
    </div>
    </TourProvider>
  );
}

function TourHelpButton() {
  const { start, openChecklist, progress } = useTour();
  return (
    <div className="ml-auto flex items-center gap-1 lg:ml-3">
      <Button variant="ghost"
        onClick={() => start(0)}
        data-tour="help-button"
        title="Tizimni o'rgatuvchi tur"
        className="rounded-xl border border-border p-2.5 text-foreground/70 transition hover:border-primary hover:text-primary"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <Button variant="ghost"
        onClick={openChecklist}
        title="Boshlash vazifalari"
        className="hidden rounded-xl border border-border px-3 py-2 text-xs font-bold text-primary transition hover:border-primary sm:block"
      >
        {progress}%
      </Button>
    </div>
  );
}
