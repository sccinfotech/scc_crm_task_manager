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

**Skeleton behavior:** They use Tailwind’s `animate-pulse` and gray blocks (`bg-gray-200`, `bg-gray-100`). **No fixed “loading time” or delay** is set; visibility lasts only as long as the server/data load for that route.

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

- **Skeletons:** Only in the 7 `loading.tsx` files above; they are shown for as long as the route is loading, with **no extra delay**.
- **Loading time/delay:** No global “loading delay” is set. The only explicit delays are:
  - **300–500 ms** for search debounce in filters
  - **5 s** default toast duration (and 300 ms exit)
  - **100 ms / 400 ms** for internal notes scroll
  - **0.2s–0.8s** for login/empty-state animation delays in CSS

To change how long skeletons or spinners show, you would either speed up the data load (e.g. server/API) or, if you really want a minimum display time, add a deliberate delay (e.g. `setTimeout`) before clearing the loading state; that pattern is **not** used anywhere in the project today.
