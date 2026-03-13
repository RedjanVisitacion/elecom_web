(function () {
  const API_PROFILE = "/api/account/profile/";

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

  const buildMarkup = () => {
    return `
<div class="user-info position-relative" id="userMenu">
  <button type="button" class="btn p-0 border-0 bg-transparent d-flex align-items-center gap-2" id="userMenuToggle">
    <div class="user-avatar">
      <i class="bi bi-person-gear"></i>
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
          <i class="bi bi-person-gear"></i>
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
`;
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

    mount.innerHTML = buildMarkup();

    const logoutLink = document.getElementById("logoutLink");
    const sidebarLogoutLink = document.getElementById("sidebarLogoutLink");

    const displayName = document.getElementById("displayName");
    const displayRole = document.getElementById("displayRole");
    const userMenu = document.getElementById("userMenu");
    const userMenuToggle = document.getElementById("userMenuToggle");
    const userMenuDropdown = document.getElementById("userMenuDropdown");
    const menuName = document.getElementById("menuName");
    const menuRole = document.getElementById("menuRole");
    const profileLink = document.getElementById("profileLink");
    const userMenuLogoutLink = document.getElementById("userMenuLogoutLink");

    try {
      const role = sessionStorage.getItem("elecom_role") || "admin";
      const user = sessionStorage.getItem("elecom_user") || "";
      if (displayName) displayName.textContent = user || "Admin";
      if (displayRole) displayRole.textContent = role;
      if (menuName) menuName.textContent = user || "Admin";
      if (menuRole) menuRole.textContent = role;
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

    document.addEventListener("click", (e) => {
      if (!userMenuDropdown || !userMenu) return;
      if (userMenuDropdown.getAttribute("data-open") !== "1") return;
      if (!userMenu.contains(e.target)) {
        setMenuOpen(userMenuDropdown, false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      setMenuOpen(userMenuDropdown, false);
    });

    if (profileLink) {
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
  };

  window.ElecomAdminUserMenu = {
    init,
    escapeHtml,
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
