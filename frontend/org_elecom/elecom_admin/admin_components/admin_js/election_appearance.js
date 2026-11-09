/* Election-specific mobile filing-card background editor. */
(() => {
  const modal = document.getElementById('filingAppearanceModal');
  if (!modal) return;
  const form = document.getElementById('filingAppearanceForm');
  const input = document.getElementById('filingBackgroundFile');
  const preview = document.getElementById('filingBackgroundPreview');
  const message = document.getElementById('filingAppearanceMessage');
  const save = document.getElementById('saveFilingAppearance');
  const reset = document.getElementById('resetFilingAppearance');
  const fallback = '/static/assets/filing-card-default.png';
  let electionId, csrfToken, objectUrl, savedUrl = fallback, loading = false;
  const endpoint = () => `/api/admin/elections/${encodeURIComponent(electionId)}/appearance/`;
  const notice = (text, error = false) => { message.textContent = text; message.className = error ? 'text-danger small mb-3' : 'text-muted small mb-3'; };
  const busy = value => {
    loading = value; input.disabled = value; save.disabled = value || !input.files.length;
    reset.disabled = value;
    modal.querySelectorAll('[data-bs-dismiss]').forEach(button => { button.disabled = value; });
  };
  const releasePreview = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null; };
  const setPreview = url => { preview.src = url || fallback; };
  preview.addEventListener('error', () => {
    if (preview.getAttribute('src') !== fallback) setPreview(fallback);
  });
  const load = async () => {
    busy(true); notice('Loading saved appearance…');
    try {
      const response = await fetch(endpoint(), { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load this election.');
      csrfToken = data.csrfToken; savedUrl = data.background_url || fallback;
      setPreview(savedUrl); notice(data.background_url ? 'Custom background saved for this election.' : 'Using the default carousel. Upload an image to replace it for this election.');
    } catch (error) { notice(error.message, true); csrfToken = null; }
    finally { busy(false); if (!csrfToken) { save.disabled = true; reset.disabled = true; input.disabled = true; } }
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-filing-appearance]');
    if (!button || loading) return;
    electionId = button.dataset.filingAppearance; csrfToken = null;
    document.getElementById('filingAppearanceElection').textContent = button.dataset.electionName || `Election #${electionId}`;
    releasePreview(); form.reset(); setPreview(fallback);
    bootstrap.Modal.getOrCreateInstance(modal, { backdrop: 'static' }).show();
    load();
  });
  input.addEventListener('change', () => {
    releasePreview(); const file = input.files[0];
    if (!file) { setPreview(savedUrl); save.disabled = true; return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = ''; setPreview(savedUrl); save.disabled = true;
      notice('Choose a JPG, PNG or WebP image up to 5 MB.', true); return;
    }
    objectUrl = URL.createObjectURL(file); setPreview(objectUrl); save.disabled = false;
    notice('Preview only. Click Save changes to publish this background.');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (loading || !csrfToken || !input.files.length) return;
    busy(true); notice('Saving background…');
    try {
      const body = new FormData(); body.append('background', input.files[0]);
      const response = await fetch(endpoint(), { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken }, body });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to save the background.');
      savedUrl = data.background_url || fallback; releasePreview(); input.value = ''; setPreview(savedUrl);
      notice('Saved. The updated app will refresh this election’s filing card automatically.');
      window.ElecomToast?.success('Filing-card background saved.');
    } catch (error) { notice(error.message, true); }
    finally { busy(false); }
  });
  reset.addEventListener('click', async () => {
    if (loading || !csrfToken || !window.confirm('Restore the default filing-card carousel for this election?')) return;
    busy(true);
    try {
      const response = await fetch(endpoint(), { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken } });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to restore the default.');
      releasePreview(); input.value = ''; savedUrl = fallback; setPreview(fallback); notice('Default carousel restored for this election.');
    } catch (error) { notice(error.message, true); }
    finally { busy(false); }
  });
  modal.addEventListener('hidden.bs.modal', releasePreview);
})();
