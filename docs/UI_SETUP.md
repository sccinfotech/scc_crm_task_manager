# UI Setup and Conventions

This document describes UI behavior and conventions used across the CRM application.

---

## Modal / Dialog Behavior

### Close behavior (all modules)

**Modals do not close when clicking outside** (backdrop click). They close only when the user explicitly:

- Clicks the **Close** (X) button in the header, or  
- Clicks **Cancel** (or equivalent) in the footer, or  
- Submits the form (Create/Save/Confirm), which then closes the modal.

This applies to every modal in the app so that users do not lose work by accidentally clicking the backdrop.

### Modules and modal components

| Module | Modal components |
|--------|------------------|
| **Leads** | `lead-modal.tsx`, `follow-up-modal.tsx`, `follow-up-delete-modal.tsx`, `delete-confirm-modal.tsx`, `lead-details.tsx` (detail view) |
| **Clients** | `client-modal.tsx`, `delete-confirm-modal.tsx`, `internal-notes-panel.tsx` |
| **Quotations** | `quotation-modal.tsx`, status/delete/requirement modals in `quotation-detail-view.tsx` |
| **Projects** | `project-modal.tsx`, `follow-up-modal.tsx`, `follow-up-delete-modal.tsx`, `delete-confirm-modal.tsx`, requirement modals and delete in `project-requirements.tsx`, note/attachment modals in `project-my-notes.tsx`, talk modals in `project-team-talk.tsx`, `end-work-modal.tsx` |
| **Project tasks** | Task form modal in `project-tasks.tsx` |
| **Users** | `user-modal.tsx`, `user-delete-modal.tsx`, `user-permissions-modal.tsx`, `user-photo-crop-modal.tsx`, edit/profile modals in `edit-user-client.tsx` |
| **Settings** | `technology-tool-modal.tsx`, `technology-tool-delete-modal.tsx` |

### Implementation notes

- Modal wrappers use `role="dialog"` and `aria-modal="true"` for accessibility.
- The backdrop is presentational only; it has no `onClick` handler.
- Close/Cancel and header X buttons still call `onClose` as before.

---

## Technology & Tools field (Projects and Quotations)

On **Create/Edit Project** and **Create/Edit Quotation** forms, the **Technology & Tools** field uses the same pattern:

- **Search and select:** A text input with placeholder “Search or type new…”. Typing filters the list of existing technology tools; the user selects from the dropdown to add a tool to the selection.
- **Create new:** If the typed text does not exactly match an existing tool, a “Create &quot;…&quot;” option appears at the bottom of the dropdown. Clicking it creates a new technology tool (via Settings permissions) and adds it to the current selection.
- **Selected tools:** Chips show each selected tool with a remove (×) button. Styling: `rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800`.
- **Errors:** If the tools list fails to load, an amber error message is shown above the field (`technologyToolsError`).
- **Consistency:** This pattern is implemented in `project-form.tsx` and `quotation-form.tsx` so that both modules behave the same.

---

## Skeleton loading (all modules)

Every dashboard module **must** have a route-level `loading.tsx` file that shows a skeleton during page load. This ensures consistent UX—users see a structured placeholder instead of a blank screen when navigating.

- **Required:** Create `loading.tsx` in each new module's route folder
- **Format:** Follow the guidelines in [LOADING_AND_SKELETONS.md](./LOADING_AND_SKELETONS.md#skeleton-format-guidelines-for-new-modules)
- **Reference:** See existing modules (Projects, Leads, Clients, Quotations, Users, Logs, Settings) for examples

---

## Tag / status pill style (all modules)

Use a consistent pill style for small status / type tags like **stock adjustment type**, **statuses**, and **labels**:

- **Shape & layout**:  
  - `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border`
- **Positive / “Add / In / Active” states** (e.g. Add stock):  
  - Background: soft green tint (e.g. `rgba(22, 163, 74, 0.08)`)  
  - Text: dark green (e.g. `#15803D`)  
  - Border: medium green (e.g. `rgba(22, 163, 74, 0.4)`)  
  - Leading dot: `w-1.5 h-1.5 rounded-full` with brighter green (e.g. `#22C55E`)
- **Negative / “Remove / Out / Inactive” states** (e.g. Remove stock):  
  - Background: soft red tint (e.g. `rgba(220, 38, 38, 0.06)`)  
  - Text: dark red (e.g. `#B91C1C`)  
  - Border: medium red (e.g. `rgba(220, 38, 38, 0.4)`)  
  - Leading dot: `w-1.5 h-1.5 rounded-full` with brighter red (e.g. `#F97373`)
- **Text**: be explicit and user-friendly, e.g. `"Add stock"` / `"Remove stock"` instead of short codes.

When adding new modules (e.g. other stock or status tables), reuse this pattern so type/status tags look and behave consistently across the app.

---

## List view pagination (all modules)

Every list/table view **must** use consistent pagination:

- **Page size:** 20 rows per page (fixed across all list views).
- **URL sync:** Page number in query params (`?page=2`) so views are shareable and back/forward work correctly.
- **UI elements:**
  - **Range display:** `"X–Y of Z"` (e.g. "1–20 of 156")
  - **Previous / Next** buttons (disabled when at first/last page)
  - **Page number buttons** (show first, last, and pages around current; use ellipsis for gaps)
- **API:** Pass `page` and `limit=20` to list endpoints. APIs must return `total` and support `range(from, from + limit - 1)`.

### Implementation notes

- Use a shared constant (e.g. `ROWS_PER_PAGE = 20` or `PAGE_SIZE = 20`) for consistency.
- Reset to page 1 when search/filter changes.
- Memoize pagination range computation to avoid unnecessary recalculations.

---

## Related docs

- [LOADING_AND_SKELETONS.md](./LOADING_AND_SKELETONS.md) – Skeletons, spinners, delays, and format guidelines
- [LIST_VIEW_DATA_FETCHING.md](./LIST_VIEW_DATA_FETCHING.md) – Fetch only required fields for table/list views
- [QUOTATION_FORM_UI_SPEC.md](./QUOTATION_FORM_UI_SPEC.md) – Add Quotation form UI improvements (combined Lead/Client selector, Create Lead, Add Client)
- [SETUP.md](../SETUP.md) – Authentication and environment setup
