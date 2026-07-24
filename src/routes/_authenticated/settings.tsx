import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Palette, ShoppingBag, Megaphone, MessageSquare, FileSpreadsheet, MapPin, BarChart3, BookOpen, GraduationCap, Star, Phone, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roles = (rolesRows ?? []).map((r) => r.role);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
    return { roles };
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  const { roles } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDirector = roles.includes("director");

  const tabs = [
    { to: "/settings/credentials", label: "Login generator", icon: KeyRound, show: true },
    { to: "/settings/subjects", label: "Fanlar", icon: BookOpen, show: isDirector },
    { to: "/settings/homepage-courses", label: "Bosh sahifa fanlari", icon: Star, show: isDirector },
    { to: "/settings/teachers", label: "O'qituvchilar darajasi", icon: GraduationCap, show: isDirector },
    { to: "/settings/grade-template", label: "Ota-ona xabar shabloni", icon: MessageSquare, show: isDirector },
    { to: "/settings/marketplace", label: "Marketplace", icon: ShoppingBag, show: true },
    { to: "/settings/design", label: "Dizayn & Homepage", icon: Palette, show: isDirector },
      { to: "/settings/contact", label: "Aloqa ma'lumotlari", icon: MapPin, show: isDirector },
      { to: "/settings/stats", label: "Bosh sahifa raqamlari", icon: BarChart3, show: true },
    { to: "/settings/news", label: "Yangiliklar & Bannerlar", icon: Megaphone, show: true },

    { to: "/settings/integrations", label: "Telegram / SMS", icon: MessageSquare, show: true },
    { to: "/settings/reports", label: "Excel & Word", icon: FileSpreadsheet, show: true },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Sozlamalar</h1>
        <p className="text-sm text-muted-foreground">
          {isDirector ? "Director — to'liq boshqaruv" : "Admin — operatsion sozlamalar"}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.filter((t) => t.show).map((t) => {
          const active = pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:border-primary/50"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
