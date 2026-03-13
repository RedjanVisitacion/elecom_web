document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");

  const profileError = document.getElementById("profileError");
  const profileGrid = document.getElementById("profileGrid");
  const profileLoading = document.getElementById("profileLoading");

  const pfFullName = document.getElementById("pf_full_name");
  const pfStudentId = document.getElementById("pf_student_id");
  const pfCourse = document.getElementById("pf_course");
  const pfYear = document.getElementById("pf_year");
  const pfSection = document.getElementById("pf_section");
  const pfEmail = document.getElementById("pf_email");
  const pfPhone = document.getElementById("pf_phone");
  const pfRole = document.getElementById("pf_role");
  const pfUserId = document.getElementById("pf_user_id");
  const pfCreatedAt = document.getElementById("pf_created_at");

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
      sessionStorage.removeItem("elecom_user_id");
    } catch (e) {
      // ignore
    }
    const base = window.location.origin;
    window.location.href = `${base}/login/`;
  };

  const showError = (msg) => {
    if (profileLoading) profileLoading.style.display = "none";
    if (profileGrid) profileGrid.style.display = "none";
    if (!profileError) return;
    profileError.textContent = msg || "Failed to load profile.";
    profileError.style.display = "block";
  };

  const setValue = (el, value) => {
    if (!el) return;
    el.value = value || "";
  };

  const fmtCreatedAt = (val) => {
    if (!val) return "";
    try {
      const d = new Date(val);
      if (!Number.isFinite(d.getTime())) return String(val);
      return d.toLocaleString();
    } catch (e) {
      return String(val);
    }
  };

  const loadProfile = async () => {
    if (profileError) profileError.style.display = "none";
    if (profileGrid) profileGrid.style.display = "none";
    if (profileLoading) profileLoading.style.display = "block";

    let resp;
    try {
      resp = await fetch("/api/account/profile/", { method: "GET" });
    } catch (e) {
      showError("Network error. Please try again.");
      return;
    }

    let data = null;
    try {
      data = await resp.json();
    } catch (e) {
      // ignore
    }

    if (!resp.ok || !data || !data.ok) {
      if (resp && resp.status === 401) {
        toLogin();
        return;
      }
      showError((data && data.error) ? data.error : "Failed to load profile.");
      return;
    }

    const user = data.user || {};
    const student = data.student || {};

    const firstName = student.first_name || user.first_name || "";
    const middleName = student.middle_name || user.middle_name || "";
    const lastName = student.last_name || user.last_name || "";
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

    setValue(pfFullName, fullName);
    setValue(pfStudentId, data.student_id || user.student_id || student.id_number);

    setValue(pfCourse, student.course || user.department || "");
    setValue(pfYear, (student.year != null ? String(student.year) : (user.year_level != null ? String(user.year_level) : "")));
    setValue(pfSection, student.section || user.section || "");

    setValue(pfEmail, student.email || user.email || "");
    setValue(pfPhone, student.phone_number || user.phone || "");

    setValue(pfRole, user.role || student.role || "");
    setValue(pfUserId, user.id != null ? String(user.id) : "");
    setValue(pfCreatedAt, fmtCreatedAt(user.created_at));

    if (profileLoading) profileLoading.style.display = "none";
    if (profileGrid) profileGrid.style.display = "flex";
  };

  loadProfile();
});
