import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense, useEffect, useState } from "react";
import { Users, BookOpen, CreditCard, GraduationCap, TrendingUp } from "lucide-react";
import { STATUS_META, STATUS_ORDER, type StudentStatus } from "@/lib/status";
import { SetupBanner } from "@/components/SetupBanner";
import { AttendanceReminder } from "@/components/AttendanceReminder";

// The administrator desk loads a large search index. Loading it only for admins
// keeps the director dashboard responsive on slower phones and computers.
const AdminDesk = lazy(() =>
  import("@/components/AdminDesk").then((module) => ({ default: module.AdminDesk })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isAdminOnly = roles.includes("admin") && !roles.includes("director");

  if (isAdminOnly) return <AdminDashboard />;

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

      {isStaff ? (
        <>
          <SetupBanner />
          <AttendanceReminder userId={user.id} teacherOnly={false} />
          <StaffDashboard />
        </>
      ) : (
        <StudentDashboard userId={user.id} />
      )}
    </div>
  );
}

function AdminDashboard() {
  const [showDesk, setShowDesk] = useState(false);
  if (showDesk) {
    return (
      <div className="space-y-6">
        <SetupBanner />
        <Suspense fallback={<DashboardLoading />}>
          <AdminDesk />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <SetupBanner />
      <AttendanceReminder userId="" teacherOnly={false} />
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Administrator boshqaruvi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tez ishlash uchun og'ir qidiruv oynasi faqat siz ochganingizda yuklanadi.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setShowDesk(true)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Administrator ish stolini ochish
          </button>
          <Link
            to="/students"
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold"
          >
            O'quvchilar
          </Link>
          <Link
            to="/payments"
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold"
          >
            To'lovlar
          </Link>
        </div>
      </section>
    </div>
  );
}

function StaffDashboard() {
  const [main, setMain] = useState({
    students: 0,
    groups: 0,
    subjects: 0,
    unpaid: 0,
    todayPayments: 0,
  });
  const [byStatus, setByStatus] = useState<Record<StudentStatus, number>>({
    trial: 0,
    active: 0,
    frozen: 0,
    archived: 0,
    left: 0,
  });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const results = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "paid")
          .gte("paid_at", today),
        ...STATUS_ORDER.map((status) =>
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("status_enum", status),
        ),
      ]);
      const [students, groups, subjects, unpaid, todayPayments, ...statusRows] = results;
      setMain({
        students: students.count ?? 0,
        groups: groups.count ?? 0,
        subjects: subjects.count ?? 0,
        unpaid: unpaid.count ?? 0,
        todayPayments: todayPayments.count ?? 0,
      });
      const counts: Record<StudentStatus, number> = {
        trial: 0,
        active: 0,
        frozen: 0,
        archived: 0,
        left: 0,
      };
      STATUS_ORDER.forEach((status, index) => {
        counts[status] = statusRows[index]?.count ?? 0;
      });
      setByStatus(counts);
    })();
  }, []);

  const cards = [
    {
      label: "Jami o'quvchilar",
      value: main.students,
      icon: Users,
      color: "text-primary",
      href: "/students",
    },
    {
      label: "Guruhlar",
      value: main.groups,
      icon: BookOpen,
      color: "text-primary",
      href: "/groups",
    },
    {
      label: "Fanlar",
      value: main.subjects,
      icon: GraduationCap,
      color: "text-primary",
    },
    {
      label: "Qarzdorlar",
      value: main.unpaid,
      icon: CreditCard,
      color: "text-destructive",
      href: "/payments",
    },
    {
      label: "Bugungi to'lovlar",
      value: main.todayPayments,
      icon: TrendingUp,
      color: "text-green-500",
      href: "/payments",
    },
  ];

  return (
    <>
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Umumiy
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => {
            const inner = (
              <>
                <card.icon className={`h-6 w-6 ${card.color}`} />
                <div className="mt-3 text-2xl font-extrabold">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </>
            );
            return card.href ? (
              <Link
                key={card.label}
                to={card.href}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                {inner}
              </Link>
            ) : (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-5">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          O'quvchilar statusi bo'yicha
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            return (
              <Link
                key={status}
                to="/students"
                search={{ status }}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.bg}`} />
                <div className="mt-3 text-2xl font-extrabold">{byStatus[status]}</div>
                <div className="text-xs text-muted-foreground">{meta.label}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
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
