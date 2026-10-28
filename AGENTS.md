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
- Load the Jarvis panel on explicit launcher activation and keep route warming intent-based rather than preloading unrelated screens on mount, so primary content does not compete with unused modules.
- Dashboard financial charts use invoker aggregates with explicit browser calendar boundaries and a separate bounded activity read; growing transaction history must not be transferred to calculate totals. Global search aborts obsolete requests, and payment notifications load only for displayed payment IDs without blocking the list.
- Share overlapping dashboard reads by authenticated user only; discard settled promises so remounts reduce duplicate network work without caching financial values.
- Dispose the root auth subscription on unmount, including delayed subscription initialization, to prevent duplicate invalidations and repeated protected fetches.
- Primary student group writes create missing enrollments transactionally through an invoker trigger; active group subject/teacher edits synchronize enrollments without changing individual prices or payment history.
- Import group resolution keys include lesson time and reject ambiguous teacher/group matches, preventing different time slots from sharing the first matching group.
- Camera selection preserves the saved device, prefers external hardware, and falls back to built-in/front cameras; browser device labels are not a transport guarantee.
- GroupStudentDialog owns group-side student addition; create a student with the selected primary group so the existing enrollment trigger saves both atomically, without requiring a login.
- Structured group weekdays and time ranges sync lessons through an invoker trigger in the group-write transaction; archive generated slots rather than deleting attendance history, and broadcast lesson changes to open timetables.
- The flagship center is never billed, limited or suspended; tenant data (including biometric tables) carries center_id with restrictive own-center RLS so centers stay isolated in one database.
- Super Admin (/platform) access is the platform_owners row claimed once by a director; each center's website address is stored on the center and connected through Lovable domain settings.

- Markaz profili (nom/logo/telefon/manzil) faqat `updateMyCenter` server function orqali o'zgartiriladi — rol (director/admin) `context.supabase` bilan tekshiriladi va faqat o'z markazi (`user_centers` havolasi) yangilanadi; boshqa markazlarga yozish yo'q.
