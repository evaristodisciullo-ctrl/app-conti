# In Ordine V2 — clean Android rebuild

This branch is the clean rebuild of In Ordine. The legacy implementation remains only as a functional reference.

## Non-negotiable behavior

- Real balance changes only for actually received income or actually paid expenses.
- Future/scheduled entries never change the real balance.
- Movements contains only completed money operations.
- Income/expense recurrence, filters, categories, supplier, month navigation and monthly totals remain supported.
- Todo supports active/completed tasks, per-item reminders, month/year filters, date ordering, settings and immediate theme/color changes.
- Data must survive navigation, reload, Android process restart and app relaunch.
- Android layout is mobile-first, safe-area aware, width-stable and must never depend on screenshot-sized fixed dimensions.

## V2 architecture rule

Do not append CSS/JS patches to the legacy monolith. V2 code must live in dedicated modules with a single responsive stylesheet and a single state/persistence layer.

Persistence uses Capacitor Preferences on native Android with a web fallback only for browser development. State migrations must preserve compatible legacy data when available.

## Validation gates

Before a V2 APK is presented for device testing:

1. Functional flows pass.
2. Persistence test writes data, reloads/reinitializes and reads the same data.
3. Responsive checks cover common phone widths and different viewport heights.
4. No horizontal overflow on any route.
5. Safe-area/status-bar spacing is consistent on every screen.
6. Android APK build passes.
