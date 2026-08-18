import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O'qituvchilar ro'yxati sozlamalardan chiqarilib, o'z paneliga (/teachers) ko'chirildi.
 * Eski havolalar ishlashda davom etishi uchun bu marshrut yangi sahifaga yo'naltiradi.
 */
export const Route = createFileRoute("/_authenticated/settings/teachers")({
  beforeLoad: () => {
    throw redirect({ to: "/teachers", replace: true });
  },
});
