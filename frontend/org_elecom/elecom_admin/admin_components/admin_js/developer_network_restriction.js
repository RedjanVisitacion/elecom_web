(() => {
  'use strict';
  const toggle = document.getElementById('enforceRestrictionToggle');
  const status = document.getElementById('developerNetworkStatus');
  const retry = document.getElementById('developerNetworkRetry');
  const open = document.querySelector('[data-developer-panel="networkRestrictionPanel"]');
  let saved = false, busy = false;

  function showSavedState() {
    toggle.checked = saved;
    status.textContent = saved
      ? 'Enabled: voting requires an authorized network.'
      : 'Disabled: voting is not restricted by network.';
  }

  async function request(options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/admin/network-settings/', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...options,
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to update network restriction.');
      return data;
    } finally { clearTimeout(timer); }
  }

  async function load() {
    if (busy) return;
    busy = true; toggle.disabled = true; retry.hidden = true;
    status.textContent = 'Loading network restriction…';
    try {
      const data = await request();
      saved = data.enabled === true;
      showSavedState();
      toggle.disabled = false;
    } catch (error) {
      status.textContent = error.message || 'Unable to load network restriction.';
      retry.hidden = false;
    } finally { busy = false; }
  }

  toggle.addEventListener('change', async () => {
    if (busy) return;
    busy = true; toggle.disabled = true; retry.hidden = true;
    status.textContent = 'Saving network restriction…';
    try {
      const data = await request({method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'set_enabled', enabled: toggle.checked})});
      saved = data.enabled === true;
      showSavedState();
    } catch (error) {
      toggle.checked = saved;
      status.textContent = error.message || 'Unable to save network restriction.';
      // Re-read server state on retry, including after an ambiguous timeout.
      toggle.disabled = true;
      retry.hidden = false;
      return;
    } finally { busy = false; }
    toggle.disabled = false;
  });
  open.addEventListener('click', load);
  retry.addEventListener('click', load);
})();
