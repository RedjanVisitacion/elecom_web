document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");
  const logoutLink = document.getElementById("logoutLink");
  const displayName = document.getElementById("displayName");
  const displayRole = document.getElementById("displayRole");

  if (menuToggle && sidebar && sidebarOverlay) {
    menuToggle.addEventListener("click", function () {
      sidebar.classList.add("active");
      sidebarOverlay.classList.add("active");
    });
  }

  if (closeSidebar && sidebar && sidebarOverlay) {
    closeSidebar.addEventListener("click", function () {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    });
  }

  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    });
  }

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", function () {
      if (window.innerWidth <= 992 && sidebar && sidebarOverlay) {
        sidebar.classList.remove("active");
        sidebarOverlay.classList.remove("active");
      }
    });
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 992 && sidebar && sidebarOverlay) {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    }
  });

  const toLogin = () => {
    try {
      sessionStorage.removeItem("elecom_role");
      sessionStorage.removeItem("elecom_user");
    } catch (e) {
      // ignore
    }
    const base = window.location.origin;
    window.location.href = `${base}/login/`;
  };

  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      toLogin();
    });
  }

  try {
    const role = sessionStorage.getItem("elecom_role") || "admin";
    const user = sessionStorage.getItem("elecom_user") || "";
    if (displayName) displayName.textContent = user || "Admin";
    if (displayRole) displayRole.textContent = role;
  } catch (e) {
    // ignore
  }

  const input = document.getElementById("candidateSearch");
  const btn = document.getElementById("candidateSearchBtn");
  const results = document.getElementById("searchResults");
  let debounceTimer = null;

  function hideResults() {
    if (!results) return;
    results.style.display = "none";
    results.innerHTML = "";
  }

  function showResults(items) {
    if (!results) return;
    if (!items || items.length === 0) {
      hideResults();
      return;
    }

    const placeholder = "https://via.placeholder.com/40x40?text=%20";
    results.innerHTML = items
      .map((item) => {
        const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(" ");
        const photo = item.photo_url && item.photo_url.startsWith("http") ? item.photo_url : placeholder;
        return `\n<a href="#" class="list-group-item list-group-item-action" data-id="${item.id}">\n  <div class="d-flex align-items-center gap-2">\n    <img src="${photo}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">\n    <div class="flex-grow-1">\n      <div class="d-flex w-100 justify-content-between">\n        <strong>${name}</strong>\n        <small>${item.student_id || ""}</small>\n      </div>\n      <div class="small text-muted">${item.position || ""}${item.organization ? " • " + item.organization : ""}</div>\n    </div>\n  </div>\n</a>`;
      })
      .join("");

    results.style.display = "block";
  }

  async function doSearch() {
    if (!input) return;
    const q = input.value.trim();
    if (!q || q.length < 2) {
      hideResults();
      return;
    }

    hideResults();
  }

  if (input) {
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 250);
    });
  }

  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      doSearch();
    });
  }

  document.addEventListener("click", (e) => {
    if (!results || !input) return;
    if (!results.contains(e.target) && e.target !== input) {
      hideResults();
    }
  });

  if (results) {
    results.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-id]");
      if (!link) return;
      e.preventDefault();
      hideResults();
    });
  }

  // keep unused function so you can easily re-enable later
  void showResults;
});
