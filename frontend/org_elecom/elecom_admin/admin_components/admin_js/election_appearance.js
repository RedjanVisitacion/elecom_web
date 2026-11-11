/* Per-election filing slideshow editor. All changes stay in draft until saved. */
(() => {
  const panel = document.getElementById('filingAppearancePanel');
  if (!panel) return;
  const el = id => document.getElementById(id);
  const electionSelect = el('appearanceElectionSelect'), form = el('filingAppearanceForm');
  const preview = el('filingBackgroundPreview'), input = el('filingBackgroundFile');
  const title = el('filingSlideTitle'), subtitle = el('filingSlideSubtitle');
  const preset = el('filingSlidePreset'), defaultText = el('filingUseDefaultText');
  const message = el('filingAppearanceMessage'), list = el('filingSlideList');
  const save = el('saveFilingAppearance'), reset = el('resetFilingAppearance');
  let slides = [], defaults = [], selected = 0, electionId, csrfToken, loading = false, dirty = false, timer;
  const files = new Map(), urls = new Map();
  const confirmElement = el('filingConfirmModal');
  const confirmDialog = new bootstrap.Modal(confirmElement);
  let confirmationPending = false;
  const askConfirmation = (heading, detail, action) => new Promise(resolve => {
    if (confirmationPending) { resolve(false); return; }
    confirmationPending = true;
    stop();
    el('filingConfirmTitle').textContent = heading;
    el('filingConfirmDescription').textContent = detail;
    const accept = el('filingConfirmAccept');
    accept.textContent = action;
    let accepted = false;
    const onAccept = () => { accepted = true; confirmDialog.hide(); };
    accept.addEventListener('click', onAccept);
    confirmElement.addEventListener('hidden.bs.modal', () => {
      accept.removeEventListener('click', onAccept);
      confirmationPending = false;
      resolve(accepted);
    }, { once: true });
    confirmDialog.show();
  });
  const endpoint = () => `/api/admin/elections/${encodeURIComponent(electionId)}/appearance/`;
  const defaultImage = index => `/static/assets/filing-slides/${index}.png`;
  const notice = (text, error = false) => { message.textContent = text; message.className = error ? 'text-danger small mt-3' : 'text-muted small mt-3'; };
  const stop = () => { clearInterval(timer); timer = null; el('filingPreviewPlay').textContent = 'Play preview'; };
  const clearFile = id => { if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.delete(id); files.delete(id); };
  const clearFiles = () => [...urls.keys()].forEach(clearFile);
  const imageFor = slide => urls.get(slide.id) || slide.image_url || defaultImage(slide.default_index);
  const changed = () => { stop(); dirty = true; render(); notice('Unsaved changes. Click Save slideshow to publish.'); };
  const render = () => {
    const active = slides[selected];
    const editable = !!active && !!csrfToken && !loading;
    form.querySelectorAll('button,input,select,textarea').forEach(control => { control.disabled = !editable; });
    electionSelect.disabled = loading || !electionSelect.options.length;
    save.disabled = !editable || !dirty;
    el('addFilingSlide').disabled = !editable || slides.length >= 10;
    el('removeFilingSlide').disabled = !editable || slides.length <= 1;
    el('moveFilingSlideUp').disabled = !editable || selected <= 0;
    el('moveFilingSlideDown').disabled = !editable || selected >= slides.length - 1;
    list.replaceChildren();
    slides.forEach((slide, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'filing-slide-choice' + (index === selected ? ' is-selected' : '');
      button.setAttribute('aria-pressed', String(index === selected));
      button.textContent = `${index + 1}. ${slide.title}`; button.disabled = loading;
      button.addEventListener('click', () => { stop(); selected = index; input.value = ''; render(); });
      list.append(button);
    });
    if (!active) return;
    preview.src = imageFor(active);
    el('filingPreviewTitle').textContent = active.title;
    el('filingPreviewSubtitle').textContent = active.subtitle;
    el('filingSlideCounter').textContent = `Slide ${selected + 1} of ${slides.length}`;
    el('filingEditorTitle').textContent = `Edit slide ${selected + 1}`;
    if (title.value !== active.title) title.value = active.title;
    if (subtitle.value !== active.subtitle) subtitle.value = active.subtitle;
    preset.value = String(active.default_index); defaultText.checked = active.use_default_text;
    title.disabled = !editable || active.use_default_text;
    subtitle.disabled = !editable || active.use_default_text;
    el('filingTitleCount').textContent = `${active.title.length}/60`;
    el('filingSubtitleCount').textContent = `${active.subtitle.length}/160`;
    el('filingPreviewPrevious').disabled = !editable || slides.length < 2;
    el('filingPreviewNext').disabled = !editable || slides.length < 2;
    el('filingPreviewPlay').disabled = !editable || slides.length < 2;
    reset.disabled = !csrfToken || loading;
  };
  const busy = value => { loading = value; render(); };
  const replaceSlides = data => {
    stop(); clearFiles(); input.value = '';
    slides = data.slides.map(slide => ({ ...slide }));
    defaults = (data.defaults || defaults).map(slide => ({ ...slide }));
    selected = 0; dirty = false;
  };
  const load = async () => {
    csrfToken = null; busy(true); notice('Loading saved slides...');
    try {
      const response = await fetch(endpoint(), { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.slides)) throw new Error(data.error || 'Unable to load the slideshow.');
      replaceSlides(data); csrfToken = data.csrfToken;
      preset.replaceChildren();
      defaults.forEach(slide => { const option = document.createElement('option'); option.value = String(slide.default_index); option.textContent = slide.title; preset.append(option); });
      notice('Select a slide to edit. Changes apply only after saving.');
    } catch (error) { notice(error.message, true); }
    finally { busy(false); }
  };
  electionSelect.addEventListener('change', async () => {
    if (dirty && !(await askConfirmation('Switch election?', 'Your unsaved slideshow changes will be discarded.', 'Discard and switch'))) { electionSelect.value = String(electionId); return; }
    electionId = electionSelect.value; load();
  });
  el('addFilingSlide').addEventListener('click', () => {
    if (loading || slides.length >= 10) return;
    const base = defaults[2];
    slides.push({ ...base, id: 'slide-' + (window.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)) });
    selected = slides.length - 1; input.value = ''; changed();
  });
  el('removeFilingSlide').addEventListener('click', async () => {
    if (loading || slides.length <= 1 || !(await askConfirmation('Remove slide?', 'Remove this slide from your draft? Publish with Save slideshow when you are ready.', 'Remove slide'))) return;
    clearFile(slides[selected].id); slides.splice(selected, 1); selected = Math.min(selected, slides.length - 1); input.value = ''; changed();
  });
  const move = offset => {
    const target = selected + offset;
    if (loading || target < 0 || target >= slides.length) return;
    [slides[selected], slides[target]] = [slides[target], slides[selected]]; selected = target; changed();
  };
  el('moveFilingSlideUp').addEventListener('click', () => move(-1));
  el('moveFilingSlideDown').addEventListener('click', () => move(1));
  defaultText.addEventListener('change', () => {
    const active = slides[selected]; active.use_default_text = defaultText.checked;
    if (active.use_default_text) { active.title = defaults[active.default_index].title; active.subtitle = defaults[active.default_index].subtitle; }
    changed();
  });
  preset.addEventListener('change', () => {
    const active = slides[selected]; active.default_index = Number(preset.value);
    if (active.use_default_text) { active.title = defaults[active.default_index].title; active.subtitle = defaults[active.default_index].subtitle; }
    changed();
  });
  title.addEventListener('input', () => { slides[selected].title = title.value; changed(); });
  subtitle.addEventListener('input', () => { slides[selected].subtitle = subtitle.value; changed(); });
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = ''; notice('Choose a JPG, PNG or WebP image up to 5 MB.', true); return;
    }
    const id = slides[selected].id; clearFile(id); files.set(id, file); urls.set(id, URL.createObjectURL(file)); changed();
  });
  el('restoreFilingSlideImage').addEventListener('click', () => {
    const active = slides[selected]; clearFile(active.id); active.image_url = null; input.value = ''; changed();
  });
  preview.addEventListener('error', () => {
    const active = slides[selected]; if (active && preview.getAttribute('src') !== defaultImage(active.default_index)) preview.src = defaultImage(active.default_index);
  });
  const advance = offset => { selected = (selected + offset + slides.length) % slides.length; input.value = ''; render(); };
  el('filingPreviewPrevious').addEventListener('click', () => { stop(); advance(-1); });
  el('filingPreviewNext').addEventListener('click', () => { stop(); advance(1); });
  el('filingPreviewPlay').addEventListener('click', () => {
    if (timer) { stop(); return; }
    el('filingPreviewPlay').textContent = 'Pause preview'; timer = setInterval(() => advance(1), 4000);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (loading || !csrfToken || !dirty) return;
    stop();
    if (slides.some(slide => !slide.title.trim() || !slide.subtitle.trim())) { notice('Every slide needs a title and description, or select Use provided text.', true); return; }
    if ([...files.values()].reduce((sum, file) => sum + file.size, 0) > 15 * 1024 * 1024) { notice('Save no more than 15 MB of new images at once.', true); return; }
    const body = new FormData(); body.append('slides', JSON.stringify(slides));
    files.forEach((file, id) => body.append(`image_${id}`, file));
    busy(true); notice('Publishing slideshow...');
    try {
      const response = await fetch(endpoint(), { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to publish. Try smaller images or save fewer new uploads at once.');
      replaceSlides(data); notice('Slideshow saved. The updated mobile app will refresh it automatically.');
      window.ElecomToast?.success('Filing slideshow saved.');
    } catch (error) { notice(error.message, true); }
    finally { busy(false); }
  });
  reset.addEventListener('click', async () => {
    if (loading || !csrfToken || !(await askConfirmation('Restore default slides?', 'This replaces the saved slideshow for this election with the five original slides and discards unsaved edits.', 'Restore defaults'))) return;
    stop(); busy(true);
    try {
      const response = await fetch(endpoint(), { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken } });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to restore defaults.');
      replaceSlides(data); notice('The five default slides and provided text are restored.');
    } catch (error) { notice(error.message, true); }
    finally { busy(false); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', () => { stop(); clearFiles(); });
  (async () => {
    busy(true); notice('Loading elections...');
    try {
      const response = await fetch('/api/admin/elections/', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load elections.');
      const elections = data.elections || []; electionSelect.replaceChildren();
      if (!elections.length) { notice('Create an election in Election Management first.'); busy(false); return; }
      elections.forEach(election => { const option = document.createElement('option'); option.value = String(election.id); option.textContent = `${election.name || 'Election #' + election.id}${election.school_year ? ' (' + election.school_year + ')' : ''}${election.is_active ? ' - Current' : ''}`; electionSelect.append(option); });
      const requested = new URLSearchParams(window.location.search).get('election_id');
      const selectedElection = elections.find(election => String(election.id) === requested) || elections.find(election => election.is_active) || elections[0];
      electionId = String(selectedElection.id); electionSelect.value = electionId; await load();
    } catch (error) { notice(error.message, true); busy(false); }
  })();
})();
