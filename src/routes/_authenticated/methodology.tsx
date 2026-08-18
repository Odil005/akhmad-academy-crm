import { createFileRoute } from "@tanstack/react-router";
import { MethodologyLibrary } from "@/components/MethodologyLibrary";
import { isStaff as hasStaffRole } from "@/lib/authz";

export const Route = createFileRoute("/_authenticated/methodology")({
  component: MethodologyPage,
  head: () => ({
    meta: [
      { title: "Metodika kutubxonasi · Akhmad Academy" },
      {
        name: "description",
        content:
          "Har bir fan va daraja uchun tavsiya etilgan metodika kitoblari, qo'llanmalar va dars rejalari — o'qituvchi va o'quvchi uchun.",
      },
      { property: "og:title", content: "Metodika kutubxonasi · Akhmad Academy" },
      {
        property: "og:description",
        content: "Fan va daraja bo'yicha metodika kitoblari va qo'llanmalar ro'yxati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MethodologyPage() {
  const { roles } = Route.useRouteContext();
  const canEdit = hasStaffRole(roles) || roles.includes("teacher");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Metodika kutubxonasi</h1>
        <p className="text-sm text-muted-foreground">
          Fan va daraja bo'yicha darsliklar, qo'llanmalar va metodik izohlar. O'qituvchi yangi
          manba qo'shsa, o'quvchi va ota-ona darhol ko'radi.
        </p>
      </header>
      <MethodologyLibrary canEdit={canEdit} title="Barcha fanlar bo'yicha metodika" />
    </div>
  );
}
