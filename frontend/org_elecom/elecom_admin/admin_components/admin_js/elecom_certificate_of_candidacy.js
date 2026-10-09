document.addEventListener('DOMContentLoaded', () => {
  const endpoint = '/api/admin/certificate-of-candidacy/settings/';
  const notice = document.getElementById('cocNotice');
  const forms = [...document.querySelectorAll('[data-coc-form]')];
  const settingsForm = forms[0];
  const panels = [...document.querySelectorAll('[data-coc-preview]')];
  const previews = new Map(panels.map(panel => [panel, { timer: null, controller: null, url: '', revision: 0, pdf: null, page: null, renderTask: null, renderRevision: 0, loadedRevision: 0, mode: 'width', zoom: 1, renderQueue: Promise.resolve() }]));
  const download = document.getElementById('cocDownload');
  const dialog = document.getElementById('cocViewerDialog');
  const modalStage = document.getElementById('cocModalStage');
  const modalDownload = document.getElementById('cocModalDownload');
  const modalState = { mode: 'width', zoom: 1, revision: 0, task: null, queue: Promise.resolve() };
  let modalPanel = null;
  let pdfLibraryPromise;
  function pdfLibrary() {
    if (!pdfLibraryPromise) {
      pdfLibraryPromise = import('/static/org_elecom/elecom_admin/admin_components/vendor/pdfjs-4.10.38/pdf.min.js').then(lib => {
        lib.GlobalWorkerOptions.workerSrc = '/static/org_elecom/elecom_admin/admin_components/vendor/pdfjs-4.10.38/pdf.worker.min.js';
        return lib;
      }).catch(error => { pdfLibraryPromise = null; throw error; });
    }
    return pdfLibraryPromise;
  }
  function updateDownload() {
    const panel = panels.find(item => !item.hidden);
    const state = previews.get(panel);
    const ready = state.url && state.loadedRevision === state.revision && !state.controller && !state.timer;
    download.classList.toggle('disabled', !ready);
    download.setAttribute('aria-disabled', String(!ready)); download.tabIndex = ready ? 0 : -1;
    if (ready) {
      download.href = state.url;
      download.download = `${panel.dataset.cocPreview.toUpperCase()}_COC_Sample.pdf`;
    } else download.removeAttribute('href');
    if (dialog.open) {
      modalDownload.classList.toggle('disabled', !ready);
      modalDownload.setAttribute('aria-disabled', String(!ready)); modalDownload.tabIndex = ready ? 0 : -1;
      if (ready) { modalDownload.href = state.url; modalDownload.download = download.download; }
      else modalDownload.removeAttribute('href');
    }
  }
  const formatting = { name_is_bold: false, name_is_italic: false, year_is_bold: false, year_is_italic: false };
  function updateFormattingControls() {
    for (const group of document.querySelectorAll('[data-format-group]')) {
      const field = group.dataset.formatGroup;
      for (const button of group.querySelectorAll('[data-format]')) {
        const style = button.dataset.format;
        const active = style === 'normal' ? !formatting[field + '_is_bold'] && !formatting[field + '_is_italic'] : formatting[field + '_is_' + style];
        button.setAttribute('aria-pressed', String(active));
      }
    }
  }
  for (const group of document.querySelectorAll('[data-format-group]')) {
    group.addEventListener('click', event => {
      const button = event.target.closest('[data-format]');
      if (!button || document.getElementById('cocFields').disabled) return;
      const field = group.dataset.formatGroup;
      if (button.dataset.format === 'normal') { formatting[field + '_is_bold'] = false; formatting[field + '_is_italic'] = false; }
      else { const key = field + '_is_' + button.dataset.format; formatting[key] = !formatting[key]; }
      updateFormattingControls();
      for (const panel of panels) schedulePreview(panel, true);
    });
  }
  let csrf = '';
  let signatureBase64 = '', signatureRevision = 0, signatureLoading = false, signatureLoaded = false;
  const signaturePad = document.getElementById('chairSignaturePad');
  const signatureContext = signaturePad.getContext('2d');
  const signatureStatus = document.getElementById('chairSignatureStatus');
  let drawing = false, activePointer = null;
  function previewSignatures() { for (const panel of panels) schedulePreview(panel); }
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
      setSignatureStatus('Signature ready — save COC settings.');
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
    if (document.getElementById('cocFields').disabled || drawing || (event.pointerType === 'mouse' && event.button !== 0)) return;
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
    setSignatureStatus('Signature ready — save COC settings.'); previewSignatures();
  }
  signaturePad.addEventListener('pointerup', finishSignature);
  signaturePad.addEventListener('pointercancel', finishSignature);
  signaturePad.addEventListener('lostpointercapture', finishSignature);
  document.getElementById('chairSignatureClear').addEventListener('click', () => {
    ++signatureRevision; drawing = false; activePointer = null; signatureLoading = false;
    signatureContext.clearRect(0, 0, signaturePad.width, signaturePad.height);
    signatureBase64 = ''; document.getElementById('chairSignatureUpload').value = '';
    setSignatureStatus('Signature cleared — save COC settings.'); previewSignatures();
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
    return { form_kind: form.dataset.cocForm, ...formatting,
      academic_year_start: form.elements.academic_year_start.value,
      academic_year_end: form.elements.academic_year_end.value,
      chairperson_name: form.elements.chairperson_name.value.trim(),
      ...(signatureLoaded || signatureRevision > 0 ? { chairperson_signature_base64: signatureBase64 } : {}) };
  }
  function schedulePreview(panel, immediate = false) {
    const state = previews.get(panel);
    clearTimeout(state.timer);
    if (state.controller) state.controller.abort();
    const revision = ++state.revision;
    state.timer = null;
    panel.querySelector('[data-preview-status]').textContent = 'Updating draft preview…';
    state.timer = setTimeout(() => { state.timer = null; refreshPreview(panel, revision); }, immediate ? 0 : 200);
    updateDownload();
  }
  async function refreshPreview(panel, revision) {
    const state = previews.get(panel);
    const controller = new AbortController(); state.controller = controller;
    const status = panel.querySelector('[data-preview-status]');
    const frame = panel.querySelector('[data-preview-canvas]');
    const draft = { draft: '1', ...values(settingsForm), form_kind: panel.dataset.cocPreview };
    const { chairperson_signature_base64, ...query } = draft;
    const params = new URLSearchParams(query);
    frame.setAttribute('aria-busy', 'true');
    try {
      const previewUrl = `/api/admin/certificate-of-candidacy/template/${panel.dataset.cocPreview}/`;
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
      const lib = await pdfLibrary();
      const task = lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
      const pdf = await task.promise;
      if (controller.signal.aborted || state.revision !== revision) { await pdf.destroy(); return; }
      const page = await pdf.getPage(1);
      if (controller.signal.aborted || state.revision !== revision) { await pdf.destroy(); return; }
      const previousPdf = state.pdf;
      state.page = page; state.pdf = pdf;
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = URL.createObjectURL(blob);
      await showDocument(panel);
      if (dialog.open && modalPanel === panel) await showModal();
      if (previousPdf) await previousPdf.destroy();
      if (controller.signal.aborted || state.revision !== revision) return;
      state.loadedRevision = revision;
      status.textContent = 'Draft preview — save settings to apply these changes.';
      status.className = 'coc-preview-status coc-help';
    } catch (error) {
      if (error.name !== 'AbortError' && state.revision === revision) {
        status.textContent = `Preview paused: ${error.message}`;
        status.className = 'coc-preview-status coc-help text-danger';
      }
    } finally {
      if (state.revision === revision) { frame.setAttribute('aria-busy', 'false'); state.controller = null; updateDownload(); }
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
        const config = data.forms?.usg || data.forms?.department;
        updateYear(form, config?.academic_year_start || new Date().getFullYear());
        form.elements.chairperson_name.value = config?.chairperson_name || '';
        for (const key of Object.keys(formatting)) formatting[key] = config?.[key] === true;
        updateFormattingControls();
      }
      document.getElementById('cocFields').disabled = false;
      message('');
    } catch (error) { message(error.message, true); }
    finally {
      for (const form of forms) {
        form.querySelector('[type=submit]').disabled = document.getElementById('cocFields').disabled;
        for (const panel of panels) schedulePreview(panel, true);
      }
    }
  }
  for (const form of forms) {
    updateYear(form, new Date().getFullYear());
    form.elements.academic_year_start.addEventListener('input', () => {
      updateYear(form);
    });
    form.addEventListener('input', previewSignatures);
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
    if (dialog.open) dialog.close();
    for (const state of previews.values()) {
      clearTimeout(state.timer); ++state.revision;
      if (state.controller) state.controller.abort();
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = '';
      ++state.renderRevision; if (state.task) state.task.cancel();
      state.page = null; if (state.pdf) state.pdf.destroy(); state.pdf = null;
    }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) for (const panel of panels) schedulePreview(panel, true); });
  document.getElementById('chairSignatureUploadButton').addEventListener('click', () => document.getElementById('chairSignatureUpload').click());
  const tabs = [...document.querySelectorAll('[data-preview-tab]')];
  function selectTab(tab) {
    for (const item of tabs) { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; }
    for (const panel of panels) panel.hidden = panel.dataset.cocPreview !== tab.dataset.previewTab;
    updateDownload();
    showDocument(panels.find(panel => !panel.hidden)).catch(() => {});
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[index]); tabs[index].focus();
    });
  }
  function viewerControls(root, state, scale) {
    root.querySelector('[data-viewer-scale]').textContent = `${Math.round(scale * 100)}%`;
    for (const button of root.querySelectorAll('[data-viewer-fit]')) {
      button.setAttribute('aria-pressed', String(button.dataset.viewerFit === state.mode && state.zoom === 1));
    }
    root.querySelector('[data-viewer-zoom="-1"]').disabled = state.zoom <= .5;
    root.querySelector('[data-viewer-zoom="1"]').disabled = state.zoom >= 3;
  }
  async function renderPage(page, stage, state, root, current) {
    const base = page.getViewport({ scale: 1 });
    // Reserve scrollbar space so switching to Fit Width does not resize repeatedly.
    const width = (stage.clientWidth - 24) / base.width;
    const fit = state.mode === 'width' ? width : Math.min(width, (stage.clientHeight - 24) / base.height);
    const scale = fit * state.zoom;
    if (scale <= 0) return;
    const cssWidth = base.width * scale, cssHeight = base.height * scale;
    stage.classList.toggle('is-fit-page', state.mode === 'page' && state.zoom === 1);
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (cssWidth * cssHeight)));
    const viewport = page.getViewport({ scale: scale * ratio });
    const buffer = document.createElement('canvas');
    buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height);
    const task = page.render({ canvasContext: buffer.getContext('2d'), viewport });
    state.task = task;
    try {
      await task.promise;
      if (!current()) return;
      const canvas = stage.querySelector('[data-preview-canvas]');
      canvas.width = buffer.width; canvas.height = buffer.height;
      canvas.style.width = `${cssWidth}px`; canvas.style.height = `${cssHeight}px`;
      canvas.getContext('2d').drawImage(buffer, 0, 0); canvas.hidden = false;
      viewerControls(root, state, scale);
    } catch (error) { if (error.name !== 'RenderingCancelledException') throw error; }
    finally { if (state.task === task) state.task = null; }
  }
  function showDocument(panel) {
    const state = previews.get(panel);
    const revision = ++state.renderRevision;
    if (state.task) state.task.cancel();
    state.renderQueue = state.renderQueue.catch(() => {}).then(async () => {
      if (revision !== state.renderRevision || panel.hidden || !state.page) return;
      try {
        await renderPage(state.page, panel.querySelector('.coc-document-stage'), state,
          document.querySelector('.coc-preview-actions'), () => revision === state.renderRevision && !panel.hidden);
      } catch (error) { panel.querySelector('[data-preview-status]').textContent = `Preview paused: ${error.message}`; throw error; }
    });
    return state.renderQueue;
  }
  function showModal() {
    const revision = ++modalState.revision;
    if (modalState.task) modalState.task.cancel();
    modalState.queue = modalState.queue.catch(() => {}).then(async () => {
      const state = previews.get(modalPanel);
      if (!dialog.open || revision !== modalState.revision || !state?.page) return;
      await renderPage(state.page, modalStage, modalState, dialog,
        () => dialog.open && revision === modalState.revision);
    }).catch(error => { document.getElementById('cocModalStatus').textContent = `Preview paused: ${error.message}`; });
    return modalState.queue;
  }
  function bindControls(root, getState, getStage, render) {
    for (const button of root.querySelectorAll('[data-viewer-zoom], [data-viewer-fit]')) {
      button.addEventListener('click', () => {
        const state = getState();
        if (button.dataset.viewerFit) { state.mode = button.dataset.viewerFit; state.zoom = 1; getStage().scrollTo(0, 0); }
        else state.zoom = Math.min(3, Math.max(.5, state.zoom + Number(button.dataset.viewerZoom) * .25));
        render().catch(() => {});
      });
    }
  }
  const activePanel = () => panels.find(panel => !panel.hidden);
  bindControls(document.querySelector('.coc-preview-actions'), () => previews.get(activePanel()),
    () => activePanel().querySelector('.coc-document-stage'), () => showDocument(activePanel()));
  bindControls(dialog, () => modalState, () => modalStage, showModal);
  document.getElementById('cocExpand').addEventListener('click', () => {
    modalPanel = activePanel(); modalState.mode = 'width'; modalState.zoom = 1;
    document.getElementById('cocViewerTitle').textContent = `${modalPanel.dataset.cocPreview === 'usg' ? 'USG' : 'Department'} COC Preview`;
    document.getElementById('cocModalStatus').textContent = 'Draft sample. Download the PDF to print using your device PDF viewer.';
    modalStage.querySelector('canvas').hidden = true;
    dialog.showModal(); modalStage.scrollTo(0, 0); updateDownload(); showModal();
  });
  document.getElementById('cocViewerClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { ++modalState.revision; if (modalState.task) modalState.task.cancel(); modalPanel = null; });
  const resizeObserver = new ResizeObserver(() => {
    for (const panel of panels) if (!panel.hidden) showDocument(panel).catch(() => {});
    if (dialog.open) showModal();
  });
  for (const panel of panels) resizeObserver.observe(panel.querySelector('.coc-document-stage'));
  resizeObserver.observe(modalStage);
  load();
});
