(function () {
  const API_PROFILE = "/api/account/profile/";
  const API_ADMIN_RATING_NOTIFS = "/api/admin/notifications/app-ratings/";
  const API_ADMIN_PAGE_TOKEN = "/api/admin/page-token/";
  const RATING_SEEN_KEY = "elecom_admin_seen_rating_id";
  const ADMIN_HASH_KEY = "elecom_admin_page_hash";

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

  const rewriteAdminLinks = (token) => {
    if (!token) return;
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!isAdminStaticPage(href)) return;
      link.setAttribute("href", applyAdminHashToUrl(href, token));
    });
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
    if (!isAdminStaticPage(window.location.href)) return;

    try {
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
        rewriteAdminLinks(existingToken);
        return;
      }

      if (!isAdminDashboardPage()) {
        goToSecureDashboard();
        return;
      }

      const resp = await fetch(API_ADMIN_PAGE_TOKEN, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok || !data.token) {
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
        const url = new URL(window.location.href);
        url.hash = wantedHash;
        window.history.replaceState(null, "", url.toString());
      }
      rewriteAdminLinks(token);
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
  <button type="button" class="notif-bell" id="adminNotifBell" aria-label="Notifications" aria-expanded="false">
    <i class="bi bi-bell"></i>
    <span class="notif-count" id="adminNotifCount" aria-label="0 unread notifications" style="display:none;">0</span>
  </button>
  <div class="admin-notif-dropdown card shadow-sm border-0" id="adminNotifDropdown" style="display:none;">
    <div class="admin-notif-head">
      <div>
        <div class="admin-notif-title">Notifications</div>
        <div class="admin-notif-subtitle" id="adminNotifSummary">App ratings from users</div>
      </div>
      <i class="bi bi-star-fill"></i>
    </div>
    <div class="admin-notif-list" id="adminNotifList">
      <div class="admin-notif-empty">No app ratings yet.</div>
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
`;
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

  const getSeenRatingId = () => {
    try {
      return Number(localStorage.getItem(RATING_SEEN_KEY) || "0") || 0;
    } catch (e) {
      return 0;
    }
  };

  const setSeenRatingId = (id) => {
    try {
      if (id) localStorage.setItem(RATING_SEEN_KEY, String(id));
    } catch (e) {
      // ignore
    }
  };

  const formatRatingDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const ratingStars = (rating) => {
    const safe = Math.max(0, Math.min(5, Number(rating) || 0));
    return "★".repeat(safe) + "☆".repeat(5 - safe);
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

  const renderRatingNotifications = ({ listEl, summaryEl, countEl, data }) => {
    const items = (data && data.notifications) || [];
    const latestId = Number(data && data.latest_id) || 0;
    const seenId = getSeenRatingId();
    const unread = items.filter((item) => Number(item.id) > seenId).length;

    setNotifCount(countEl, unread);

    if (summaryEl) {
      const avg = data && data.average_rating ? Number(data.average_rating).toFixed(1) : "0.0";
      summaryEl.textContent = `${data && data.total_count ? data.total_count : 0} ratings · ${avg}/5 average`;
    }

    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<div class="admin-notif-empty">No app ratings yet.</div>';
      return;
    }

    listEl.innerHTML = items.map((item) => {
      const isUnread = Number(item.id) > seenId;
      return `
        <div class="admin-notif-item ${isUnread ? "is-unread" : ""}">
          <div class="admin-notif-icon"><i class="bi bi-star-fill"></i></div>
          <div class="admin-notif-copy">
            <div class="admin-notif-row">
              <strong>${escapeHtml(item.student_id || "Student")}</strong>
              <span>${escapeHtml(formatRatingDate(item.created_at))}</span>
            </div>
            <div class="admin-notif-rating" aria-label="${escapeHtml(String(item.rating || 0))} out of 5">${ratingStars(item.rating)}</div>
            <div class="admin-notif-body">${escapeHtml(item.label || "Rated the app")}</div>
          </div>
        </div>
      `;
    }).join("");

    listEl.dataset.latestRatingId = latestId ? String(latestId) : "";
  };

  const loadRatingNotifications = async (els) => {
    try {
      const resp = await fetch(API_ADMIN_RATING_NOTIFS, { method: "GET", cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data || !data.ok) return;
      renderRatingNotifications({ ...els, data });
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
    const adminNotifDropdown = document.getElementById("adminNotifDropdown");
    const adminNotifCount = document.getElementById("adminNotifCount");
    const adminNotifList = document.getElementById("adminNotifList");
    const adminNotifSummary = document.getElementById("adminNotifSummary");
    const menuName = document.getElementById("menuName");
    const menuRole = document.getElementById("menuRole");
    const profileLink = document.getElementById("profileLink");
    const userMenuLogoutLink = document.getElementById("userMenuLogoutLink");

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
          const latestId = Number(adminNotifList && adminNotifList.dataset.latestRatingId) || 0;
          setSeenRatingId(latestId);
          setNotifCount(adminNotifCount, 0);
        }
      });
    }

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
      setNotifOpen(adminNotifDropdown, adminNotifBell, false);
      setMenuOpen(userMenuDropdown, false);
    });

    if (profileLink) {
      try {
        const token = sessionStorage.getItem(ADMIN_HASH_KEY) || "";
        if (token) profileLink.setAttribute("href", applyAdminHashToUrl(profileLink.href, token));
      } catch (e) {
        // ignore
      }

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
    loadRatingNotifications({
      listEl: adminNotifList,
      summaryEl: adminNotifSummary,
      countEl: adminNotifCount,
    });
    setInterval(() => {
      loadRatingNotifications({
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
      const token = sessionStorage.getItem(ADMIN_HASH_KEY) || "";
      return applyAdminHashToUrl(href, token);
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
