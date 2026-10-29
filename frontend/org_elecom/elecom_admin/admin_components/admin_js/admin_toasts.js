/* Toastification-style notifications for the vanilla-JavaScript admin client. */
(() => {
  if (window.ElecomToast) return;
  const notices = new Map();
  const kinds = { success: "Success", error: "Please check", warning: "Attention", info: "Information" };
  const paths = { success: "M5 12l4 4L19 6", error: "M6 6l12 12M18 6L6 18", warning: "M12 7v6m0 4h.01", info: "M12 11v6m0-10h.01" };
  let region;
  const dismiss = id => notices.get(String(id))?.close();
  const show = (message, options = {}) => {
    const text = String(message || "").trim();
    const type = Object.hasOwn(kinds, options.type) ? options.type : "info";
    const id = String(options.id || type + ":" + text);
    if (!text) { dismiss(id); return id; }
    dismiss(id);
    if (!region || !region.isConnected) {
      region = document.createElement("div"); region.className = "elecom-toast-region";
      region.setAttribute("aria-label", "Notifications"); document.body.append(region);
    }
    while (notices.size >= 3) dismiss(notices.keys().next().value);
    const toast = document.createElement("div"); toast.className = "elecom-toast is-" + type;
    toast.setAttribute("role", type === "error" ? "alert" : "status"); toast.setAttribute("aria-atomic", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", paths[type]); svg.append(path);
    const content = document.createElement("div"); content.className = "elecom-toast-content";
    const title = document.createElement("strong"); title.textContent = options.title || kinds[type];
    const body = document.createElement("p"); body.textContent = text; content.append(title, body);
    const button = document.createElement("button"); button.type = "button"; button.className = "elecom-toast-close";
    button.setAttribute("aria-label", "Dismiss notification"); button.textContent = "\u00d7";
    toast.append(svg, content, button);
    let remaining = options.duration === 0 ? 0 : Math.max(1000, Number(options.duration) || (type === "error" ? 8000 : 5000));
    let timer = null, started = 0, pointer = false, focus = false;
    const close = () => { clearTimeout(timer); toast.remove(); notices.delete(id); };
    const pause = () => { if (timer) { clearTimeout(timer); timer = null; remaining = Math.max(0, remaining - (Date.now() - started)); } };
    const resume = () => { if (remaining > 0 && !pointer && !focus && !timer) { started = Date.now(); timer = setTimeout(close, remaining); } };
    toast.addEventListener("pointerenter", () => { pointer = true; pause(); });
    toast.addEventListener("pointerleave", () => { pointer = false; resume(); });
    toast.addEventListener("focusin", () => { focus = true; pause(); });
    toast.addEventListener("focusout", event => { if (!toast.contains(event.relatedTarget)) { focus = false; resume(); } });
    button.addEventListener("click", close);
    notices.set(id, { close }); region.append(toast); resume(); return id;
  };
  window.ElecomToast = {
    show, dismiss, dismissAll: () => { for (const id of [...notices.keys()]) dismiss(id); },
    success: (message, options = {}) => show(message, { ...options, type: "success" }),
    error: (message, options = {}) => show(message, { ...options, type: "error" }),
    warning: (message, options = {}) => show(message, { ...options, type: "warning" }),
    info: (message, options = {}) => show(message, { ...options, type: "info" }),
  };
})();
