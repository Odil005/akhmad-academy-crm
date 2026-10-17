import { createFileRoute, Link } from '@tanstack/react-router';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/face-id')({
  head: () => ({ meta: [
    { title: 'Xodim Face ID | Akhmad CRM' },
    { name: 'description', content: 'Akhmad CRM xodimlarning yagona Face ID davomati.' },
    { property: 'og:title', content: 'Xodim Face ID | Akhmad CRM' },
    { property: 'og:description', content: 'Xodimlarning yuz bilan tasdiqlangan kirish va chiqish qaydlari.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: EmployeeFace,
});

function EmployeeFace() {
  const { roles } = Route.useRouteContext();
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">Xodim Face ID</h1>
    <ScanFace className="size-10 text-primary" />
    {roles.some(role => role === 'admin' || role === 'director')
      ? <Button asChild><Link to="/face-checkin">Yagona Face ID</Link></Button>
      : <p className="text-sm text-muted-foreground">Administrator yuzingizni ro‘yxatga oladi. Kirish va chiqish markazdagi Face ID kamerasida qayd etiladi.</p>}
  </section>;
}