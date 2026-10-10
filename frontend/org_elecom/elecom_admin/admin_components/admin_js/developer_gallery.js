(() => {
  'use strict';
  const panel = document.getElementById('galleryPanel');
  const grid = document.getElementById('developerGalleryUsers');
  const status = document.getElementById('developerGalleryStatus');
  const query = document.getElementById('developerGalleryQuery');
  const previous = document.getElementById('developerGalleryPrevious');
  const next = document.getElementById('developerGalleryNext');
  const refresh = document.getElementById('developerGalleryRefresh');
  const modalElement = document.getElementById('developerGalleryViewer');
  const modal = new bootstrap.Modal(modalElement);
  let page = 1, busy = false, more = false;
  function controls() {
    previous.disabled = busy || page === 1;
    next.disabled = busy || !more;
    refresh.disabled = busy;
    document.getElementById('developerGallerySearchButton').disabled = busy;
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function dateLabel(value) {
    if (!value) return 'Upload date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Upload date unavailable' : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  }
  function showImage(user, image) {
    const full = document.getElementById('developerGalleryFullImage');
    const title = document.getElementById('developerGalleryViewerTitle');
    title.textContent = `${user.name} — ${image.kind}`;
    document.getElementById('developerGalleryImageDetails').textContent = `${user.student_id} · ${dateLabel(image.uploaded_at)}${image.status ? ` · ${image.status}` : ''}`;
    full.alt = `${image.kind} uploaded by ${user.name}`;
    full.src = image.url;
    document.getElementById('developerGalleryOriginal').href = image.url;
    modal.show();
  }
  modalElement.addEventListener('hidden.bs.modal', () => document.getElementById('developerGalleryFullImage').removeAttribute('src'));
  async function load() {
    if (busy) return;
    busy = true; controls(); status.textContent = 'Loading saved images…';
    grid.replaceChildren();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`/api/admin/developer/gallery/?${new URLSearchParams({page, q: query.value.trim()})}`, {credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Server returned an unexpected response. Refresh or try again.'); }
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load images.');
      more = data.has_more;
      for (const user of data.users) {
        const group = node('section', 'gallery-user-group');
        group.append(node('h3', 'h6 fw-bold mb-1', user.name));
        group.append(node('p', 'text-muted small mb-3', `${user.student_id} · ${user.images.length} saved image${user.images.length === 1 ? '' : 's'}`));
        const images = node('div', 'gallery-image-grid');
        for (const image of user.images) {
          const card = node('article', 'gallery-image-card');
          const button = node('button', 'gallery-image-button'); button.type = 'button';
          button.setAttribute('aria-label', `View ${image.kind} for ${user.name}`);
          const img = node('img', ''); img.src = image.url; img.alt = `${user.name} — ${image.kind}`;
          img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', () => { img.remove(); button.append(node('span', 'text-muted small', 'Image unavailable — open original')); }, {once: true});
          button.append(img); button.addEventListener('click', () => showImage(user, image)); card.append(button);
          card.append(node('div', 'small fw-semibold mt-2', image.kind));
          card.append(node('div', 'small text-muted', dateLabel(image.uploaded_at)));
          if (image.status) card.append(node('div', 'small text-muted', image.status));
          images.append(card);
        }
        group.append(images); grid.append(group);
      }
      status.textContent = data.users.length ? `Page ${page} · ${data.users.length} user${data.users.length === 1 ? '' : 's'} with saved images` : 'No users with saved images match your search.';
    } catch (error) { more = false; status.textContent = error.name === 'AbortError' ? 'Loading timed out. Try Refresh.' : error.message; }
    finally { clearTimeout(timeout); busy = false; controls(); }
  }
  document.querySelector('[data-developer-panel="galleryPanel"]').addEventListener('click', load);
  document.getElementById('developerGallerySearch').addEventListener('submit', event => {event.preventDefault(); if (!busy) {page = 1; load();}});
  previous.addEventListener('click', () => {if (!busy && page > 1) {page--; load();}});
  next.addEventListener('click', () => {if (!busy && more) {page++; load();}});
  refresh.addEventListener('click', load);
  controls();
})();
