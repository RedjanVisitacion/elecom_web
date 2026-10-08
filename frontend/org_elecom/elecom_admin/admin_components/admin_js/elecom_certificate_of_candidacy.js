document.addEventListener('DOMContentLoaded', () => {
  const endpoint = '/api/admin/certificate-of-candidacy/settings/';
  const notice = document.getElementById('cocNotice');
  const forms = [...document.querySelectorAll('[data-coc-form]')];
  const previews = new Map(forms.map(form => [form, { timer: null, controller: null, url: '', revision: 0 }]));
  let csrf = '';
  function message(text, error = false) { notice.textContent = text; notice.className = error ? 'text-danger' : 'text-success'; }
  function updateYear(form, selected) {
    const slider = form.elements.academic_year_start;
    const current = new Date().getFullYear();
    const year = Number(selected || slider.value || current);
    if (selected !== undefined) {
      slider.min = Math.max(1900, Math.min(current - 15, year));
      slider.max = Math.min(2200, Math.max(current + 15, year));
    }
    slider.value = year;
    form.elements.academic_year_end.value = year + 1;
    slider.setAttribute('aria-valuetext', `${year} to ${year + 1}`);
    form.querySelector('[data-year-label]').textContent = `${year} - ${year + 1}`;
    form.querySelector('[data-year-min]').textContent = slider.min;
    form.querySelector('[data-year-max]').textContent = slider.max;
  }
  function values(form) {
    return { form_kind: form.dataset.cocForm,
      academic_year_start: form.elements.academic_year_start.value,
      academic_year_end: form.elements.academic_year_end.value,
      chairperson_name: form.elements.chairperson_name.value.trim() };
  }
  function schedulePreview(form, immediate = false) {
    const state = previews.get(form);
    clearTimeout(state.timer);
    if (state.controller) state.controller.abort();
    const revision = ++state.revision;
    form.querySelector('[data-preview-status]').textContent = 'Updating draft preview…';
    state.timer = setTimeout(() => refreshPreview(form, revision), immediate ? 0 : 350);
  }
  async function refreshPreview(form, revision) {
    const state = previews.get(form);
    const controller = new AbortController(); state.controller = controller;
    const status = form.querySelector('[data-preview-status]');
    const frame = form.querySelector('[data-preview-frame]');
    const params = new URLSearchParams({ draft: '1', ...values(form) });
    frame.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`/api/admin/certificate-of-candidacy/template/${form.dataset.cocForm}/?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf')) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not preview the certificate.');
      }
      const blob = await response.blob();
      if (controller.signal.aborted || state.revision !== revision) return;
      const nextUrl = URL.createObjectURL(blob);
      frame.src = `${nextUrl}#toolbar=0&navpanes=0&view=FitH`;
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = nextUrl;
      status.textContent = 'Draft preview — save settings to apply these changes.';
      status.className = 'small text-muted mb-2';
    } catch (error) {
      if (error.name !== 'AbortError' && state.revision === revision) {
        status.textContent = `Preview paused: ${error.message}`;
        status.className = 'small text-danger mb-2';
      }
    } finally {
      if (state.revision === revision) frame.setAttribute('aria-busy', 'false');
    }
  }
  async function load() {
    try {
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load certificate settings.');
      csrf = data.csrf_token || '';
      document.getElementById('cocElection').textContent = data.election_id ? `Settings for current election #${data.election_id}` : 'No current election. Settings are saved for filings without an election.';
      for (const form of forms) {
        const config = data.forms?.[form.dataset.cocForm];
        updateYear(form, config?.academic_year_start || new Date().getFullYear());
        form.elements.chairperson_name.value = config?.chairperson_name || '';
      }
      message('');
    } catch (error) { message(error.message, true); }
    finally {
      for (const form of forms) {
        form.querySelector('[type=submit]').disabled = false;
        schedulePreview(form, true);
      }
    }
  }
  for (const form of forms) {
    updateYear(form, new Date().getFullYear());
    form.elements.academic_year_start.addEventListener('input', () => {
      updateYear(form);
    });
    form.addEventListener('input', () => schedulePreview(form));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      for (const other of forms) other.querySelector('[type=submit]').disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          body: JSON.stringify(values(form)),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save certificate settings.');
        csrf = data.csrf_token || csrf;
        message(`${form.dataset.cocForm === 'usg' ? 'USG' : 'Department'} certificate settings saved.`);
      } catch (error) { message(error.message, true); }
      finally { for (const other of forms) other.querySelector('[type=submit]').disabled = false; }
    });
  }
  window.addEventListener('pagehide', () => {
    for (const state of previews.values()) {
      clearTimeout(state.timer); ++state.revision;
      if (state.controller) state.controller.abort();
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = '';
    }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) for (const form of forms) schedulePreview(form, true); });
  load();
});
