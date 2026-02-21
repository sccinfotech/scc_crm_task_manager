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
| **Projects** | `project-modal.tsx`, `follow-up-modal.tsx`, `follow-up-delete-modal.tsx`, `delete-confirm-modal.tsx`, requirement modals and delete in `project-requirements.tsx`, note/attachment modals in `project-my-notes.tsx`, talk modals in `project-team-talk.tsx`, `end-work-modal.tsx` |
| **Project tasks** | Task form modal in `project-tasks.tsx` |
| **Users** | `user-modal.tsx`, `user-delete-modal.tsx`, `user-permissions-modal.tsx`, `user-photo-crop-modal.tsx`, edit/profile modals in `edit-user-client.tsx` |
| **Settings** | `technology-tool-modal.tsx`, `technology-tool-delete-modal.tsx` |

### Implementation notes

- Modal wrappers use `role="dialog"` and `aria-modal="true"` for accessibility.
- The backdrop is presentational only; it has no `onClick` handler.
- Close/Cancel and header X buttons still call `onClose` as before.

---

## Related docs

- [LOADING_AND_SKELETONS.md](./LOADING_AND_SKELETONS.md) – Skeletons, spinners, and delays
- [SETUP.md](../SETUP.md) – Authentication and environment setup
