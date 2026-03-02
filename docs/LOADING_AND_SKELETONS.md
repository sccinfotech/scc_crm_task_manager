# Skeletons and Loading / Delay Reference

## Where the Skeletons are

Skeletons (loading placeholders with `animate-pulse`) are used in **Next.js route-level `loading.tsx`** files. There is **no artificial delay** for these: Next.js shows the skeleton until the page’s async data is ready.

| Location | Purpose |
|----------|---------|
| `app/dashboard/projects/loading.tsx` | Projects list page (table + filters) |
| `app/dashboard/projects/[project_id]/loading.tsx` | Project detail page (left/right columns) |
| `app/dashboard/leads/loading.tsx` | Leads list page |
| `app/dashboard/leads/[lead_id]/loading.tsx` | Lead detail page (left/right columns) |
| `app/dashboard/clients/loading.tsx` | Clients list page |
| `app/dashboard/clients/[client_id]/loading.tsx` | Client detail page (left/right columns) |
| `app/dashboard/users/loading.tsx` | Users list page |
| `app/dashboard/logs/loading.tsx` | Activity Logs page (table + filters) |
| `app/dashboard/settings/loading.tsx` | Technology & Tools page (grid) |
| `app/dashboard/quotations/loading.tsx` | Quotations list page (table + filters) |
| `app/dashboard/quotations/[quotation_id]/loading.tsx` | Quotation detail page (tabs + content) |
| `app/dashboard/loading.tsx` | Dashboard home (minimal placeholder) |

**Skeleton behavior:** They use Tailwind’s `animate-pulse` and gray blocks (`bg-gray-200`, `bg-gray-100`). **No fixed “loading time” or delay** is set; visibility lasts only as long as the server/data load for that route.

---

## Skeleton Format Guidelines (for new modules)

When adding a new dashboard module, **always create a `loading.tsx`** file in the route folder so users see a skeleton instead of a blank screen during navigation.

### Standard structure

1. **List/table pages** (e.g. Projects, Leads, Clients, Users, Logs):
   - Outer: `flex h-full flex-col p-2 sm:p-3 lg:p-4`
   - Header row: title placeholder (`h-8 w-24 animate-pulse rounded bg-gray-200`) + action button placeholder
   - Card: `flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col`
   - Filters row: `border-b border-gray-200 bg-white px-4 py-4` with filter placeholders (`h-10 animate-pulse rounded-lg bg-gray-200`)
   - Table: real `<thead>` with column labels + `<tbody>` with ~10 skeleton rows using `animate-pulse` and `bg-gray-200` blocks (keep lightweight for instant paint)

2. **Detail pages** (e.g. Client, Lead, Project detail):
   - Use a simple static `<header>` placeholder with breadcrumb (Link to parent + skeleton for current item name). Do **not** import the `Header` client component—it loads NotificationsBell and delays the skeleton.
   - Two-column layout: `flex flex-col lg:flex-row gap-4` with `w-full lg:w-1/2`
   - Left: profile card skeleton (avatar, name, pills) + content blocks
   - Right: list/panel skeleton with placeholder rows

3. **Grid pages** (e.g. Technology & Tools):
   - Header: title + action buttons as placeholders
   - Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5` with card placeholders

### Styling rules

- Use `animate-pulse` on skeleton elements
- Use `bg-gray-200` for primary blocks, `bg-gray-100` for secondary
- Match the layout of the actual page (e.g. same responsive breakpoints, table columns)

### Performance (skeleton must show instantly)

- **Keep skeletons lightweight** – fewer DOM nodes = faster paint. Use ~10 table rows (not 20), ~8 grid cards (not 12).
- **No client components in loading.tsx** – avoid importing `Header`, `NotificationsBell`, or other client components. Use a simple static `<header>` placeholder instead. This prevents loading/hydrating client JS before the skeleton appears.
- **No artificial delays** – never add `setTimeout`, `delay`, or similar. Next.js shows the skeleton immediately upon navigation.

---

## In-component loading (spinners, no skeleton)

These show a **spinner** while fetching; again **no extra delay** is added:

- **Work history** – `app/dashboard/projects/project-work-history.tsx` (spinner while `getProjectWorkHistory` runs)
- **Follow-ups** – `app/dashboard/projects/project-followups.tsx`, `app/dashboard/leads/lead-followups.tsx`, `app/dashboard/clients/client-followups.tsx` (spinner when list is empty and loading)
- **Internal notes** – `app/dashboard/clients/internal-notes-panel.tsx` (spinner when `loading && !isSilentRefresh`)

---

## Delays that are configured

### 1. Search debounce (filters)

Used so search doesn’t fire on every keystroke:

| File | Constant | Delay |
|------|----------|--------|
| `app/dashboard/leads/leads-filters.tsx` | `SEARCH_DEBOUNCE_MS` | **500 ms** |
| `app/dashboard/projects/projects-filters.tsx` | `SEARCH_DEBOUNCE_MS` | **300 ms** |
| `app/dashboard/clients/clients-filters.tsx` | `SEARCH_DEBOUNCE_MS` | **300 ms** |
| `app/components/users/users-filters.tsx` | (inline) | **300 ms** (from grep) |

### 2. Toast auto-close

| File | What | Value |
|------|------|--------|
| `app/components/ui/toast.tsx` | Default `duration` prop | **5000 ms** (5 s) |
| Same file | `setTimeout(onClose, …)` for exit animation | **300 ms** |

### 3. Internal notes panel (scroll)

| File | What | Value |
|------|------|--------|
| `app/dashboard/clients/internal-notes-panel.tsx` | Scroll to bottom after notes loaded | **100 ms** |
| Same file | Scroll to bottom after panel open/slide-in | **400 ms** |

### 4. Login / empty-state animations (CSS)

| Where | Animation | Delay / duration |
|-------|------------|-------------------|
| `app/login/page.tsx` | Stagger delay (inline style) | **0.3s, 0.4s, 0.5s** |
| `app/login/login-form.tsx` | Stagger delay (inline style) | **0.6s, 0.7s, 0.8s** |
| `app/globals.css` | `.animate-fade-in` | **0.2s** delay, **0.6s** duration |
| `app/globals.css` | `.animate-fade-in-delay` | **0.4s** delay, **0.6s** duration |
| `app/globals.css` | `.animate-fade-in-delay-2` | **0.6s** delay, **0.6s** duration |

---

## Summary

- **Skeletons:** In all 10 `loading.tsx` files above; they are shown for as long as the route is loading, with **no extra delay**. Skeletons are kept lightweight for instant paint.
- **Loading time/delay:** No global “loading delay” is set. The only explicit delays are:
  - **300–500 ms** for search debounce in filters
  - **5 s** default toast duration (and 300 ms exit)
  - **100 ms / 400 ms** for internal notes scroll
  - **0.2s–0.8s** for login/empty-state animation delays in CSS

To change how long skeletons or spinners show, you would either speed up the data load (e.g. server/API) or, if you really want a minimum display time, add a deliberate delay (e.g. `setTimeout`) before clearing the loading state; that pattern is **not** used anywhere in the project today.
