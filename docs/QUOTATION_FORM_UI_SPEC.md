# Add Quotation Form – UI Improvement Specification

This document specifies improvements to the **Add Quotation** form user interface, aligned with the global UI theme ([UI_SETUP.md](./UI_SETUP.md)) and existing patterns (Leads, Clients, Projects). The goal is a single, searchable “Lead or Client” selector, clear type labels, automatic source-type handling, and consistent “Create Lead” / “Add Client” entry points.

---

## 1. Scope and Goals

### 1.1 In scope
- **Add Quotation** form (create and edit): combined Lead + Client selector, type labels, “Create Lead” button, and behavior.
- **Add Project** form: ensure a visible way to open the “Add Client” form (create client from project flow).
- Alignment with global UI (modals, spacing, typography, accessibility).

### 1.2 Out of scope
- Back-end or API changes beyond any minimal wiring for new callbacks.
- Quotation list, detail, or conversion flows (unchanged by this spec).

---

## 2. Global UI Theme and Conventions

All changes **must** follow:

- **[UI_SETUP.md](./UI_SETUP.md)**  
  - Modals do **not** close on backdrop click; only Close (X), Cancel, or Submit close the modal.  
  - Modal wrappers use `role="dialog"` and `aria-modal="true"`.  
  - Backdrop is presentational only (no `onClick`).

- **Existing form patterns** (Projects, Clients, Leads):  
  - Section headings: `text-xs font-bold uppercase tracking-wider text-slate-400`.  
  - Sections: `rounded-2xl border border-slate-100 bg-slate-50/50 p-5`.  
  - Inputs: `rounded-xl border border-slate-200 ... focus:border-[#06B6D4] focus:ring-4 focus:ring-[#06B6D4]/10`.  
  - Labels: `text-sm font-semibold text-slate-700 mb-1.5`.  
  - Primary actions: `rounded-xl`, cyan/teal (`#06B6D4`), consistent with `btn-gradient-smooth` where used elsewhere.

- **Accessibility**  
  - All controls have associated labels (`htmlFor` / `id` or `aria-label`).  
  - Keyboard navigation and focus management in dropdowns/modals.

---

## 3. Combined Lead + Client Selector (Add Quotation Form)

### 3.1 Current behavior (to replace)
- User first chooses **Source Type** (Lead / Client) via a dropdown.
- Then a second control shows either “Lead” or “Client” list.
- Two steps and two separate controls.

### 3.2 Target behavior

**Single control: “Lead or Client”**

- **One searchable list** that shows both Leads and Clients together.
- **Search:** Filter by name and/or company name (client-side or server-side; same debounce as other search inputs, e.g. 300–500 ms).
- **No separate “Source Type” dropdown.** Source type is derived only from the selected item (see 3.3).

### 3.3 List content and type labels

- **Data source:**  
  - Leads: from `getLeadsForSelect()` (or equivalent), excluding converted leads.  
  - Clients: from `getClientsForSelect()` (or equivalent).  
  - Combined list: merge into one ordered list (e.g. sort by name; optional: group by type or show “Leads” then “Clients” with section headers).

- **Per row / option:**  
  - **Primary text:** Person/company name (and company name if present), e.g. `"John Doe (Acme Inc.)"` or `"Acme Inc."`.  
  - **Type label (required):** A clear, always-visible label indicating **Lead** or **Client**:
    - **Option A (recommended):** Pill/badge next to the name, e.g.:
      - `Lead` – e.g. `rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800` (or similar).
      - `Client` – e.g. `rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800` (or similar).
    - **Option B:** Short prefix in the same line, e.g. `[Lead] John Doe` / `[Client] Acme Inc.`.
  - Ensure the type is obvious at a glance and consistent across the list.

- **Selection and source type:**  
  - When the user selects an item from this combined list:
    1. **If the item is a Lead**  
       - Set `source_type = 'lead'` and `lead_id = <id>`, clear `client_id`.  
       - Load and show “Client Information” from lead (editable snapshot), as today.
    2. **If the item is a Client**  
       - Set `source_type = 'client'` and `client_id = <id>`, clear `lead_id`.  
       - Load and show “Client Information” from client (read-only), as today.  
  - No separate “Source Type” control; the form state is driven entirely by the selection.

### 3.4 Empty and loading states

- **Empty list:** Message such as: “No leads or clients found. Add a lead or use an existing client.”  
  - Optionally show “Create Lead” (and, if in scope, “Add Client”) as actions.
- **Loading:** Skeleton or spinner for the dropdown/list while data is loading, consistent with other listboxes in the app.

### 3.5 Implementation notes

- **Component:**  
  - Either extend the existing `ListboxDropdown` to support a “combined list with type labels” and search, or introduce a dedicated **LeadOrClientCombobox** (search input + dropdown list) used only in the Quotation form.
- **Uniqueness:**  
  - Use a composite key so leads and clients can coexist (e.g. `lead:${id}` and `client:${id}`). On selection, parse the key to set `source_type`, `lead_id`, or `client_id`.
- **Search:**  
  - If the combined list is small, client-side filter is sufficient. If large, consider server-side search with a single endpoint returning both leads and clients with a `type` field.

---

## 4. “Create Lead” in the Add Quotation Form

### 4.1 Requirement
- A **clearly visible “Create Lead” button** must exist **inside** the Add Quotation form (create and edit).
- Placement: near the “Lead or Client” selector (e.g. same row as the label, right-aligned, or directly below the selector).

### 4.2 Behavior
- **Click:** Opens the **Add Lead** form in a modal (reuse existing `LeadModal` with `mode="create"`).
- **No backdrop close:** Per [UI_SETUP.md](./UI_SETUP.md), the Lead modal closes only via Close (X), Cancel, or Submit.
- **After successful create:**  
  1. Close the Lead modal.  
  2. Refresh the combined Lead + Client list (so the new lead appears).  
  3. Optionally auto-select the newly created lead in the Quotation form (recommended for smoother flow).  
  4. Quotation form stays open; user can continue filling and submit.

### 4.3 Visual and copy
- **Label:** “Create Lead” (primary). Optional short hint: “Not in the list? Add a new lead.”
- **Style:** Secondary action so it doesn’t compete with the main submit:
  - E.g. outline style: `rounded-lg px-3 py-2 text-sm font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100` (align with Project form “Create customer” button).
  - Icon: plus or “add” icon (e.g. `+` or standard add SVG), left of text.
- **Visibility:** Always visible when the Quotation form is in create mode (and in edit mode if product owner wants to allow adding a new lead from edit).

### 4.4 Permissions
- Show “Create Lead” only if the user has **Leads** write permission (same as elsewhere). If no permission, hide the button.

---

## 5. Add Project Form – “Add Client” Entry Point

### 5.1 Current behavior
- The Add Project form has a **Client** dropdown and, when `canCreateClient` is true, a **“Create customer”** button that opens the Add Client modal.
- On client create success, the new client is set in the form and the client list is refreshed.

### 5.2 Requirement
- **Ensure** the Add Project form continues to provide a clear way to open the **Add Client** form from within the project flow.
- **Copy:** Prefer **“Add Client”** or **“Create Client”** for consistency with “Create Lead” in Quotations; if the product uses “Create customer” elsewhere, that can be kept but should be documented and consistent.
- **Placement:** Next to the Client field label (same as current “Create customer”), so it’s obvious and consistent with the Quotation “Create Lead” placement.

### 5.3 Behavior (unchanged in spirit)
- Click opens Client modal (create).
- Modal does not close on backdrop (per UI_SETUP).
- On success: close Client modal, refresh client list, set newly created client in the Project form.

---

## 6. User Flows (Step-by-Step)

### 6.1 Add Quotation – select existing Lead or Client
1. User opens **Add Quotation** (e.g. from Quotations list, “Add Quotation”).
2. Form shows **Basic Information** with a single **“Lead or Client”** searchable list (with Lead/Client labels on each row).
3. User types in the search field to filter by name/company.
4. User selects one option:
   - **If Lead:** Form sets source to Lead, loads lead data into “Client Information” (editable). User can adjust and continue.
   - **If Client:** Form sets source to Client, loads client data into “Client Information” (read-only). User continues.
5. User fills Quotation Date, Valid Till, Technology & Tools, Reference, Status, Discount, etc.
6. User submits; quotation is created (or updated) with the correct `source_type`, `lead_id` or `client_id`.

### 6.2 Add Quotation – create a new Lead from the form
1. User is in **Add Quotation** and opens the “Lead or Client” list.
2. User does not find the right person and clicks **“Create Lead”**.
3. **Add Lead** modal opens (on top of Add Quotation modal or as a stacked modal).
4. User fills Lead form and submits.
5. Lead modal closes; combined list refreshes and **new lead is auto-selected** in the Quotation form.
6. “Client Information” updates from the new lead (editable). User continues with the rest of the quotation and submits.

### 6.3 Add Project – add a new Client from the form
1. User is in **Add Project** (e.g. from conversion or from Projects list).
2. Next to **Client**, user clicks **“Add Client”** (or “Create Client” / “Create customer” per product copy).
3. **Add Client** modal opens.
4. User fills Client form and submits.
5. Client modal closes; client list refreshes and **new client is selected** in the Project form.
6. User continues with project details and submits.

---

## 7. Modal Stacking and Z-Index

- When **Add Quotation** is open and user opens **Add Lead**:
  - Lead modal must appear **above** the Quotation modal (e.g. Lead modal `z-index` higher than Quotation modal).
  - Closing the Lead modal must return focus to the Quotation form and keep Quotation modal open.
- Use the same stacking pattern as **Add Project** + **Add Client** (Project modal → Client modal).
- Recommended: Quotation modal `z-[60]`, Lead modal `z-[70]` (or one higher than the parent).

---

## 8. Summary of UI Elements

| Location              | Element                 | Behavior / Notes                                                                 |
|-----------------------|------------------------------------------------------------------------------------------------------------|
| Add Quotation form    | **Lead or Client**      | Single searchable list; options show “Lead” or “Client” label; selection sets source type and loads Client Information. |
| Add Quotation form    | **Create Lead** button  | Opens Add Lead modal; on success, refresh list and auto-select new lead. Visible only if user has Leads write permission. |
| Add Project form      | **Client** field        | Unchanged: dropdown + optional “Add Client” / “Create Client” (or “Create customer”) that opens Add Client modal. |
| Add Project form      | **Add Client** button   | Opens Add Client modal; on success, refresh client list and select new client. Shown when `canCreateClient` is true. |

---

## 9. Acceptance Criteria (Checklist)

- [ ] Add Quotation form uses **one** combined “Lead or Client” searchable list (no separate Source Type dropdown).
- [ ] Each option in the list has a **clear, visible “Lead” or “Client”** label (pill/badge or prefix).
- [ ] Selecting an option **automatically** sets source type and loads the correct Client Information (editable for Lead, read-only for Client).
- [ ] **“Create Lead”** button is present and visible in the Add Quotation form (when user has Leads write permission).
- [ ] Clicking “Create Lead” opens the Add Lead modal; modal does not close on backdrop click.
- [ ] After creating a lead, the combined list refreshes and the new lead is auto-selected in the Quotation form.
- [ ] Add Project form has a visible way to open the Add Client form (e.g. “Add Client” / “Create Client” / “Create customer” button); behavior unchanged in spirit.
- [ ] All modals follow [UI_SETUP.md](./UI_SETUP.md) (no backdrop close, `role="dialog"`, `aria-modal="true"`).
- [ ] Styling and spacing match the global theme (sections, inputs, labels, primary/secondary buttons).
- [ ] Accessibility: labels, focus, and keyboard behavior are correct for the new/updated controls.

---

## 10. Related Documentation

- [UI_SETUP.md](./UI_SETUP.md) – Modal behavior and global UI conventions  
- [LOADING_AND_SKELETONS.md](./LOADING_AND_SKELETONS.md) – Loading and skeleton patterns  
- Existing implementation: `app/dashboard/quotations/quotation-form.tsx`, `quotation-modal.tsx`, `app/dashboard/projects/project-form.tsx`, `project-modal.tsx`, `app/dashboard/leads/lead-modal.tsx`, `app/dashboard/clients/client-modal.tsx`
