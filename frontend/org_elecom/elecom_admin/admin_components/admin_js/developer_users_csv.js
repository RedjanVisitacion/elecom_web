(() => {
  'use strict';
  const input = document.getElementById('developerUsersCsvFile');
  const status = document.getElementById('developerUsersStatus');
  const modalElement = document.getElementById('developerUsersCsvModal');
  const modal = new bootstrap.Modal(modalElement);
  const commit = document.getElementById('developerUsersCsvCommit');
  const importButton = document.getElementById('developerUsersCsvImport');
  const progress = document.getElementById('developerUsersCsvProgress');
  const bar = document.getElementById('developerUsersCsvProgressBar');
  const errorText = document.getElementById('developerUsersCsvError');
  const cancelButtons = modalElement.querySelectorAll('[data-bs-dismiss]');
  let file = null, busy = false, preview = null;
  function showProgress(done, total) {
    progress.hidden = false;
    const percent = Math.round(done / total * 100);
    bar.style.width = `${percent}%`; bar.setAttribute('aria-valuenow', String(percent));
    bar.textContent = `${percent}%`;
    status.textContent = `Importing ${done.toLocaleString()} of ${total.toLocaleString()} accounts…`;
    errorText.textContent = `${done.toLocaleString()} of ${total.toLocaleString()} accounts saved. ${done < total ? 'Processing the next batch. Keep this page open.' : 'Import complete.'}`;
  }
  async function submit(isPreview, offset = 0) {
    const session = await fetch('/api/admin/developer/users/?page=1', { credentials: 'same-origin', cache: 'no-store' });
    const auth = await session.json();
    if (!session.ok || !auth.ok) throw new Error(auth.error || 'Unable to verify access.');
    const form = new FormData(); form.append('file', file); form.append('preview', isPreview ? '1' : '0');
    if (!isPreview) { form.append('offset', String(offset)); form.append('file_digest', preview.file_digest); }
    const response = await fetch('/api/admin/developer/users/csv/', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': auth.csrf_token }, body: form });
    let result;
    try { result = await response.json(); } catch { throw new Error('The server did not return an import result.'); }
    if (!response.ok || !result.ok) throw new Error(result.error || 'Import failed.');
    return result;
  }
  importButton.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', async () => {
    if (busy) return;
    file = input.files[0]; input.value = '';
    if (!file) return;
    busy = true; importButton.disabled = true; preview = null;
    status.textContent = 'Validating the complete CSV…';
    try {
      preview = await submit(true);
      document.getElementById('developerUsersCsvSummary').textContent = `${preview.total.toLocaleString()} accounts: ${preview.created.toLocaleString()} new and ${preview.updated.toLocaleString()} existing. Import in batches of 250?`;
      errorText.textContent = ''; progress.hidden = true; commit.disabled = false;
      status.textContent = 'CSV validated. Review the import before saving.';
      modal.show();
    } catch (error) { status.textContent = error.message; file = null; }
    finally { busy = false; importButton.disabled = false; }
  });
  modalElement.addEventListener('hide.bs.modal', event => { if (busy) event.preventDefault(); });
  modalElement.addEventListener('hidden.bs.modal', () => { file = null; preview = null; });
  window.addEventListener('beforeunload', event => { if (busy && preview) { event.preventDefault(); event.returnValue = ''; } });
  commit.addEventListener('click', async () => {
    if (busy || !file || !preview) return;
    busy = true; commit.disabled = true; importButton.disabled = true;
    cancelButtons.forEach(button => { button.disabled = true; });
    errorText.classList.remove('text-danger');
    let processed = 0, created = 0, updated = 0;
    const total = preview.total;
    try {
      showProgress(0, total);
      while (processed < total) {
        const result = await submit(false, processed);
        if (!Number.isInteger(result.processed) || result.processed <= processed || result.processed > total || result.total !== total) throw new Error('Unexpected import progress returned by the server.');
        processed = result.processed; created += result.created; updated += result.updated;
        showProgress(processed, total);
      }
      errorText.textContent = `Import complete: ${processed.toLocaleString()} of ${total.toLocaleString()} saved (${created.toLocaleString()} created, ${updated.toLocaleString()} updated).`;
      status.textContent = errorText.textContent;
      // Reload the list after the dialog closes without overwriting the final count now.
      modalElement.addEventListener('hidden.bs.modal', () => document.getElementById('developerUserSearch').requestSubmit(), { once: true });
    } catch (error) {
      errorText.classList.add('text-danger');
      errorText.textContent = `Import stopped after ${processed.toLocaleString()} of ${total.toLocaleString()} accounts were confirmed saved. ${error.message} Completed batches remain saved. If the connection was interrupted, the last batch may also have saved. You can select the same CSV again to finish; existing accounts will be updated.`;
      status.textContent = errorText.textContent;
    } finally {
      busy = false; importButton.disabled = false;
      cancelButtons.forEach(button => { button.disabled = false; });
    }
  });
})();
