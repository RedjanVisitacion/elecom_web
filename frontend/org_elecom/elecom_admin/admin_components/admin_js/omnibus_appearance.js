/* Omnibus images remain a draft until explicitly published. */
(() => {
  const el = id => document.getElementById(id);
  if (!el('omnibusPanel')) return;
  let pages = [], selected = 0, electionId, csrf, dirty = false, loading = true;
  const files = new Map(), urls = new Map();
  const election = el('omnibusElection');
  const endpoint = () => `/api/admin/elections/${encodeURIComponent(electionId)}/omnibus/`;
  const message = (text, error = false) => { el('omnibusMessage').textContent = text; el('omnibusMessage').className = `small mt-3 ${error ? 'text-danger' : 'text-muted'}`; };
  const release = id => { if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.delete(id); files.delete(id); };
  const clear = () => [...urls.keys()].forEach(release);
  const modalElement = el('filingConfirmModal'), modal = new bootstrap.Modal(modalElement);
  let pending = false;
  const ask = (title, detail, action) => new Promise(resolve => {
    if (pending) { resolve(false); return; } pending = true;
    el('filingConfirmTitle').textContent = title; el('filingConfirmDescription').textContent = detail;
    const accept = el('filingConfirmAccept'); accept.textContent = action;
    let accepted = false;
    const yes = () => { accepted = true; modal.hide(); };
    accept.addEventListener('click', yes);
    modalElement.addEventListener('hidden.bs.modal', () => { accept.removeEventListener('click', yes); pending = false; resolve(accepted); }, { once:true });
    modal.show();
  });
  const source = page => urls.get(page.id) || page.image_url || (Number.isInteger(page.default_index) ? `/static/assets/omnibus/page${String(page.default_index + 1).padStart(2, '0')}.jpg` : '');
  const render = () => {
    const page = pages[selected], ready = !!csrf && !loading;
    ['omnibusFiles','omnibusReplace','omnibusReset'].forEach(id => { el(id).disabled = !ready; });
    election.disabled = loading;
    el('omnibusSave').disabled = !ready || !dirty;
    el('omnibusUp').disabled = !ready || selected <= 0;
    el('omnibusDown').disabled = !ready || selected >= pages.length - 1;
    el('omnibusRemove').disabled = !ready || pages.length <= 1;
    el('omnibusFiles').disabled = !ready || pages.length >= 30;
    const preview = el('omnibusPreview'); preview.hidden = !page || !source(page);
    if (page && source(page)) preview.src = source(page);
    preview.alt = `Omnibus page ${selected + 1}`;
    const list = el('omnibusPages'); list.replaceChildren();
    pages.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `btn w-100 text-start mb-1 ${index === selected ? 'btn-primary' : 'btn-outline-secondary'}`;
      button.textContent = `Page ${index + 1}${files.has(item.id) ? ' · New image' : ''}`; button.disabled = !ready; button.setAttribute('aria-pressed', String(index === selected));
      button.addEventListener('click', () => { selected = index; render(); }); list.append(button);
    });
  };
  const changed = () => { dirty = true; render(); message('Unsaved changes. Save Omnibus pages to publish.'); };
  const replace = data => { clear(); pages = data.pages; selected = 0; dirty = false; el('omnibusFiles').value = ''; el('omnibusReplace').value = ''; };
  const load = async () => {
    loading = true; csrf = null; render(); message('Loading Omnibus pages...');
    try {
      const response = await fetch(endpoint(), { credentials:'same-origin', cache:'no-store' }); const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load pages.');
      replace(data); csrf = data.csrfToken; message('Select a page to preview or replace it.');
    } catch(error) { message(error.message, true); } finally { loading = false; render(); }
  };
  election.addEventListener('change', async () => {
    if (dirty && !(await ask('Switch election?', 'Unsaved Omnibus changes will be discarded.', 'Discard and switch'))) { election.value = String(electionId); return; }
    electionId = election.value; await load();
  });
  const readFiles = (input, replacing) => {
    const incoming = [...input.files].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }));
    if (!incoming.length || loading) return;
    if ((!replacing && pages.length + incoming.length > 30) || incoming.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { message('Keep up to 30 pages, with JPG, PNG or WebP images up to 5 MB each.', true); input.value = ''; return; }
    incoming.forEach(file => {
      const page = replacing ? pages[selected] : {id:'page-' + crypto.randomUUID(),default_index:null,image_url:null};
      if (!replacing) pages.push(page);
      release(page.id); files.set(page.id,file); urls.set(page.id,URL.createObjectURL(file));
    });
    if (!replacing) selected = pages.length - incoming.length;
    input.value = ''; changed();
  };
  el('omnibusFiles').addEventListener('change', event => readFiles(event.target, false));
  el('omnibusReplace').addEventListener('change', event => readFiles(event.target, true));
  const move = offset => { const target = selected + offset; if (loading || target < 0 || target >= pages.length) return; [pages[selected],pages[target]] = [pages[target],pages[selected]]; selected = target; changed(); };
  el('omnibusUp').addEventListener('click', () => move(-1)); el('omnibusDown').addEventListener('click', () => move(1));
  el('omnibusRemove').addEventListener('click', async () => {
    if (loading || pages.length <= 1 || !(await ask('Remove page?', 'This removes the selected page from your draft. Save to publish.', 'Remove page'))) return;
    release(pages[selected].id); pages.splice(selected,1); selected = Math.min(selected,pages.length-1); changed();
  });
  el('omnibusSave').addEventListener('click', async () => {
    if (loading || !dirty || !csrf) return;
    if ([...files.values()].reduce((total,file) => total + file.size,0) > 15 * 1024 * 1024) { message('Upload no more than 15 MB per save.',true); return; }
    const body = new FormData(); body.append('pages',JSON.stringify(pages)); files.forEach((file,id) => body.append(`image_${id}`,file));
    loading = true; render(); message('Publishing Omnibus pages...');
    try {
      const response = await fetch(endpoint(), {method:'POST',credentials:'same-origin',headers:{'X-CSRFToken':csrf},body}); const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to save pages.');
      replace(data); message('Omnibus pages saved. The updated mobile app will refresh automatically.');
    } catch(error) { message(error.message,true); } finally { loading = false; render(); }
  });
  el('omnibusReset').addEventListener('click', async () => {
    if (loading || !csrf || !(await ask('Restore original pages?', 'Replace saved Omnibus pages with the original 14 pages for this election?', 'Restore defaults'))) return;
    loading = true; render();
    try {
      const response = await fetch(endpoint(), {method:'DELETE',credentials:'same-origin',headers:{'X-CSRFToken':csrf}}); const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to restore pages.');
      replace(data); message('The original 14 pages are restored.');
    } catch(error) { message(error.message,true); } finally { loading = false; render(); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', clear);
  (async () => {
    try {
      const response = await fetch('/api/admin/elections/', {credentials:'same-origin',cache:'no-store'}); const data = await response.json();
      if (!response.ok || !data.ok || !data.elections?.length) throw new Error('No elections available.');
      data.elections.forEach(item => { const option = document.createElement('option'); option.value = String(item.id); option.textContent = item.name + (item.is_active ? ' — Current' : ''); election.append(option); });
      electionId = (data.elections.find(item => item.is_active) || data.elections[0]).id; election.value = String(electionId); await load();
    } catch(error) { message(error.message,true); }
  })();
})();
