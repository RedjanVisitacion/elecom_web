(function () {
  const API_PROFILE = "/api/account/profile/";
  const API_ADMIN_ALERTS = "/api/admin/notifications/alerts/";
  const API_ADMIN_PAGE_TOKEN = "/api/admin/page-token/";
  const API_ADMIN_VERIFY_PASSWORD = "/api/admin/verify-password/";
  const ADMIN_ALERT_SEEN_KEY = "elecom_admin_seen_alert_ids";
  const ADMIN_HASH_KEY = "elecom_admin_page_hash";
  const ADMIN_ROUTE_PREFIX = "/g/";
  const secureRouteCache = new Map();

  const toLogin = () => {
    try {
      sessionStorage.removeItem("elecom_role");
      sessionStorage.removeItem("elecom_user");
      sessionStorage.removeItem("elecom_user_id");
    } catch (e) {
      // ignore
    }
    const base = window.location.origin;
    window.location.href = `${base}/login/`;
  };

  const escapeHtml = (s) => {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const isAdminStaticPage = (href) => {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin
        && url.pathname.startsWith("/static/org_elecom/elecom_admin/")
        && url.pathname.endsWith(".html");
    } catch (e) {
      return false;
    }
  };

  const isAdminSecureRoute = () => {
    return window.location.pathname.startsWith(ADMIN_ROUTE_PREFIX);
  };

  const getAdminPageNameFromHref = (href) => {
    try {
      const url = new URL(href, window.location.origin);
      if (!url.pathname.startsWith("/static/org_elecom/elecom_admin/")) return "";
      return url.pathname.split("/").pop() || "";
    } catch (e) {
      return "";
    }
  };

  const normalizeAdminSidebar = () => {
    document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
      const label = link.querySelector("span");
      const text = (label ? label.textContent : link.textContent || "").trim();
      const page = getAdminPageNameFromHref(link.getAttribute("href") || "");

      if (text === "Set Election Dates" || page === "elecom_election_date.html") {
        if (label) label.textContent = "Election Management";
        link.setAttribute("href", "/static/org_elecom/elecom_admin/elecom_elections.html");
        const icon = link.querySelector("i");
        if (icon) icon.className = "bi bi-calendar2-range";
      }
    });
  };

  const applyAdminHashToUrl = (href, token) => {
    try {
      const url = new URL(href, window.location.origin);
      if (!isAdminStaticPage(url.href)) return href;
      url.hash = token ? `secure=${encodeURIComponent(token)}` : "";
      return url.toString();
    } catch (e) {
      return href;
    }
  };

  const getSecureRouteForPage = async (page, queryString = "") => {
    const safePage = String(page || "").trim();
    if (!safePage) return "";
    const cacheKey = `${safePage}${queryString || ""}`;
    if (secureRouteCache.has(cacheKey)) return secureRouteCache.get(cacheKey);

    const url = new URL(API_ADMIN_PAGE_TOKEN, window.location.origin);
    url.searchParams.set("page", safePage);
    const extraParams = new URLSearchParams(String(queryString || "").replace(/^\?/, ""));
    extraParams.forEach((value, key) => {
      if (key === "election_id" || key === "edit_election_id") {
        url.searchParams.set(key, value);
      }
    });
    const resp = await fetch(url.toString(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok || !data.secure_url) return "";

    const secureUrl = new URL(String(data.secure_url), window.location.origin).toString();
    secureRouteCache.set(cacheKey, secureUrl);
    try {
      sessionStorage.setItem(`elecom_admin_secure_route_${cacheKey}`, secureUrl);
    } catch (e) {
      // ignore
    }
    return secureUrl;
  };

  const rewriteAdminLinks = async () => {
    normalizeAdminSidebar();
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      if (!isAdminStaticPage(href)) continue;
      const page = getAdminPageNameFromHref(href);
      const parsed = new URL(href, window.location.origin);
      const secureUrl = await getSecureRouteForPage(page, parsed.search);
      if (secureUrl) link.setAttribute("href", secureUrl);
    }
  };

  const getAdminHashToken = () => {
    const raw = String(window.location.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(raw);
    return String(params.get("secure") || "").trim();
  };

  const isAdminDashboardPage = () => {
    return /\/static\/org_elecom\/elecom_admin\/admin_dashboard\.html$/i.test(window.location.pathname);
  };

  const goToSecureDashboard = () => {
    const dashboard = "/static/org_elecom/elecom_admin/admin_dashboard.html";
    if (isAdminDashboardPage()) return;
    window.location.href = dashboard;
  };

  const validateAdminHashToken = async (token) => {
    const resp = await fetch(API_ADMIN_PAGE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ token }),
    });
    const data = await resp.json().catch(() => ({}));
    return !!(resp.ok && data && data.ok);
  };

  const ensureAdminPageHash = async () => {
    if (!isAdminStaticPage(window.location.href) && !isAdminSecureRoute()) return;

    try {
      if (isAdminSecureRoute()) {
        rewriteAdminLinks();
        return;
      }

      const existingToken = getAdminHashToken();
      if (existingToken) {
        const valid = await validateAdminHashToken(existingToken);
        if (!valid) {
          goToSecureDashboard();
          return;
        }
        try {
          sessionStorage.setItem(ADMIN_HASH_KEY, existingToken);
        } catch (e) {
          // ignore
        }
        rewriteAdminLinks();
        return;
      }

      if (!isAdminDashboardPage()) {
        goToSecureDashboard();
        return;
      }

      const page = getAdminPageNameFromHref(window.location.href) || "admin_dashboard.html";
      const tokenUrl = new URL(API_ADMIN_PAGE_TOKEN, window.location.origin);
      tokenUrl.searchParams.set("page", page);
      const resp = await fetch(tokenUrl.toString(), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok || !data.token || !data.secure_url) {
        toLogin();
        return;
      }

      const token = String(data.token);
      try {
        sessionStorage.setItem(ADMIN_HASH_KEY, token);
      } catch (e) {
        // ignore
      }

      const wantedHash = `secure=${encodeURIComponent(token)}`;
      if (window.location.hash.replace(/^#/, "") !== wantedHash) {
        window.history.replaceState(null, "", new URL(String(data.secure_url), window.location.origin).toString());
      }
      secureRouteCache.set(page, new URL(String(data.secure_url), window.location.origin).toString());
      rewriteAdminLinks();
    } catch (e) {
      toLogin();
    }
  };

  const NET_LEVELS = {
    HIGH: "high",
    LOW: "low",
    OFFLINE: "offline",
  };

  const buildMarkup = () => {
    return `
<div class="top-navbar-actions">
  <div class="admin-notif-wrap" id="adminNotifWrap">
  <button type="button" class="admin-hidden-notif-action" id="adminHiddenNotifButton" aria-label="Open reset votes"></button>
  <button type="button" class="notif-bell" id="adminNotifBell" aria-label="Notifications" aria-expanded="false">
    <i class="bi bi-bell"></i>
    <span class="notif-count" id="adminNotifCount" aria-label="0 unread notifications" style="display:none;">0</span>
  </button>
  <div class="admin-notif-dropdown card shadow-sm border-0" id="adminNotifDropdown" style="display:none;">
    <div class="admin-notif-head">
      <div>
        <div class="admin-notif-title">Notifications</div>
        <div class="admin-notif-subtitle" id="adminNotifSummary">Election operations and security alerts</div>
      </div>
      <i class="bi bi-shield-exclamation"></i>
    </div>
    <div class="admin-notif-list" id="adminNotifList">
      <div class="admin-notif-empty">No admin alerts right now.</div>
    </div>
  </div>
  </div>

  <div class="user-info position-relative" id="userMenu">
  <button type="button" class="btn p-0 border-0 bg-transparent d-flex align-items-center gap-2" id="userMenuToggle">
    <div class="user-avatar">
      <img id="userAvatarImg" src="" alt="" style="display:none; width:40px; height:40px; border-radius:50%; object-fit:cover;">
      <i class="bi bi-person-gear" id="userAvatarIcon"></i>
    </div>
    <div class="user-details user-trigger-details">
      <div class="user-name" id="displayName">Admin</div>
      <div class="user-role d-flex align-items-center gap-1" id="displayRole">Admin <i class="bi bi-chevron-down chevron-down" aria-hidden="true"></i></div>
    </div>
  </button>

  <div class="user-dropdown card shadow-sm border-0" id="userMenuDropdown" style="display:none;">
    <div class="card-body p-3">
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="user-avatar user-avatar-sm">
          <img id="menuAvatarImg" src="" alt="" style="display:none; width:34px; height:34px; border-radius:50%; object-fit:cover;">
          <i class="bi bi-person-gear" id="menuAvatarIcon"></i>
        </div>
        <div>
          <div class="fw-semibold" id="menuName">Admin</div>
          <div class="small text-muted" id="menuRole">admin</div>
        </div>
      </div>
      <hr class="my-2">
      <a class="dropdown-item d-flex align-items-center gap-2" href="/static/org_elecom/elecom_admin/profile.html" id="profileLink">
        <i class="bi bi-person"></i>
        <span>Profile</span>
      </a>
      <div class="dropdown-divider"></div>
      <a class="dropdown-item dropdown-item-logout d-flex align-items-center gap-2" href="#" id="userMenuLogoutLink">
        <i class="bi bi-box-arrow-right"></i>
        <span>Logout</span>
      </a>
    </div>
</div>
</div>
</div>
<div class="admin-password-modal-backdrop" id="adminPasswordModal" hidden>
  <div class="admin-password-modal" role="dialog" aria-modal="true" aria-labelledby="adminPasswordTitle">
    <div class="admin-password-head">
      <h2 id="adminPasswordTitle">Admin Password Required</h2>
      <button type="button" class="admin-password-close" id="adminPasswordClose" aria-label="Close"><i class="bi bi-x-lg"></i></button>
    </div>
    <form class="admin-password-body" id="adminPasswordForm">
      <p>Enter your admin password to open Reset Votes.</p>
      <label for="adminPasswordInput">Password</label>
      <input type="password" id="adminPasswordInput" autocomplete="current-password">
      <div class="admin-password-error" id="adminPasswordError" role="alert"></div>
      <div class="admin-password-actions">
        <button type="button" class="btn btn-secondary" id="adminPasswordCancel">Cancel</button>
        <button type="submit" class="btn btn-dark" id="adminPasswordContinue"><i class="bi bi-shield-check"></i> Continue</button>
      </div>
    </form>
  </div>
</div>
`;
  };

  const verifyAdminPassword = async (password) => {
    const resp = await fetch(API_ADMIN_VERIFY_PASSWORD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ password }),
    });
    const data = await resp.json().catch(() => ({}));
    return !!(resp.ok && data && data.ok);
  };

  const setAdminPasswordModalOpen = (open) => {
    const modal = document.getElementById("adminPasswordModal");
    const input = document.getElementById("adminPasswordInput");
    const error = document.getElementById("adminPasswordError");
    if (!modal) return;
    modal.hidden = !open;
    if (error) error.textContent = "";
    if (open) {
      if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 0);
      }
    }
  };

  const buildNetworkBadge = () => {
    const wrap = document.createElement("div");
    wrap.className = "system-status-badge is-high";
    wrap.setAttribute("title", "Network status");
    wrap.innerHTML = `
<span class="status-dot" aria-hidden="true"></span>
<span class="status-text">Network High</span>
`.trim();
    return wrap;
  };

  const getSeenAlertIds = () => {
    try {
      const raw = localStorage.getItem(ADMIN_ALERT_SEEN_KEY) || "[]";
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (e) {
      return new Set();
    }
  };

  const setSeenAlertIds = (ids) => {
    try {
      const safe = Array.from(new Set((ids || []).map(String))).slice(0, 100);
      localStorage.setItem(ADMIN_ALERT_SEEN_KEY, JSON.stringify(safe));
    } catch (e) {
      // ignore
    }
  };

  const formatAlertDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const severityLabel = (severity) => {
    const normalized = String(severity || "info").toLowerCase();
    if (normalized === "critical") return "Critical";
    if (normalized === "warning") return "Warning";
    if (normalized === "action") return "Action";
    return "Info";
  };

  const setNotifOpen = (dropdown, bell, open) => {
    if (!dropdown || !bell) return;
    dropdown.style.display = open ? "block" : "none";
    bell.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) dropdown.setAttribute("data-open", "1");
    else dropdown.removeAttribute("data-open");
  };

  const setNotifCount = (countEl, count) => {
    if (!countEl) return;
    const safe = Math.max(0, Number(count) || 0);
    countEl.textContent = String(safe > 99 ? "99+" : safe);
    countEl.setAttribute("aria-label", `${safe} unread notifications`);
    countEl.style.display = safe > 0 ? "inline-flex" : "none";
  };

  const renderAdminAlerts = ({ listEl, summaryEl, countEl, data }) => {
    const items = (data && data.notifications) || [];
    const seenIds = getSeenAlertIds();
    const unread = items.filter((item) => !seenIds.has(String(item.id || ""))).length;

    setNotifCount(countEl, unread);

    if (summaryEl) {
      const critical = Number(data && data.critical_count) || 0;
      const warning = Number(data && data.warning_count) || 0;
      const total = Number(data && data.total_count) || items.length || 0;
      summaryEl.textContent = total
        ? `${total} alert${total === 1 ? "" : "s"} · ${critical} critical · ${warning} warning`
        : "No action needed";
    }

    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<div class="admin-notif-empty">No admin alerts right now.</div>';
      return;
    }

    listEl.innerHTML = items.map((item) => {
      const id = String(item.id || "");
      const isUnread = !seenIds.has(id);
      const severity = String(item.severity || "info").toLowerCase();
      const icon = String(item.icon || "bi-bell");
      const href = String(item.href || "");
      const tag = href ? "a" : "div";
      const hrefAttr = href ? ` href="${escapeHtml(href)}"` : "";
      return `
        <${tag} class="admin-notif-item is-${escapeHtml(severity)} ${isUnread ? "is-unread" : ""}"${hrefAttr}>
          <div class="admin-notif-icon"><i class="bi ${escapeHtml(icon)}"></i></div>
          <div class="admin-notif-copy">
            <div class="admin-notif-row">
              <strong>${escapeHtml(item.title || "Admin alert")}</strong>
              <span>${escapeHtml(formatAlertDate(item.created_at))}</span>
            </div>
            <div class="admin-notif-severity">${escapeHtml(severityLabel(severity))}</div>
            <div class="admin-notif-body">${escapeHtml(item.body || "")}</div>
          </div>
        </${tag}>
      `;
    }).join("");

    listEl.dataset.alertIds = JSON.stringify(items.map((item) => String(item.id || "")).filter(Boolean));
  };

  const loadAdminAlerts = async (els) => {
    try {
      const resp = await fetch(API_ADMIN_ALERTS, { method: "GET", cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data || !data.ok) return;
      renderAdminAlerts({ ...els, data });
    } catch (e) {
      // ignore
    }
  };

  const setNetworkUi = ({ networkBadge, networkText, level }) => {
    if (!networkBadge || !networkText) return;
    networkBadge.classList.remove("is-high", "is-low", "is-offline");

    if (level === NET_LEVELS.OFFLINE) {
      networkBadge.classList.add("is-offline");
      networkText.textContent = "Network Offline";
      networkBadge.setAttribute("title", "No network connection");
      return;
    }

    if (level === NET_LEVELS.LOW) {
      networkBadge.classList.add("is-low");
      networkText.textContent = "Network Low";
      networkBadge.setAttribute("title", "Weak/slow connection");
      return;
    }

    networkBadge.classList.add("is-high");
    networkText.textContent = "Network High";
    networkBadge.setAttribute("title", "Good connection");
  };

  const getNetworkLevelFromConnectionApi = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return null;

    const effectiveType = String(conn.effectiveType || "").toLowerCase();
    const downlink = Number(conn.downlink);
    const rtt = Number(conn.rtt);

    if (effectiveType && effectiveType !== "4g") return NET_LEVELS.LOW;
    if (Number.isFinite(downlink) && downlink > 0 && downlink < 2.0) return NET_LEVELS.LOW;
    if (Number.isFinite(rtt) && rtt > 180) return NET_LEVELS.LOW;

    return NET_LEVELS.HIGH;
  };

  const pingLatencyMs = async () => {
    const url = new URL(API_PROFILE, window.location.origin);
    url.searchParams.set("_ping", String(Date.now()));

    const controller = new AbortController();
    const t0 = performance.now();
    const timer = setTimeout(() => controller.abort(), 3500);

    try {
      await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      return performance.now() - t0;
    } finally {
      clearTimeout(timer);
    }
  };

  const getNetworkLevel = async () => {
    if (!navigator.onLine) return NET_LEVELS.OFFLINE;

    const fromConn = getNetworkLevelFromConnectionApi();
    if (fromConn === NET_LEVELS.LOW) return NET_LEVELS.LOW;

    try {
      const ms = await pingLatencyMs();
      if (Number.isFinite(ms) && ms > 1200) return NET_LEVELS.LOW;
    } catch (e) {
      return NET_LEVELS.OFFLINE;
    }

    return NET_LEVELS.HIGH;
  };

  const setMenuOpen = (userMenuDropdown, open) => {
    if (!userMenuDropdown) return;
    userMenuDropdown.style.display = open ? "block" : "none";
    if (open) userMenuDropdown.setAttribute("data-open", "1");
    else userMenuDropdown.removeAttribute("data-open");
  };

  const applyProfileName = ({ displayName, menuName, data }) => {
    if (!data || !data.ok) return;
    const user = data.user || {};
    const student = data.student || {};

    const firstName = student.first_name || user.first_name || "";
    const middleName = student.middle_name || user.middle_name || "";
    const lastName = student.last_name || user.last_name || "";
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    if (!fullName) return;

    if (displayName) displayName.textContent = fullName;
    if (menuName) menuName.textContent = fullName;

    try {
      sessionStorage.setItem("elecom_user", fullName);
    } catch (e) {
      // ignore
    }
  };

  const setAvatarUrl = ({ userAvatarImg, userAvatarIcon, menuAvatarImg, menuAvatarIcon, url }) => {
    const u = String(url || "").trim();
    const has = !!(u && /^https?:\/\//i.test(u));

    if (userAvatarImg) {
      userAvatarImg.src = has ? u : "";
      userAvatarImg.style.display = has ? "block" : "none";
    }
    if (menuAvatarImg) {
      menuAvatarImg.src = has ? u : "";
      menuAvatarImg.style.display = has ? "block" : "none";
    }
    if (userAvatarIcon) userAvatarIcon.style.display = has ? "none" : "inline-block";
    if (menuAvatarIcon) menuAvatarIcon.style.display = has ? "none" : "inline-block";

    try {
      if (has) sessionStorage.setItem("elecom_user_photo_url", u);
      else sessionStorage.removeItem("elecom_user_photo_url");
    } catch (e) {
      // ignore
    }
  };

  const loadAccountProfileName = async (els) => {
    try {
      const resp = await fetch(API_PROFILE, { method: "GET" });
      if (!resp.ok) return;
      const data = await resp.json();
      applyProfileName({ ...els, data });
    } catch (e) {
      // ignore
    }
  };

  const init = () => {
    const mount = document.getElementById("userMenuMount");
    if (!mount) return;

    ensureAdminPageHash();
    normalizeAdminSidebar();

    mount.innerHTML = buildMarkup();

    const topNav = mount.closest(".top-navbar");
    let networkBadge = topNav ? topNav.querySelector(".system-status-badge") : null;
    if (!networkBadge && topNav) {
      networkBadge = buildNetworkBadge();
      topNav.insertBefore(networkBadge, mount);
    }
    const networkText = networkBadge ? networkBadge.querySelector(".status-text") : null;

    if (topNav) {
      const actionWraps = Array.from(topNav.querySelectorAll(".top-navbar-actions"));
      actionWraps.forEach((el) => {
        if (!mount.contains(el)) el.remove();
      });

      const bells = Array.from(topNav.querySelectorAll(".notif-bell"));
      bells.forEach((el) => {
        if (!mount.contains(el)) el.remove();
      });
    }

    let netRefreshTimer = null;
    const refreshNetworkUi = async () => {
      const level = await getNetworkLevel();
      setNetworkUi({ networkBadge, networkText, level });
    };

    const startNetworkWatch = () => {
      if (!networkBadge || !networkText) return;
      if (netRefreshTimer) clearInterval(netRefreshTimer);
      refreshNetworkUi();
      netRefreshTimer = setInterval(refreshNetworkUi, 8000);
      window.addEventListener("online", refreshNetworkUi);
      window.addEventListener("offline", refreshNetworkUi);

      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && typeof conn.addEventListener === "function") {
        conn.addEventListener("change", refreshNetworkUi);
      }
    };

    const logoutLink = document.getElementById("logoutLink");
    const sidebarLogoutLink = document.getElementById("sidebarLogoutLink");

    const displayName = document.getElementById("displayName");
    const displayRole = document.getElementById("displayRole");
    const userMenu = document.getElementById("userMenu");
    const userMenuToggle = document.getElementById("userMenuToggle");
    const userMenuDropdown = document.getElementById("userMenuDropdown");
    const adminNotifWrap = document.getElementById("adminNotifWrap");
    const adminNotifBell = document.getElementById("adminNotifBell");
    const adminHiddenNotifButton = document.getElementById("adminHiddenNotifButton");
    const adminNotifDropdown = document.getElementById("adminNotifDropdown");
    const adminNotifCount = document.getElementById("adminNotifCount");
    const adminNotifList = document.getElementById("adminNotifList");
    const adminNotifSummary = document.getElementById("adminNotifSummary");
    const menuName = document.getElementById("menuName");
    const menuRole = document.getElementById("menuRole");
    const profileLink = document.getElementById("profileLink");
    const userMenuLogoutLink = document.getElementById("userMenuLogoutLink");
    const adminPasswordModal = document.getElementById("adminPasswordModal");
    const adminPasswordForm = document.getElementById("adminPasswordForm");
    const adminPasswordInput = document.getElementById("adminPasswordInput");
    const adminPasswordError = document.getElementById("adminPasswordError");
    const adminPasswordClose = document.getElementById("adminPasswordClose");
    const adminPasswordCancel = document.getElementById("adminPasswordCancel");
    const adminPasswordContinue = document.getElementById("adminPasswordContinue");

    const userAvatarImg = document.getElementById("userAvatarImg");
    const userAvatarIcon = document.getElementById("userAvatarIcon");
    const menuAvatarImg = document.getElementById("menuAvatarImg");
    const menuAvatarIcon = document.getElementById("menuAvatarIcon");

    startNetworkWatch();

    try {
      const role = sessionStorage.getItem("elecom_role") || "admin";
      const user = sessionStorage.getItem("elecom_user") || "";
      if (displayName) displayName.textContent = user || "Admin";
      if (displayRole) displayRole.textContent = role;
      if (menuName) menuName.textContent = user || "Admin";
      if (menuRole) menuRole.textContent = role;

      const cachedPhoto = sessionStorage.getItem("elecom_user_photo_url") || "";
      if (cachedPhoto) {
        setAvatarUrl({ userAvatarImg, userAvatarIcon, menuAvatarImg, menuAvatarIcon, url: cachedPhoto });
      }
    } catch (e) {
      // ignore
    }

    if (userMenuToggle && userMenuDropdown) {
      userMenuToggle.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = userMenuDropdown.getAttribute("data-open") === "1";
        setMenuOpen(userMenuDropdown, !isOpen);
      });
    }

    if (adminNotifBell && adminNotifDropdown) {
      adminNotifBell.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = adminNotifDropdown.getAttribute("data-open") === "1";
        setNotifOpen(adminNotifDropdown, adminNotifBell, !isOpen);
        if (!isOpen) {
          let alertIds = [];
          try {
            alertIds = JSON.parse((adminNotifList && adminNotifList.dataset.alertIds) || "[]");
          } catch (err) {
            alertIds = [];
          }
          setSeenAlertIds(alertIds);
          setNotifCount(adminNotifCount, 0);
        }
      });
    }

    if (adminHiddenNotifButton) {
      adminHiddenNotifButton.addEventListener("click", (e) => {
        e.preventDefault();
        setAdminPasswordModalOpen(true);
      });
    }

    const closeAdminPasswordModal = () => setAdminPasswordModalOpen(false);
    adminPasswordClose?.addEventListener("click", closeAdminPasswordModal);
    adminPasswordCancel?.addEventListener("click", closeAdminPasswordModal);
    adminPasswordModal?.addEventListener("click", (e) => {
      if (e.target === adminPasswordModal) closeAdminPasswordModal();
    });
    adminPasswordForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = (adminPasswordInput && adminPasswordInput.value ? adminPasswordInput.value : "").trim();
      if (!password) {
        if (adminPasswordError) adminPasswordError.textContent = "Enter your admin password.";
        adminPasswordInput?.focus();
        return;
      }
      if (adminPasswordContinue) {
        adminPasswordContinue.disabled = true;
        adminPasswordContinue.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Checking...';
      }
      try {
        const ok = await verifyAdminPassword(password);
        if (!ok) {
          if (adminPasswordError) adminPasswordError.textContent = "Incorrect admin password.";
          adminPasswordInput?.focus();
          return;
        }
        const url = await getSecureRouteForPage("elecom_reset.html");
        window.location.href = url || "/static/org_elecom/elecom_admin/elecom_reset.html";
      } finally {
        if (adminPasswordContinue) {
          adminPasswordContinue.disabled = false;
          adminPasswordContinue.innerHTML = '<i class="bi bi-shield-check"></i> Continue';
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (adminNotifDropdown && adminNotifWrap && adminNotifDropdown.getAttribute("data-open") === "1" && !adminNotifWrap.contains(e.target)) {
        setNotifOpen(adminNotifDropdown, adminNotifBell, false);
      }

      if (!userMenuDropdown || !userMenu) return;
      if (userMenuDropdown.getAttribute("data-open") !== "1") return;
      if (!userMenu.contains(e.target)) {
        setMenuOpen(userMenuDropdown, false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      setAdminPasswordModalOpen(false);
      setNotifOpen(adminNotifDropdown, adminNotifBell, false);
      setMenuOpen(userMenuDropdown, false);
    });

    if (profileLink) {
      getSecureRouteForPage("profile.html").then((url) => {
        if (url) profileLink.setAttribute("href", url);
      });

      profileLink.addEventListener("click", () => {
        setMenuOpen(userMenuDropdown, false);
      });
    }

    if (userMenuLogoutLink) {
      userMenuLogoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        toLogin();
      });
    }

    if (logoutLink) {
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        toLogin();
      });
    }

    if (sidebarLogoutLink) {
      sidebarLogoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        toLogin();
      });
    }

    loadAccountProfileName({ displayName, menuName });
    loadAdminAlerts({
      listEl: adminNotifList,
      summaryEl: adminNotifSummary,
      countEl: adminNotifCount,
    });
    setInterval(() => {
      loadAdminAlerts({
        listEl: adminNotifList,
        summaryEl: adminNotifSummary,
        countEl: adminNotifCount,
      });
    }, 30000);

    (async () => {
      try {
        const resp = await fetch(API_PROFILE, { method: "GET" });
        if (!resp.ok) return;
        const data = await resp.json();
        const photoUrl = data && data.user ? data.user.photo_url : "";
        setAvatarUrl({ userAvatarImg, userAvatarIcon, menuAvatarImg, menuAvatarIcon, url: photoUrl });
      } catch (e) {
        // ignore
      }
    })();
  };

  window.ElecomAdminUserMenu = {
    init,
    escapeHtml,
  };
  window.ElecomAdminSecureUrl = (href) => {
    try {
      const page = getAdminPageNameFromHref(href);
      if (!page) return href;
      const parsed = new URL(href, window.location.origin);
      const cacheKey = `${page}${parsed.search || ""}`;
      const cached = secureRouteCache.get(cacheKey) || sessionStorage.getItem(`elecom_admin_secure_route_${cacheKey}`) || secureRouteCache.get(page) || sessionStorage.getItem(`elecom_admin_secure_route_${page}`) || "";
      return cached || href;
    } catch (e) {
      return href;
    }
  };
  window.ElecomAdminSecureUrlAsync = async (href) => {
    try {
      const page = getAdminPageNameFromHref(href);
      if (!page) return href;
      const parsed = new URL(href, window.location.origin);
      return await getSecureRouteForPage(page, parsed.search) || href;
    } catch (e) {
      return href;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        init();
      } catch (e) {
        // ignore
      }
    });
  } else {
    try {
      init();
    } catch (e) {
      // ignore
    }
  }
})();
