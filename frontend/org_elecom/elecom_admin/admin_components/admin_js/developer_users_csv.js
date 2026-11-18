(() => {
  'use strict';
  const input = document.getElementById('developerUsersCsvFile');
  const status = document.getElementById('developerUsersStatus');
  const modalElement = document.getElementById('developerUsersCsvModal');
  const modal = new bootstrap.Modal(modalElement);
  const commit = document.getElementById('developerUsersCsvCommit');
  const importButton = document.getElementById('developerUsersCsvImport');
  let file = null, busy = false;
  async function submit(preview) {
    const session = await fetch('/api/admin/developer/users/?page=1', { credentials: 'same-origin', cache: 'no-store' });
    const auth = await session.json();
    if (!session.ok || !auth.ok) throw new Error(auth.error || 'Unable to verify access.');
    const form = new FormData(); form.append('file', file); form.append('preview', preview ? '1' : '0');
    const response = await fetch('/api/admin/developer/users/csv/', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': auth.csrf_token }, body: form });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Import failed.');
    return result;
  }
  importButton.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', async () => {
    if (busy) return;
    file = input.files[0]; input.value = '';
    if (!file) return;
    busy = true; importButton.disabled = true;
    status.textContent = 'Validating CSV…';
    try {
      const result = await submit(true);
      document.getElementById('developerUsersCsvSummary').textContent = `${result.created} new accounts and ${result.updated} existing accounts. Import this CSV?`;
      document.getElementById('developerUsersCsvError').textContent = '';
      status.textContent = 'CSV validated. Review the import before saving.';
      modal.show();
    } catch (error) { status.textContent = error.message; file = null; }
    finally { busy = false; importButton.disabled = false; }
  });
  modalElement.addEventListener('hide.bs.modal', event => { if (busy) event.preventDefault(); });
  modalElement.addEventListener('hidden.bs.modal', () => { file = null; });
  commit.addEventListener('click', async () => {
    if (busy || !file) return;
    busy = true; commit.disabled = true;
    const errorText = document.getElementById('developerUsersCsvError');
    errorText.textContent = 'Importing…';
    try {
      const result = await submit(false);
      busy = false; modal.hide();
      document.getElementById('developerUserSearch').requestSubmit();
      status.textContent = `Imported: ${result.created} created, ${result.updated} updated.`;
      window.alertToast?.(`Imported: ${result.created} created, ${result.updated} updated.`, 'success');
    } catch (error) { errorText.textContent = error.message; }
    finally { busy = false; commit.disabled = false; }
  });
})();
