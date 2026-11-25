import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type Props = {
  /** Where to go when there is nothing in the app's own history to return to. */
  to: string;
  label?: string;
  /** Hide the button entirely on the first screen of the app. */
  hideWhenIdle?: boolean;
  /** Show only the arrow on phones — used where the header is already crowded. */
  hideLabelOnSmall?: boolean;
  className?: string;
};

/**
 * One back affordance for every screen: walks the app's own history when the
 * user came from somewhere inside the CRM, and falls back to a fixed list
 * page when the screen was opened directly (bookmark, Telegram, new tab).
 */
export function BackButton({
  to,
  label = "Orqaga",
  hideWhenIdle = false,
  hideLabelOnSmall = false,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [canBack, setCanBack] = useState(false);

  useEffect(() => {
    const read = () => setCanBack(router.history.canGoBack());
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [router, pathname]);

  if (!canBack && hideWhenIdle) return null;

  const cls =
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary " +
    className;
  const labelNode = hideLabelOnSmall ? <span className="hidden lg:inline">{label}</span> : label;

  if (!canBack) {
    return (
      <Link to={to as never} className={cls} aria-label={label} title={label}>
        <ArrowLeft className="h-3.5 w-3.5" /> {labelNode}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => window.history.back()} className={cls} aria-label={label} title={label}>
      <ArrowLeft className="h-3.5 w-3.5" /> {labelNode}
    </button>
  );
}
