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
  ScanFace,
  GraduationCap,
  Inbox,
  Upload,
  MessageSquare,
  DollarSign,
  Brain,
  Target,
  AlertTriangle,
  Calculator,

  Lock,


  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  CalendarCheck,
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
import { isParentOnly } from "@/lib/parent-portal";
import { readProfileName } from "@/lib/profile-name";

import { TourProvider, useTour } from "@/components/tour/TourProvider";
import { HelpCircle, UserPlus } from "lucide-react";
const logoAsset = { url: "/logo-256.webp?v=akhmad-20261019" };

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const context = await getAuthenticatedRouteContext();
    if (!context) throw redirect({ to: "/auth" });
    // Parent accounts use their own app and never enter the staff CRM.
    if (isParentOnly(context.roles)) throw redirect({ to: "/ota-ona" });
    // Telegram applicants have no role until an admin approves them.
    if (context.roles.length === 0) throw redirect({ to: "/tg" });
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
type NavSection = { title: string; items: NavItem[]; collapsible?: boolean };

const ROLE_LABELS: Record<string, string> = {
  director: "Direktor",
  admin: "Administrator",
  teacher: "O'qituvchi",
  student: "O'quvchi",
};


function AuthenticatedLayout() {
  const { user, roles } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useQuery({ queryKey: ["profile-name", user.id], queryFn: () => readProfileName(user.id), staleTime: 300_000 });
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("crm-theme");
    return () => document.documentElement.classList.remove("crm-theme");
  }, []);
  const { lang, setLang, t } = useLanguage();


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

  // Ixcham menyu: kundalik ish bo'limlari guruhlangan, kam ishlatiladiganlari
  // "Boshqa" ichida yig'ilgan. Yashirilgan sahifalar manzil orqali ochilaveradi.
  const isStudent = roles.includes("student") && !isStaff && !isTeacher;
  const sections: NavSection[] = [
    {
      title: "Asosiy",
      items: [
        { to: "/dashboard", label: "Boshqaruv", icon: LayoutDashboard, show: true },
        { to: "/teacher-panel", label: "O'qituvchi paneli", icon: Users, show: isTeacher },
        { to: "/students", label: "O'quvchilar", icon: Users, show: isStaff },
        { to: "/arizalar", label: "Yangi arizalar", icon: UserPlus, show: isAdmin || isDirector },
        { to: "/groups", label: "Guruhlar", icon: BookOpen, show: canSeeGroups },
        { to: "/teachers", label: "O'qituvchilar", icon: GraduationCap, show: isStaff },
        { to: "/schedule", label: "Dars jadvali", icon: CalendarDays, show: true },
        { to: "/attendance", label: "Davomat", icon: ClipboardCheck, show: isStaff || isTeacher },
      ],
    },
    {
      title: "Moliya",
      items: [
        { to: "/payments", label: "To'lovlar", icon: CreditCard, show: isStaff },
        { to: "/debtors", label: "Qarzdorlar", icon: AlertTriangle, show: isStaff },
        { to: "/cash-shifts", label: "Kassa yopilishi", icon: Lock, show: isStaff },
        { to: "/finance", label: "Kirim-chiqim", icon: DollarSign, show: isStaff },
        { to: "/salary", label: "Xodimlar oyligi", icon: Wallet, show: isStaff },
      ],
    },
    {
      title: "O'qish",
      items: [
        { to: "/behavior", label: "Dars faolligi", icon: Smile, show: isTeacher },
        { to: "/video-lessons", label: "Video darslar", icon: GraduationCap, show: isTeacher || isStudent },
        { to: "/methodology", label: "Metodika", icon: BookOpen, show: isTeacher },
        { to: "/knowledge-game", label: "Bilim o'yini", icon: Brain, show: isStudent },
        { to: "/roadmap", label: "Maqsad xaritasi", icon: Target, show: isStudent },
        { to: "/marketplace", label: "Marketplace", icon: ShoppingBag, show: isStudent },
      ],
    },
    {
      title: "Boshqa",
      collapsible: true,
      items: [
        { to: "/leads", label: "Lidlar", icon: Inbox, show: isAdmin },
        { to: "/messages", label: "Xabarlar", icon: MessageSquare, show: isStaff || isTeacher },
        { to: "/reports", label: "Hisobotlar", icon: BarChart3, show: isDirector },
        { to: "/payroll", label: "O'qituvchi ulushi", icon: Calculator, show: isStaff },
        { to: "/import", label: "Excel import", icon: Upload, show: isStaff },
        { to: "/face-checkin", label: "Face ID kirish", icon: ScanFace, show: isStaff },
        { to: "/rooms", label: "Xonalar", icon: DoorOpen, show: isStaff },
        { to: "/guide", label: "Video qo'llanma", icon: HelpCircle, show: isStaff || isTeacher },
        { to: "/platform", label: "UNI CRM Super Admin", icon: Building2, show: isDirector || isPlatformOwner },
      ],
    },
    {
      title: "",
      items: [{ to: "/settings", label: "Sozlamalar", icon: Settings, show: isStaff }],
    },
  ]
    .map((sec) => ({ ...sec, items: sec.items.filter((n) => n.show) }))
    .filter((sec) => sec.items.length > 0);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const moreActive = sections.some((sec) => sec.collapsible && sec.items.some((n) => isActive(n.to)));
  const showMore = moreOpen || moreActive;

  const signOut = async () => {
    clearAuthenticatedRouteCache();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = roles[0] ?? "student";
  const roleLabel = ROLE_LABELS[primaryRole] ?? primaryRole;
  const brandName = brand && !brand.is_flagship ? brand.name : "Akhmad Academy";
  const brandLogo = brand && !brand.is_flagship ? (brand.logo_url ?? "/favicon.png") : logoAsset.url;
  const fullName = profile?.full_name ?? user.email ?? "";
  const initials = fullName.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Telefondagi pastki menyu: rolga qarab eng ko'p ishlatiladigan 4 bo'lim + "Menyu".
  const tabs: Array<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }> = isStaff
    ? [
        { to: "/dashboard", label: "Bosh sahifa", icon: Home },
        { to: "/students", label: "O'quvchilar", icon: Users },
        { to: "/payments", label: "To'lov", icon: Wallet },
        { to: "/attendance", label: "Davomat", icon: CalendarCheck },
      ]
    : isTeacher
      ? [
          { to: "/teacher-panel", label: "Panel", icon: Home },
          { to: "/groups", label: "Guruhlar", icon: BookOpen },
          { to: "/attendance", label: "Davomat", icon: CalendarCheck },
          { to: "/schedule", label: "Jadval", icon: CalendarDays },
        ]
      : [
          { to: "/dashboard", label: "Bosh sahifa", icon: Home },
          { to: "/schedule", label: "Jadval", icon: CalendarDays },
          { to: "/video-lessons", label: "Darslar", icon: GraduationCap },
        ];

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-3 py-4">
        <img
          src={brandLogo}
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

      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {sections.map((sec) => {
          const hidden = sec.collapsible && !showMore;
          return (
            <div key={sec.title || "end"} className="space-y-0.5">
              {sec.title && (sec.collapsible ? (
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={`flex w-full items-center justify-between px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/45 hover:text-sidebar-foreground/80 ${collapsed ? "lg:justify-center" : ""}`}
                  aria-expanded={showMore}
                >
                  <span className={collapsed ? "lg:hidden" : ""}>{t(sec.title)}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showMore ? "rotate-180" : ""}`} />
                </button>
              ) : (
                <div className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/45 ${collapsed ? "lg:hidden" : ""}`}>{t(sec.title)}</div>
              ))}
              {!hidden && sec.items.map((n) => {
                const active = isActive(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    title={t(n.label)}
                    data-tour={`nav-${n.to}`}
                    className={`flex items-center gap-3 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "crm-nav-active text-sidebar-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <n.icon className="h-4 w-4 shrink-0" />
                    <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{t(n.label)}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-1 rounded-lg border border-sidebar-border p-1 lg:hidden" aria-label={t("Til")}>
          {(["uz", "ru"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`flex-1 rounded-md py-1.5 text-xs font-bold uppercase ${lang === code ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/60"}`}
            >
              {code === "uz" ? "O'zbekcha" : "Русский"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="truncate text-sm font-semibold">{fullName}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-primary">
              {roleLabel}
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
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:pt-0">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:flex-nowrap lg:px-5 lg:py-3">
            <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" onClick={() => setCollapsed(v => !v)} title={collapsed ? "Menyuni ochish" : "Menyuni yig‘ish"} aria-label={collapsed ? "Menyuni ochish" : "Menyuni yig‘ish"}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>

            {/* Telefon: ilova sarlavhasi — logo, markaz nomi, qo'ng'iroqcha va profil */}
            <Link to={tabs[0]?.to ?? "/dashboard"} className="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
              <img src={brandLogo} alt={brandName} width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-accent/40" />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-base font-extrabold">{brandName}</div>
                <div className="truncate text-xs text-muted-foreground">{roleLabel} · CRM</div>
              </div>
            </Link>

            {isStaff && <div className="order-last w-full pb-1 lg:order-none lg:w-auto lg:flex-1 lg:pb-0"><GlobalSearch /></div>}

            <div
              className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5 lg:flex"
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

            <div className="hidden shrink-0 lg:block"><TourHelpButton /></div>

            {isStaff && <div className="shrink-0"><SystemAlertIndicator /></div>}
            {isStaff && <Button asChild variant="outline" size="sm" className="hidden shrink-0 lg:inline-flex"><Link to="/messages"><MessageSquare /> Xabarlar</Link></Button>}
            {canSeeGroups && <Button asChild size="sm" className="hidden shrink-0 xl:inline-flex"><Link to="/groups"><BookOpen /> Guruhlar</Link></Button>}

            <Button variant="ghost"
              onClick={signOut}
              className="hidden shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition hover:text-destructive lg:block"
              title={t("Chiqish")}
            >
              <LogOut className="h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Profil va menyu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-extrabold text-primary-foreground lg:hidden"
            >
              {initials || "?"}
            </button>
          </div>
        </header>

        <main>
          <div className="mx-auto max-w-[1600px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 lg:px-5 lg:py-5">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Telefon: pastki menyu (ilova uslubi) */}
      <nav
        aria-label="Asosiy bo'limlar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {tabs.map((tab) => {
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <tab.icon className="h-6 w-6" />
                <span className="truncate">{t(tab.label)}</span>
                {active && <span className="absolute bottom-0.5 h-1 w-8 rounded-full bg-primary" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold ${open ? "text-primary" : "text-muted-foreground"}`}
          >
            <Menu className="h-6 w-6" />
            <span>{t("Menyu")}</span>
          </button>
        </div>
      </nav>

      {(isStaff || isTeacher) && <JarvisLauncher phoneHidden={pathname === "/attendance"} />}
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
