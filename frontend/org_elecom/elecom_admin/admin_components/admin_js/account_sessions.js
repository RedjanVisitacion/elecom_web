/* Shared account sessions: browser and mobile use the same ownership-checked API. */
(() => {
  const panel = document.getElementById("settings-sessions");
  if (!panel) return;
  const list = document.getElementById("accountSessionsList");
  const status = document.getElementById("sessionsStatus");
  const refresh = document.getElementById("sessionsRefresh");
  const logoutAll = document.getElementById("sessionsLogoutAll");
  const dialog = document.getElementById("sessionLogoutDialog");
  let sessions = [], busy = false, generation = 0;
  const ended = () => window.location.replace("/login/?session_ended=1");
  const time = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Unavailable for this older session";
  };
  const text = (tag, value, className) => {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  const controls = () => {
    refresh.disabled = busy;
    logoutAll.disabled = busy || !sessions.length;
    list.querySelectorAll("button").forEach(button => { button.disabled = busy; });
  };
  const render = () => {
    list.replaceChildren();
    for (const session of sessions) {
      const card = document.createElement("article");
      card.className = "account-session-card";
      card.append(text("h4", session.device_name || "Device"));
      if (session.is_current) card.append(text("p", "This browser", "account-session-current"));
      card.append(text("p", "IP address: " + (session.ip_address || "Unavailable")),
        text("p", "Signed in: " + time(session.signed_in_at)),
        text("p", "Last active: " + time(session.last_active_at)));
      const button = text("button", "Log out", "profile-button secondary");
      button.type = "button";
      button.setAttribute("aria-label", "Log out " + (session.device_name || "device"));
      button.addEventListener("click", () => revoke(session));
      card.append(button); list.append(card);
    }
    controls();
  };
  const load = async () => {
    if (busy) return;
    const request = ++generation;
    busy = true; controls(); status.textContent = "Loading signed-in devices...";
    try {
      const response = await fetch("/api/mobile/account/sessions/", {
        credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401) { ended(); return; }
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.sessions)) throw new Error();
      if (request !== generation) return;
      sessions = data.sessions; render();
      status.textContent = sessions.length ? "" : "No active sessions found.";
    } catch (_) {
      if (request === generation) status.textContent = "Unable to load devices. Select Refresh devices to try again.";
    } finally {
      if (request === generation) { busy = false; controls(); }
    }
  };
  const confirm = session => new Promise(resolve => {
    document.getElementById("sessionLogoutTitle").textContent = session ? "Log out this device?" : "Log out all devices?";
    document.getElementById("sessionLogoutMessage").textContent = !session
      ? "Every web and mobile session, including this browser, will need to sign in again."
      : session.is_current ? "This browser will return to the login page."
      : "This device will need to sign in again to access your account.";
    dialog.returnValue = "cancel";
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), {once: true});
    dialog.showModal();
  });
  const revoke = async session => {
    if (busy) return;
    busy = true; controls();
    let reload = false;
    try {
      if (!await confirm(session)) return;
      status.textContent = "Logging out...";
      const csrf = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("csrftoken="));
      const response = await fetch("/api/mobile/account/sessions/logout/", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000),
        headers: {"Content-Type": "application/json", "X-CSRFToken": csrf ? decodeURIComponent(csrf.slice(10)) : ""},
        body: JSON.stringify(session ? {session_id: session.id} : {all: true}),
      });
      if (response.status === 401) { ended(); return; }
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      if (data.current_session_ended) { ended(); return; }
      window.ElecomToast.success("Device logged out.");
      reload = true;
    } catch (_) {
      status.textContent = "Unable to confirm logout. Refresh devices before trying again.";
    } finally {
      busy = false; controls();
      if (reload) load();
    }
  };
  refresh.addEventListener("click", load);
  logoutAll.addEventListener("click", () => revoke(null));
  document.getElementById("tab-sessions").addEventListener("click", load);
  // Also load when keyboard tab navigation reveals this panel.
  new MutationObserver(() => { if (!panel.hidden) load(); }).observe(panel, {attributes: true, attributeFilter: ["hidden"]});
})();
