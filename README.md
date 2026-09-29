# Hospital Management Information System (HMIS)

Enterprise-grade Hospital Management Information System built with **React 18**, **Vite**, **Tailwind CSS**, and **Supabase / PostgreSQL**.

---

## 📖 Complete System Documentation

For the complete architectural breakdown, operational flows, department responsibilities, entities managed, and under-building specifications, please refer to:

👉 **[HOSPITAL_MANAGEMENT_SYSTEM.md](HOSPITAL_MANAGEMENT_SYSTEM.md)**

---

## 🏥 System Highlights

- **Admissions & IPD**: OPD intake, dynamic bed allocation across wards/ICUs, real-time bed occupancy, category management.
- **Clinical Workflows**: Resident Medical Officer (RMO) tasks, Nursing Station care, shift handovers, wound dressing.
- **Diagnostics**: Pathology and Radiology (X-Ray, CT Scan, USG) turnaround tracking, payment slips, and digital report uploads.
- **Pharmacy & Stores**: Dual patient/departmental indents, approval gates, store inventory, and store-out material tracking.
- **Operation Theatre (OT)**: Surgical scheduling, surgeon/anesthetist/nursing team assignments, pre/post-op tracking.
- **5-Stage Discharge**: Structured gatekeeper clearances across RMO, medical records, departments (Lab/Pharmacy/Ward), admin authority, and final billing.
- **Workforce Management**: 3-shift interactive drag-and-drop staff roster with automated task distribution based on active shift & ward.
- **Under-Building Modules**:
  - 🛠️ **Staff Complaint & Grievance SLA Engine**: Confidential & tracked workplace, biomedical, and administrative issue resolution.
  - 🛠️ **Ayushman Portal (AB-PM-JAY & State Schemes)**: Beneficiary ABHA verification, pre-auth, document tagging, and automated claim dossier submission.

---

## 🎫 Staff Help Ticket System (FMS & Grievance Redressal)

Replaces the legacy Google Sheets + Google Forms system with an integrated, auditable, SLA-tracked hospital ticket management system.

### 1. Routes
- **`/staff-tickets/raise`** (and alias **`/staff-help-desk`**): Public page (no login required). Hospital staff can submit complaints from mobile phones, upload images/PDFs, and track ticket status using their Ticket Number + 10-digit Mobile Number.
- **`/admin/staff-tickets/follow-up`**: Protected page for Process Coordinators (PC), Admins, and Department Heads. Features summary cards (Open, Analysis, Working, Overdue SLA, Completed Month), tabs, tap-to-call assignees, detail drawer, and stage updates (Analysis / Working / Completed).
- **`/admin/staff-tickets/completed`**: Protected page for completed tickets register, Turnaround Time (TAT) metrics, on-time SLA percentages, and print-ready A4 **Grievance Redressal Slips** (`window.print()` with `@media print`).
- **`/admin/masters/ticket-masters`** (and within Follow-Up): Admin-only management for Categories (SLA days), Category Issue Options, Departments, and Category Assignees / PCs.

### 2. Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL (`https://cyjxqoxcufmvlyigldbl.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Client-side public Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side service role key (configured in Vercel environment variables for private bucket access and bypassing RLS).

### 3. Roles & Permissions
- **Public**: Any staff member can raise tickets and track their own tickets (protected by 10-digit mobile verification).
- **Process Coordinators & Staff**: Access to `/admin/staff-tickets/follow-up` and `/admin/staff-tickets/completed` (permission keys: `staff-tickets-follow-up`, `staff-tickets-completed`).
- **Admins (`user.role === 'admin'`)**: Can view confidential tickets (`is_confidential = true`), re-open completed tickets, and manage master catalogs.

### 4. How Signed URLs Work
- All uploaded attachments are stored in the private Supabase storage bucket `staff-ticket-files` under the path convention: `tickets/{ticket_no}/{timestamp}-{sanitized_filename}`.
- Files are never publicly exposed. The app generates short-lived signed URLs (1-hour expiry) on-demand using `supabase.storage.from("staff-ticket-files").createSignedUrl(path, 3600)`.
- Client-side image compression automatically resizes images to max 1600px before uploading, ensuring fast transfers on mobile ward networks.

