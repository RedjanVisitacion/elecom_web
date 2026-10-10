# Developer Options user image gallery

Open Developer Options through its existing password prompt, then choose User Gallery.
Search by name/student ID, refresh after new uploads, and select a thumbnail to view it.
Images are grouped alphabetically by account name and labeled by their source and saved date when available.
The gallery reads saved profile, enrollment, candidate/follow-up photos, and party logos.
It cannot retrieve overwritten/deleted images or past verification frames that were never saved.
It does not expose biometric embeddings or reusable signature images.

After committing and pushing the changes, run each deployment command separately:

```bash
cd /var/www/elecom
git pull origin main
/var/www/elecom/venv/bin/python backend/manage.py collectstatic --noinput
sudo systemctl restart gunicorn
sudo systemctl is-active gunicorn
```

Refresh the admin browser with Ctrl+Shift+R. No database migration or mobile APK is needed.
Verify one user with multiple upload types, search/paging, thumbnail/full-size viewing,
and that access is denied without the developer password verification.
If images fail to load, confirm their stored URLs still exist; gallery refresh cannot restore deleted cloud assets.
