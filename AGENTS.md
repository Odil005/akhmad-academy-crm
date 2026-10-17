<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Individual tuition edits use the authenticated student-fees service and shared StudentFeeEditor; update enrollment prices (student fallback without active groups), never group defaults or existing invoices, to preserve other students and payment history.
- Internal CRM visual tokens are scoped to crm-theme, shared across all authenticated roles and applied to the document while mounted so dialogs inherit the theme without changing public pages or permissions.
- Mount the shared notification renderer once in the root and show managed-account creation errors inline; failed account creation must remain visible without weakening authentication protections.
- Student biometric capture uses lazy browser-only face-api inference with same-origin model files; matching runs in an authenticated staff service and overdue access is enforced by a database trigger to avoid stale-client bypasses.
- Student facial templates require three pose samples and recorded guardian-consent confirmation; preserve the enrollment photograph for the parent bot, but do not persist additional check-in photographs.
- Vite must deduplicate React and pre-optimize the router with the renderer so dependency refreshes do not mix React hook dispatchers in the preview.
- Verified student face events link to attendance transactionally in an invoker trigger after debt checks; resolve only one current enrolled lesson in Tashkent time, preserve manual marks, and expose unresolved outcomes rather than guess.
- Unified face presence uses server-side identity matching and an atomic presence RPC with explicit direction and per-person locking; this prevents repeated camera frames from alternating arrival/departure or duplicating attendance.
- Teacher phone activation accepts only Telegram-verified own contacts in private chats and an unambiguous staff phone/role match; an atomic service-only RPC preserves existing account links.
- Accounting AI uses the shared tool authorization and an execution guard to deny financial mutations; aggregate context totals in the database to avoid capped row-transfer calculations.
