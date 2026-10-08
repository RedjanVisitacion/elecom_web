document.addEventListener('DOMContentLoaded', () => {
  const endpoint = '/api/admin/certificate-of-candidacy/settings/';
  const notice = document.getElementById('cocNotice');
  const forms = [...document.querySelectorAll('[data-coc-form]')];
  let csrf = '', request = null, blobUrl = '';
  const previewElement = document.getElementById('cocPreviewModal');
  const modal = new bootstrap.Modal(previewElement);
  const frame = document.getElementById('cocPreviewFrame');
  function message(text, error = false) { notice.textContent = text; notice.className = error ? 'text-danger' : 'text-success'; }
  function populate(data) {
    csrf = data.csrf_token || csrf;
    document.getElementById('cocElection').textContent = data.election_id ? `Settings for current election #${data.election_id}` : 'No current election. Settings are saved for filings without an election.';
    for (const form of forms) {
      const config = data.forms?.[form.dataset.cocForm];
      form.elements.academic_year_start.value = config?.academic_year_start || '';
      form.elements.academic_year_end.value = config?.academic_year_end || '';
      form.elements.chairperson_name.value = config?.chairperson_name || '';
      form.querySelector('[data-preview]').disabled = !config;
    }
  }
  async function load() {
    try {
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load certificate settings.');
      populate(data); message('');
    } catch (error) { message(error.message, true); }
    finally { for (const form of forms) form.querySelector('[type=submit]').disabled = false; }
  }
  for (const form of forms) {
    form.elements.academic_year_start.addEventListener('change', () => {
      const start = Number(form.elements.academic_year_start.value);
      if (start) form.elements.academic_year_end.value = start + 1;
    });
    form.addEventListener('input', () => { form.querySelector('[data-preview]').disabled = true; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      for (const other of forms) other.querySelector('[type=submit]').disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          body: JSON.stringify({ form_kind: form.dataset.cocForm,
            academic_year_start: Number(form.elements.academic_year_start.value),
            academic_year_end: Number(form.elements.academic_year_end.value),
            chairperson_name: form.elements.chairperson_name.value.trim() }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save certificate settings.');
        // Keep any unsaved edits in the other form.
        csrf = data.csrf_token || csrf;
        form.querySelector('[data-preview]').disabled = false;
        message(`${form.dataset.cocForm === 'usg' ? 'USG' : 'Department'} certificate settings saved.`);
      } catch (error) { message(error.message, true); }
      finally { for (const other of forms) other.querySelector('[type=submit]').disabled = false; }
    });
    form.querySelector('[data-preview]').addEventListener('click', async () => {
      if (request) request.abort();
      const controller = new AbortController(); request = controller;
      try {
        const response = await fetch(`/api/admin/certificate-of-candidacy/template/${form.dataset.cocForm}/`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf')) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Could not preview the certificate.');
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(blob); frame.src = blobUrl;
        document.getElementById('cocPreviewTitle').textContent = `${form.dataset.cocForm === 'usg' ? 'USG' : 'Department'} Certificate of Candidacy`;
        modal.show();
      } catch (error) { if (error.name !== 'AbortError') message(error.message, true); }
    });
  }
  previewElement.addEventListener('hidden.bs.modal', () => {
    if (request) request.abort(); request = null;
    frame.removeAttribute('src'); if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = '';
  });
  load();
});
