import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { FACE_MODEL, MATCH_LIMIT, matchSamples, samplesSchema } from '@/features/face/domain';

const captureSchema = z.object({
  studentId: z.string().uuid(),
  samples: samplesSchema,
  image: z.string().startsWith('data:image/jpeg;base64,').max(500000),
});

export const saveStudentFace = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => captureSchema.extend({ consent: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
    if (roleError || !roles?.some(r => r.role === 'admin' || r.role === 'director')) throw new Error('Faqat administrator va direktor yuzni ro‘yxatga oladi.');
    const { error } = await context.supabase.rpc('save_student_biometric_enrollment', {
      p_student_id: data.studentId, p_image: data.image, p_descriptors: data.samples,
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const verifyStudentFace = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => captureSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
    if (roleError || !roles?.some(r => r.role === 'admin' || r.role === 'director')) throw new Error('Kirish ruxsati yo‘q.');
    const { data: template, error } = await context.supabase.from('student_face_templates')
      .select('descriptors, model_version').eq('student_id', data.studentId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!template || template.model_version !== FACE_MODEL) throw new Error('Yuzni old, o‘ng va chap tomondan qayta ro‘yxatga oling.');
    const stored = samplesSchema.safeParse(template.descriptors);
    const score = stored.success ? matchSamples(data.samples, stored.data) : Infinity;
    if (score >= MATCH_LIMIT) throw new Error('Yuz mos kelmadi. Kirish qayd etilmadi.');
    const { data: row, error: writeError } = await context.supabase.from('student_face_checkins').insert({
      student_id: data.studentId, status: 'allowed', match_distance: score,
      // Keep no additional check-in photograph: enrollment image is sufficient for the parent bot.
    }).select('status, debt_amount, attendance_result, attendance_id, lesson_id').single();
    if (writeError) throw new Error(writeError.message);
    return row;
  });