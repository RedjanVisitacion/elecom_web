# User Management CSV

Developer Options → User Management provides Export CSV, Import CSV, and Download CSV template. Both the profile Developer Options page and the older developer/reset page use the same controls.

Export downloads all accounts, independent of the current search or page. It includes Student ID, separate name fields, email, course, year, section, phone, and role. Passwords, password hashes, OTPs, and biometric data are excluded. Formula-like cells are prefixed with an apostrophe for spreadsheet safety; import removes that prefix for supported formula prefixes.

Import accepts UTF-8 CSV (with or without BOM), at most 2 MB and 500 accounts. Use the template headers: `student_id,first_name,middle_name,last_name,email,course,year,section,phone_number,role`. Middle name and role columns are optional. All other fields are required for both new and existing accounts. Year must be 1–10. Student IDs retain text formatting and must contain only letters, numbers, and hyphens. Duplicate IDs in a file or ambiguous existing accounts are rejected.

The entire file is validated before a preview reports create/update counts. Confirming Import accounts submits the same file for fresh validation and an atomic save. Cancel saves nothing. Counts can change between preview and confirmation if another administrator updates the accounts.

Accounts are matched by Student ID. Import updates the shared student/account fields using the existing voter upsert helper. Existing passwords remain unchanged. New accounts are students and use the existing Student-ID initial-password rule. CSV role values are informational: they cannot promote users or demote existing administrators. Use the existing explicit role controls to change administrator access. Additional account data, such as profile photos, is retained.

The endpoint `/api/admin/developer/users/csv/` requires the existing authenticated administrator and 15-minute developer-password gate. Writes use Django CSRF protection. Export responses are private/no-store. No migration or mobile build is needed. Deploy backend/frontend updates, collect static files, restart Gunicorn, and refresh the browser according to the server's current deployment configuration.

Checks: `python -m unittest core.test_developer_users_csv core.test_developer_options`; `node --check frontend/org_elecom/elecom_admin/admin_components/admin_js/developer_users_csv.js`. Tests mock database access and verify validation, gate enforcement, export escaping, preview, shared upsert use, and transaction exception propagation. They do not prove a live PostgreSQL import or browser download/upload.
