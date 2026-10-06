# Mad Juliana’s Tenants Payment

A local-first tenant payment tracker based on the Music Money app shell.

Features: one property/group, tenant profiles, payment coverage, 6-month/1-year/2-year/custom extensions, smart custom-amount coverage in months + days, payment history, generated TENANCY AGREEMENT image receipts, undo after changes, reminders view, export backup.

Custom payments use the tenant's monthly rate and calendar month length to estimate the exact coverage period. Example: GHS 1,000 at GHS 160/month = 6 months + 7 days when the coverage begins on July 1.


## v2.1.1 additions
- House/J app icon.
- Copy Updated Prices package: copies residents, monthly rates, currencies, phone numbers and coverage dates as JSON.
- Paste Updated Prices: applies matching resident/rate updates without overwriting payment history, with Undo.
- App version shown in Settings.


### Amount-driven coverage
The payment form now treats the amount as the source of truth for coverage. As the amount is typed, the app immediately calculates the whole months plus any remaining days it covers at the tenant’s monthly rate. The preset 6-month, 1-year, and 2-year buttons fill the matching amount; changing that amount recalculates the coverage automatically.


## v2.1.2 update links
Settings now provides Copy update link and Paste Update Link. The link contains the current resident names, monthly prices, currencies, phone numbers, and dates. Applying an update changes resident details/prices without changing existing payment history, and Undo is available. JSON remains available only as a backup option.


### Clipboard resident updates
Copy Updated Prices copies a compact update link to the clipboard. On another device, use Paste Updated Prices; the app reads the clipboard, shows the last-changed date, app version, and resident prices, then waits for “Okay, add update” before changing anything. Existing payment history is preserved.


## Durable local storage (v2.1.6)
The app keeps tenant and payment records in browser localStorage and a second IndexedDB copy. On startup it restores the newest local copy, and it requests persistent browser storage where supported. This protects records against normal refreshes, closing the app, and long periods of inactivity better than localStorage alone. Data is still device/browser-local; use the full backup or update-link tools to move data to another device/browser.


### ECG bill deduction (v2.2.3.29)
When recording a payment, an optional ECG bill deduction can be entered. The app subtracts the ECG amount from the rent value before calculating coverage, so a GHS 960 payment at GHS 160/month with a GHS 320 ECG deduction covers 4 months. ECG deduction details appear on the tenancy-agreement receipt only when a deduction was entered.


## v2.3.5.30 Payments time-left

- Payments list and resident detail now show how long each payment covered and how much time is left (e.g. "12 months paid · About 8 months left"), or "Completed" / "Starts in…" when applicable.

## v2.3.5.29 Cloud Sync
- Optional Supabase owner account using email/password.
- Local-first operation is preserved; cloud sync activates after sign-in.
- Tenant, payment, ECG deduction, and property data are synchronized through Supabase Postgres with Row Level Security.
- Realtime database changes are subscribed to so other open copies can refresh automatically.
- The browser uses only the Supabase publishable key; no service-role key is included in the app.
- Existing local records are uploaded when connecting to an empty cloud account.

## v2.3.5.30 fixes
- Newly added tenant details now remain visible without requiring a refresh, including monthly rate, when cloud sync is enabled.
- ECG sheet includes a Clear ECG bill action that restores the payment's original rent coverage.
- Swipe left on a tenant in People to reveal Delete; deletion asks for confirmation and provides Undo.
- Cloud deletion propagation keeps connected browsers consistent after a tenant is deleted.
