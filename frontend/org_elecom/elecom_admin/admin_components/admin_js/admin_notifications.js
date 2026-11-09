/* Browser push is opt-in. The notification bell remains available without it. */
(() => {
  const API = '/api/admin/notifications/browser-push/';
  let state, messaging, sdk, token, registration, busy = false;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Private browsing may disable storage. */ } };
  const key = suffix => `elecom.admin.notifications.${state?.account || 'pending'}.${suffix}`;
  const toast = (text, title = 'Admin notifications', type = 'info') => window.ElecomToast?.show(text, { title, type, duration: 6000 });
  const newAlerts = (alerts, previous) => previous === null ? [] : alerts.filter(item => !previous.includes(String(item.id)));
  const receive = alerts => {
    if (!state || !Array.isArray(alerts)) return;
    const previous = read(key('announced'), null);
    const fresh = newAlerts(alerts, previous);
    // Persist before displaying so another open tab does not repeat the same batch.
    write(key('announced'), [...new Set([...(previous || []), ...alerts.map(item => String(item.id))])].slice(-300));
    if (read(key('inApp'), true)) fresh.slice(0, 3).forEach(item => {
      toast(item.body || 'Open the notification bell for details.', item.title || 'New admin alert', item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'info');
    });
  };
  const request = async (method, pushToken) => {
    const response = await fetch(API, { method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': state.csrfToken },
      body: JSON.stringify({ token: pushToken }) });
    if (!response.ok) throw new Error('Unable to save browser notification settings.');
  };
  const loadMessaging = async () => {
    if (messaging) return;
    const app = await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js');
    sdk = await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging.js');
    if (!await sdk.isSupported()) throw new Error('Push notifications are not supported by this browser.');
    registration = await navigator.serviceWorker.register('/admin-notifications-sw.js', { scope: '/' });
    if (!registration.active) await new Promise((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) return reject(new Error('Notification worker did not start.'));
      const timer = setTimeout(() => reject(new Error('Notification setup timed out. Try again.')), 15000);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
        if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('Notification worker failed.')); }
      });
    });
    messaging = sdk.getMessaging(app.initializeApp(state.config, 'elecom-admin'));
    sdk.onMessage(messaging, () => document.dispatchEvent(new Event('elecom:admin-alerts-refresh')));
  };
  const enable = async () => {
    if (!state.configured) throw new Error('Browser push setup is pending. In-app alerts are available.');
    if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Use a supported browser over HTTPS to enable push.');
    // Permission is requested only in direct response to the Enable button.
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Allow notifications in your browser site settings, then try again.');
    await loadMessaging();
    token = await sdk.getToken(messaging, { vapidKey: state.vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error('No browser token was issued. Try again.');
    await request('POST', token);
    write(key('push'), true);
  };
  const disable = async () => {
    if (token) { await request('DELETE', token); await sdk.deleteToken(messaging); token = null; }
    write(key('push'), false);
  };
  const updateButton = () => {
    const button = document.getElementById('adminBrowserPush');
    if (button) { button.disabled = busy || !state; button.textContent = token ? 'Disable browser push' : 'Enable browser push'; }
  };
  const init = async () => {
    try {
      const response = await fetch(API, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      state = await response.json();
      const checkbox = document.getElementById('adminInAppAlerts');
      if (checkbox) checkbox.checked = read(key('inApp'), true);
      updateButton();
      if (state.configured && read(key('push'), false) && 'Notification' in window && Notification.permission === 'granted') {
        await enable(); updateButton();
      }
      document.dispatchEvent(new Event('elecom:admin-alerts-refresh'));
    } catch (_) { /* In-app notifications and navigation remain available. */ }
  };
  document.addEventListener('click', async event => {
    if (!event.target.closest('#adminBrowserPush') || busy || !state) return;
    busy = true; updateButton();
    try { if (token) { await disable(); toast('Browser push disabled.'); } else { await enable(); toast('Browser push enabled.'); } }
    catch (error) { toast(error.message, 'Browser notifications', 'warning'); }
    finally { busy = false; updateButton(); }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'adminInAppAlerts' && state) write(key('inApp'), event.target.checked);
  });
  window.ElecomAdminNotifications = { receive, init, newAlerts, disable };
})();
