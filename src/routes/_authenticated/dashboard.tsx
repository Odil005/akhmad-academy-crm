import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense, useEffect, useState } from "react";
import { Users, BookOpen, CreditCard, GraduationCap, TrendingUp } from "lucide-react";
import { CrmOverview } from "@/components/CrmOverview";
import { Button } from "@/components/ui/button";

// The administrator desk loads a large search index. Loading it only for admins
// keeps the director dashboard responsive on slower phones and computers.
const AdminDesk = lazy(() =>
  import("@/components/AdminDesk").then((module) => ({ default: module.AdminDesk })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Boshqaruv paneli | Akhmad CRM" },
    { name: "description", content: "Akhmad CRM o‘quvchilar, guruhlar, tushum va davomat boshqaruvi." },
    { property: "og:title", content: "Boshqaruv paneli | Akhmad CRM" },
    { property: "og:description", content: "O‘quv markazining joriy ko‘rsatkichlari va boshqaruvi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isAdminOnly = roles.includes("admin") && !roles.includes("director");
  const [deskOpen, setDeskOpen] = useState(false);

  if (isStaff) return <div className="space-y-4">
    <header className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0"><h1 className="text-xl font-bold">Boshqaruv paneli</h1><p className="mt-1 text-xs text-muted-foreground">{new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}</p></div>
      <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to="/students"><Users className="h-4 w-4" /> O‘quvchilar</Link></Button>{isAdminOnly && <Button size="sm" variant={deskOpen ? "secondary" : "default"} onClick={() => setDeskOpen(v => !v)}>{deskOpen ? "Ko‘rsatkichlar" : "Administrator ish stoli"}</Button>}</div>
    </header>
    {deskOpen ? <Suspense fallback={<DashboardLoading />}><AdminDesk /></Suspense> : <CrmOverview />}
  </div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Xush kelibsiz{user.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sizning roli: <b className="text-primary">{roles.join(", ") || "student"}</b>
        </p>
      </header>

      <StudentDashboard userId={user.id} />
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      Ish stoli yuklanmoqda...
    </div>
  );
}

function StudentDashboard({ userId }: { userId: string }) {
  const [student, setStudent] = useState<{
    id: string;
    status: string;
    group?: {
      name: string;
      monthly_fee: number;
      subject?: { name: string } | null;
    } | null;
  } | null>(null);
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      amount: number;
      period_month: string;
      status: string;
    }>
  >([]);

  useEffect(() => {
    (async () => {
      const { data: studentRow } = await supabase
        .from("students")
        .select("id, status, group:groups(name, monthly_fee, subject:subjects(name))")
        .eq("profile_id", userId)
        .maybeSingle();
      setStudent(studentRow as never);
      if (studentRow?.id) {
        const { data: paymentRows } = await supabase
          .from("payments")
          .select("id, amount, period_month, status")
          .eq("student_id", studentRow.id)
          .order("period_month", { ascending: false })
          .limit(24);
        setPayments(paymentRows ?? []);
      }
    })();
  }, [userId]);

  if (!student) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Siz hali biror guruhga biriktirilmagansiz. Iltimos, admin bilan bog'laning.
        </p>
      </div>
    );
  }

  const debt = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">Guruhim</div>
        <h2 className="mt-2 text-xl font-bold">{student.group?.name ?? "—"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fan: {student.group?.subject?.name ?? "—"}
        </p>
        <p className="mt-4 text-sm">
          Oylik to'lov:{" "}
          <b>
            {student.group?.monthly_fee ? Number(student.group.monthly_fee).toLocaleString() : 0}{" "}
            so'm
          </b>
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-destructive">
          Qarzdorlik
        </div>
        <h2 className="mt-2 text-3xl font-extrabold">
          {debt.toLocaleString()} <span className="text-base text-muted-foreground">so'm</span>
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {payments.filter((payment) => payment.status === "pending").length} ta to'lov kutilmoqda
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          To'lovlar tarixi
        </h3>
        <div className="mt-4 divide-y divide-border">
          {payments.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Hozircha yozuv yo'q</p>
          )}
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                {new Date(payment.period_month).toLocaleDateString("uz-UZ", {
                  year: "numeric",
                  month: "long",
                })}
              </span>
              <span className="font-semibold">{Number(payment.amount).toLocaleString()} so'm</span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${payment.status === "paid" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
              >
                {payment.status === "paid" ? "To'langan" : "Kutilmoqda"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
