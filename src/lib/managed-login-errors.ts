/** Keep provider details out of user-facing account forms. */
export function managedLoginError(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? "Login yaratilmadi. Qayta urinib ko'ring.";
  if (error?.code === "weak_password" || /known to be weak|easy to guess|weak password/i.test(message)) {
    return "Bu parol juda sodda yoki avval oshkor bo'lgan. Boshqa, noyob parol kiriting yoki Avto-generatsiya tugmasidan foydalaning.";
  }
  if (/password.*(?:at least|minimum|short)/i.test(message)) {
    return "Parol juda qisqa. Uzunroq parol kiriting yoki Avto-generatsiya tugmasidan foydalaning.";
  }
  return message;
}