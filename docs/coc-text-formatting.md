# Deploy COC text formatting

Bold and Italic are independent for the academic-year value and chairperson name.
Normal clears both styles for that field. Settings are shared by both forms.
Previews and future initial issuances use the selected ReportLab font. Initial
issuance snapshots retain the four formatting flags; final approval signs the
frozen PDF. Existing original, initial, and final certificate editions are not
rewritten. Legacy settings and snapshots use normal text.

The four boolean fields live in the existing SQL-managed
`candidate_certificate_settings` table, following its RunSQL migration pattern.
Migration `elecom_auth.0011_coc_text_formatting` adds them with false defaults.
Schema recovery also repairs these columns if missing.

## Local commit and push

Run each command separately from `F:\elecom_web`:

```cmd
git add backend/core/coc_management.py backend/core/candidate_filing_schema.py backend/core/test_coc_management.py backend/core/test_candidate_filing_schema.py backend/core/test_coc_chairperson_signatures.py backend/elecom_auth/migrations/0011_coc_text_formatting.py frontend/org_elecom/elecom_admin/elecom_certificate_of_candidacy.html frontend/org_elecom/elecom_admin/admin_components/admin_css/elecom_certificate_of_candidacy.css frontend/org_elecom/elecom_admin/admin_components/admin_js/elecom_certificate_of_candidacy.js docs/coc-text-formatting.md
git commit -m "Add saved COC year and chairperson text formatting"
git push origin main
```

## Production

Run each command separately, waiting for the prompt after each:

```bash
cd /var/www/elecom
git log --oneline -3
git pull origin main
git log --oneline -3
/var/www/elecom/venv/bin/python backend/manage.py migrate
/var/www/elecom/venv/bin/python backend/manage.py collectstatic --noinput
sudo systemctl restart gunicorn
sudo systemctl is-active gunicorn
```

Expect `active`. Refresh COC Management with Ctrl + Shift + R. Select Bold and
Italic for each field, inspect both previews, and save. Reload to confirm the
selections remain. Download a sample PDF to confirm its formatting matches.
No APK rebuild is required for these web controls and backend-rendered editions.

## Verification

Focused backend tests (no live database required):

```powershell
cd F:\elecom_web\backend
.\venv\Scripts\python.exe -m unittest core.test_coc_management core.test_coc_chairperson_signatures core.test_candidate_certificates core.test_candidate_filing_schema
```

These tests inspect generated font resources and inline-year geometry, shared
setting writes, formatting validation, immutable snapshots, and recovery SQL.
They do not substitute for running the migration against the production database.
