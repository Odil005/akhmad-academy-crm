import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { FACE_MODEL, identifyFace, samplesSchema } from '@/features/face/domain';

export const saveStaffFace = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ userId: z.string().uuid(), image: z.string().startsWith('data:image/jpeg;base64,').max(500000), samples: samplesSchema, consent: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('save_staff_biometric_enrollment', { p_user_id: data.userId, p_image: data.image, p_descriptors: data.samples });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const recognizeFacePresence = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ samples: samplesSchema, direction: z.enum(['in', 'out']) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
    if (roleError || !roles?.some(r => r.role === 'admin' || r.role === 'director')) throw new Error('Kirish ruxsati yo‘q');
    // Read every enrollment, not only the API's default first 1,000 rows.
    const [students, staff] = await Promise.all([
      (async () => {
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const result = await context.supabase.from('student_face_templates').select('student_id, descriptors, model_version').order('student_id').range(offset, offset + 499);
          if (result.error) throw new Error(result.error.message);
          rows.push(...result.data);
          if (result.data.length < 500) return rows;
        }
      })(),
      (async () => {
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const result = await context.supabase.from('staff_face_templates').select('user_id, descriptors, model_version').order('user_id').range(offset, offset + 499);
          if (result.error) throw new Error(result.error.message);
          rows.push(...result.data);
          if (result.data.length < 500) return rows;
        }
      })(),
    ]);
    const candidates: { id: string; descriptors: number[][] }[] = [];
    for (const row of students) {
      const parsed = samplesSchema.safeParse(row.descriptors);
      if (parsed.success && row.model_version === FACE_MODEL) candidates.push({ id: `student:${row.student_id}`, descriptors: parsed.data });
    }
    for (const row of staff) {
      const parsed = samplesSchema.safeParse(row.descriptors);
      if (parsed.success && row.model_version === FACE_MODEL) candidates.push({ id: `staff:${row.user_id}`, descriptors: parsed.data });
    }
    const match = identifyFace(data.samples, candidates);
    if (!match) throw new Error('Yuz topilmadi yoki bir nechta shaxsga o‘xshash. Davomat yozilmadi.');
    const [kind, personId] = match.id.split(':');
    if (!personId || !kind) throw new Error('Shaxs topilmadi');
    const { data: event, error } = await context.supabase.rpc('record_face_presence', { p_person_id: personId, p_kind: kind, p_direction: data.direction, p_score: match.score });
    if (error) throw new Error(error.message);
    const person = kind === 'student'
      ? await context.supabase.from('students').select('first_name, last_name').eq('id', personId).single()
      : await context.supabase.from('profiles').select('full_name').eq('id', personId).single();
    if (person.error) throw new Error(person.error.message);
    const name = person.data && 'full_name' in person.data ? person.data.full_name : person.data && 'first_name' in person.data ? `${person.data.first_name} ${person.data.last_name}` : '—';
    return { event: event as { status: string; attendance_result?: string; debt_amount?: number }, name };
  });