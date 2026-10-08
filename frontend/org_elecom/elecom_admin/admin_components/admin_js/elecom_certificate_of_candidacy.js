document.addEventListener('DOMContentLoaded', () => {
  const endpoint = '/api/admin/certificate-of-candidacy/settings/';
  const notice = document.getElementById('cocNotice');
  const forms = [...document.querySelectorAll('[data-coc-form]')];
  const previews = new Map(forms.map(form => [form, { timer: null, controller: null, url: '', revision: 0 }]));
  let csrf = '';
  let signatureBase64 = '', signatureRevision = 0, signatureLoading = false, signatureLoaded = false;
  const signaturePad = document.getElementById('chairSignaturePad');
  const signatureContext = signaturePad.getContext('2d');
  const signatureStatus = document.getElementById('chairSignatureStatus');
  let drawing = false, activePointer = null;
  function previewSignatures() { for (const form of forms) schedulePreview(form); }
  function setSignatureStatus(text) { signatureStatus.textContent = text; }
  function paintSignature(encoded, revision) {
    signatureLoading = true;
    const img = new Image();
    img.onload = () => {
      if (revision !== signatureRevision) return;
      signatureContext.clearRect(0, 0, signaturePad.width, signaturePad.height);
      const scale = Math.min((signaturePad.width - 30) / img.width, (signaturePad.height - 20) / img.height);
      const width = img.width * scale, height = img.height * scale;
      signatureContext.drawImage(img, (signaturePad.width - width) / 2, (signaturePad.height - height) / 2, width, height);
      signatureBase64 = encoded; signatureLoading = false;
      setSignatureStatus('Signature ready — save for both forms.');
      previewSignatures();
    };
    img.onerror = () => { if (revision === signatureRevision) { signatureLoading = false; message('Use a valid PNG signature.', true); } };
    img.src = `data:image/png;base64,${encoded}`;
  }
  function point(event) {
    const rect = signaturePad.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * signaturePad.width / rect.width,
      y: (event.clientY - rect.top) * signaturePad.height / rect.height };
  }
  signaturePad.addEventListener('pointerdown', event => {
    if (drawing || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); ++signatureRevision; signatureLoading = false; drawing = true; activePointer = event.pointerId;
    signaturePad.setPointerCapture(event.pointerId);
    const p = point(event);
    signatureContext.strokeStyle = '#111'; signatureContext.fillStyle = '#111';
    signatureContext.lineWidth = 2.5; signatureContext.lineCap = 'round'; signatureContext.lineJoin = 'round';
    signatureContext.beginPath(); signatureContext.arc(p.x, p.y, 1.25, 0, 2 * Math.PI); signatureContext.fill();
    signatureContext.beginPath(); signatureContext.moveTo(p.x, p.y);
  });
  signaturePad.addEventListener('pointermove', event => {
    if (!drawing || event.pointerId !== activePointer) return;
    const p = point(event); signatureContext.lineTo(p.x, p.y); signatureContext.stroke();
  });
  function finishSignature(event) {
    if (!drawing || event.pointerId !== activePointer) return;
    drawing = false; activePointer = null;
    signatureBase64 = signaturePad.toDataURL('image/png').split(',')[1];
    setSignatureStatus('Signature ready — save for both forms.'); previewSignatures();
  }
  signaturePad.addEventListener('pointerup', finishSignature);
  signaturePad.addEventListener('pointercancel', finishSignature);
  signaturePad.addEventListener('lostpointercapture', finishSignature);
  document.getElementById('chairSignatureClear').addEventListener('click', () => {
    ++signatureRevision; drawing = false; activePointer = null; signatureLoading = false;
    signatureContext.clearRect(0, 0, signaturePad.width, signaturePad.height);
    signatureBase64 = ''; document.getElementById('chairSignatureUpload').value = '';
    setSignatureStatus('Signature cleared — save for both forms.'); previewSignatures();
  });
  document.getElementById('chairSignatureUpload').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 1024 * 1024 || !/\.png$/i.test(file.name)) {
      message('Choose a PNG signature no larger than 1 MB.', true); event.target.value = ''; return;
    }
    const revision = ++signatureRevision; signatureLoading = true;
    const reader = new FileReader();
    reader.onload = () => { if (revision === signatureRevision) paintSignature(String(reader.result).split(',')[1], revision); };
    reader.onerror = () => { if (revision === signatureRevision) { signatureLoading = false; message('Could not read the signature file.', true); } };
    reader.readAsDataURL(file);
  });

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
      chairperson_name: form.elements.chairperson_name.value.trim(),
      ...(signatureLoaded || signatureRevision > 0 ? { chairperson_signature_base64: signatureBase64 } : {}) };
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
    const draft = { draft: '1', ...values(form) };
    const { chairperson_signature_base64, ...query } = draft;
    const params = new URLSearchParams(query);
    frame.setAttribute('aria-busy', 'true');
    try {
      const previewUrl = `/api/admin/certificate-of-candidacy/template/${form.dataset.cocForm}/`;
      const response = await fetch(signatureBase64 ? previewUrl : `${previewUrl}?${params}`, {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(signatureBase64 ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf }, body: JSON.stringify(draft) } : {}),
      });
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
      const data = await response.json().catch(() => { throw new Error('The server could not load COC settings. Check Gunicorn logs and repair the filing database schema.'); });
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load certificate settings.');
      csrf = data.csrf_token || ''; signatureLoaded = true;
      if (signatureRevision === 0 && data.chairperson_signature_base64) {
        paintSignature(data.chairperson_signature_base64, signatureRevision);
      }
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
    form.addEventListener('input', () => {
      for (const other of forms) {
        if (other !== form) {
          updateYear(other, form.elements.academic_year_start.value);
          other.elements.chairperson_name.value = form.elements.chairperson_name.value;
        }
        schedulePreview(other);
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (signatureLoading || drawing) { message('Finish drawing or loading the signature before saving.', true); return; }
      if (!form.reportValidity()) return;
      for (const other of forms) other.querySelector('[type=submit]').disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          body: JSON.stringify(values(form)),
        });
        const data = await response.json().catch(() => { throw new Error('The server could not load COC settings. Check Gunicorn logs and repair the filing database schema.'); });
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save certificate settings.');
        csrf = data.csrf_token || csrf;
        message('Certificate settings saved for USG and department forms.');
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
