document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");

  const profileError = document.getElementById("profileError");
  const profileSuccess = document.getElementById("profileSuccess");
  const profileGrid = document.getElementById("profileGrid");
  const profileLoading = document.getElementById("profileLoading");

  const profileHeaderName = document.getElementById("profileHeaderName");
  const profileAvatarImg = document.getElementById("profileAvatarImg");
  const profileAvatarIcon = document.getElementById("profileAvatarIcon");
  const profileSubtitle = document.getElementById("profileSubtitle");
  const profilePhotoFile = document.getElementById("profilePhotoFile");
  const btnChangeProfilePhoto = document.getElementById("btnChangeProfilePhoto");

  const profileCoverMenu = document.getElementById("profileCoverMenu");
  const profileCoverMenuBtn = document.getElementById("profileCoverMenuBtn");
  const profileCoverMenuDropdown = document.getElementById("profileCoverMenuDropdown");
  const profileCoverChangePassword = document.getElementById("profileCoverChangePassword");
  const profileCoverEditInfo = document.getElementById("profileCoverEditInfo");

  const editInfoModalEl = document.getElementById("editInfoModal");
  const editInfoError = document.getElementById("editInfoError");
  const editEmail = document.getElementById("edit_email");
  const editPhone = document.getElementById("edit_phone");
  const btnSaveEditInfo = document.getElementById("btnSaveEditInfo");

  const changePasswordModalEl = document.getElementById("changePasswordModal");
  const changePasswordError = document.getElementById("changePasswordError");
  const cpOldPassword = document.getElementById("cp_old_password");
  const cpNewPassword = document.getElementById("cp_new_password");
  const cpConfirmPassword = document.getElementById("cp_confirm_password");
  const btnSaveChangePassword = document.getElementById("btnSaveChangePassword");

  const pfFullName = document.getElementById("pf_full_name");
  const pfStudentId = document.getElementById("pf_student_id");
  const pfCourse = document.getElementById("pf_course");
  const pfYearSection = document.getElementById("pf_year_section");
  const pfEmail = document.getElementById("pf_email");
  const pfPhone = document.getElementById("pf_phone");
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

  const openChangePasswordModal = () => {
    if (!changePasswordModalEl || !window.bootstrap) {
      showError("Change Password is not available.");
      return;
    }
    clearChangePasswordError();

    if (cpOldPassword) cpOldPassword.value = "";
    if (cpNewPassword) cpNewPassword.value = "";
    if (cpConfirmPassword) cpConfirmPassword.value = "";

    const modal = window.bootstrap.Modal.getOrCreateInstance(changePasswordModalEl);
    modal.show();
  };

  const saveChangePassword = async () => {
    clearChangePasswordError();
    const oldVal = cpOldPassword ? String(cpOldPassword.value || "") : "";
    const newVal = cpNewPassword ? String(cpNewPassword.value || "") : "";
    const confirmVal = cpConfirmPassword ? String(cpConfirmPassword.value || "") : "";

    if (!oldVal || !newVal || !confirmVal) {
      showChangePasswordError("Please fill in all fields.");
      return;
    }
    if (newVal !== confirmVal) {
      showChangePasswordError("New password and confirm password do not match.");
      return;
    }
    if (newVal.length < 6) {
      showChangePasswordError("Password must be at least 6 characters.");
      return;
    }

    if (btnSaveChangePassword) {
      btnSaveChangePassword.disabled = true;
      btnSaveChangePassword.dataset.originalText = btnSaveChangePassword.dataset.originalText || btnSaveChangePassword.textContent;
      btnSaveChangePassword.textContent = "Saving...";
    }

    try {
      const res = await fetch("/api/account/profile/password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldVal,
          new_password: newVal,
          confirm_password: confirmVal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      showSuccess("Password changed.");

      if (changePasswordModalEl && window.bootstrap) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(changePasswordModalEl);
        modal.hide();
      }
    } catch (e) {
      showChangePasswordError(e && e.message ? e.message : "Failed to change password.");
    } finally {
      if (btnSaveChangePassword) {
        btnSaveChangePassword.disabled = false;
        btnSaveChangePassword.textContent = btnSaveChangePassword.dataset.originalText || "Save";
      }
    }
  };

  const showError = (msg) => {
    if (profileSuccess) profileSuccess.style.display = "none";
    if (profileLoading) profileLoading.style.display = "none";
    if (profileGrid) profileGrid.style.display = "none";
    if (!profileError) return;
    profileError.textContent = msg || "Failed to load profile.";
    profileError.style.display = "block";
  };

  const showSuccess = (msg) => {
    if (profileError) profileError.style.display = "none";
    if (!profileSuccess) return;
    profileSuccess.textContent = msg || "Saved.";
    profileSuccess.style.display = "block";
  };

  const showEditInfoError = (msg) => {
    if (!editInfoError) return;
    editInfoError.textContent = msg || "Failed to save.";
    editInfoError.style.display = "block";
  };

  const clearEditInfoError = () => {
    if (!editInfoError) return;
    editInfoError.style.display = "none";
  };

  const showChangePasswordError = (msg) => {
    if (!changePasswordError) return;
    changePasswordError.textContent = msg || "Failed to change password.";
    changePasswordError.style.display = "block";
  };

  const clearChangePasswordError = () => {
    if (!changePasswordError) return;
    changePasswordError.style.display = "none";
  };

  const openEditInfoModal = () => {
    if (!editInfoModalEl || !window.bootstrap) {
      showError("Edit Information is not available.");
      return;
    }

    clearEditInfoError();
    if (editEmail) editEmail.value = (pfEmail && pfEmail.value ? pfEmail.value : "");
    if (editPhone) editPhone.value = (pfPhone && pfPhone.value ? pfPhone.value : "");

    const modal = window.bootstrap.Modal.getOrCreateInstance(editInfoModalEl);
    modal.show();
  };

  const saveEditInfo = async () => {
    clearEditInfoError();
    const emailVal = editEmail ? String(editEmail.value || "").trim() : "";
    const phoneVal = editPhone ? String(editPhone.value || "").trim() : "";

    if (!emailVal && !phoneVal) {
      showEditInfoError("Please enter email or phone.");
      return;
    }

    if (btnSaveEditInfo) {
      btnSaveEditInfo.disabled = true;
      btnSaveEditInfo.dataset.originalText = btnSaveEditInfo.dataset.originalText || btnSaveEditInfo.textContent;
      btnSaveEditInfo.textContent = "Saving...";
    }

    try {
      const res = await fetch("/api/account/profile/update/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVal, phone: phoneVal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      if (pfEmail) pfEmail.value = data.email || "";
      if (pfPhone) pfPhone.value = data.phone || "";

      showSuccess("Information updated.");

      if (editInfoModalEl && window.bootstrap) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(editInfoModalEl);
        modal.hide();
      }
    } catch (e) {
      showEditInfoError(e && e.message ? e.message : "Failed to update profile.");
    } finally {
      if (btnSaveEditInfo) {
        btnSaveEditInfo.disabled = false;
        btnSaveEditInfo.textContent = btnSaveEditInfo.dataset.originalText || "Save";
      }
    }
  };

  const setAvatar = (url) => {
    const u = String(url || "").trim();
    const has = !!(u && /^https?:\/\//i.test(u));
    if (profileAvatarImg) {
      profileAvatarImg.src = has ? u : "";
      profileAvatarImg.style.display = has ? "block" : "none";
    }
    if (profileAvatarIcon) profileAvatarIcon.style.display = has ? "none" : "inline-block";
  };

  const setCoverMenuOpen = (open) => {
    if (!profileCoverMenuDropdown) return;
    profileCoverMenuDropdown.style.display = open ? "block" : "none";
    profileCoverMenuDropdown.setAttribute("data-open", open ? "1" : "0");
  };

  if (profileCoverMenuBtn && profileCoverMenuDropdown) {
    profileCoverMenuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = profileCoverMenuDropdown.getAttribute("data-open") === "1";
      setCoverMenuOpen(!isOpen);
    });
  }

  document.addEventListener("click", (e) => {
    if (!profileCoverMenu || !profileCoverMenuDropdown) return;
    if (profileCoverMenuDropdown.getAttribute("data-open") !== "1") return;
    if (!profileCoverMenu.contains(e.target)) {
      setCoverMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setCoverMenuOpen(false);
  });

  if (profileCoverChangePassword) {
    profileCoverChangePassword.addEventListener("click", (e) => {
      e.preventDefault();
      setCoverMenuOpen(false);
      openChangePasswordModal();
    });
  }

  if (profileCoverEditInfo) {
    profileCoverEditInfo.addEventListener("click", (e) => {
      e.preventDefault();
      setCoverMenuOpen(false);
      openEditInfoModal();
    });
  }

  if (btnSaveEditInfo) {
    btnSaveEditInfo.addEventListener("click", (e) => {
      e.preventDefault();
      saveEditInfo();
    });
  }

  if (btnSaveChangePassword) {
    btnSaveChangePassword.addEventListener("click", (e) => {
      e.preventDefault();
      saveChangePassword();
    });
  }

  const getCloudinarySignature = async (type) => {
    const url = `${window.location.origin}/api/admin/cloudinary/signature/?type=${encodeURIComponent(type)}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to get upload signature.");
    }
    return data;
  };

  const uploadToCloudinary = async ({ file, type }) => {
    if (!file || typeof file !== "object" || !file.size) {
      return "";
    }

    const sig = await getCloudinarySignature(type);
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloud_name)}/auto/upload`;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", sig.api_key);
    fd.append("timestamp", String(sig.timestamp));
    fd.append("signature", sig.signature);
    fd.append("folder", sig.folder);

    const res = await fetch(endpoint, {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error?.message || "Cloudinary upload failed.");
    }
    return String(data.secure_url || data.url || "").trim();
  };

  const saveProfilePhotoUrl = async (photoUrl) => {
    const res = await fetch("/api/account/profile/photo/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_url: photoUrl || "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to save profile photo.");
    }
    return data;
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
    if (profileSuccess) profileSuccess.style.display = "none";
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

    if (profileHeaderName) profileHeaderName.textContent = fullName || "Profile";

    const roleText = String(user.role || student.role || "").trim();
    if (profileSubtitle) profileSubtitle.textContent = roleText;

    const photoUrl = (user && user.photo_url) ? String(user.photo_url) : "";
    setAvatar(photoUrl);
    try {
      if (photoUrl) sessionStorage.setItem("elecom_user_photo_url", photoUrl);
      else sessionStorage.removeItem("elecom_user_photo_url");
    } catch (e) {
      // ignore
    }

    setValue(pfFullName, fullName);
    setValue(pfStudentId, data.student_id || user.student_id || student.id_number);

    setValue(pfCourse, student.course || user.department || "");
    const yearVal = (student.year != null ? String(student.year) : (user.year_level != null ? String(user.year_level) : ""));
    const sectionVal = (student.section || user.section || "");
    const yearSection = `${yearVal || ""}${sectionVal || ""}`.trim();
    setValue(pfYearSection, yearSection);

    setValue(pfEmail, student.email || user.email || "");
    setValue(pfPhone, student.phone_number || user.phone || "");
    setValue(pfCreatedAt, fmtCreatedAt(user.created_at));

    if (profileLoading) profileLoading.style.display = "none";
    if (profileGrid) profileGrid.style.display = "flex";
  };

  if (btnChangeProfilePhoto && profilePhotoFile) {
    btnChangeProfilePhoto.addEventListener("click", () => {
      profilePhotoFile.click();
    });
  }

  if (profilePhotoFile) {
    profilePhotoFile.addEventListener("change", async () => {
      const file = profilePhotoFile.files && profilePhotoFile.files[0];
      if (!file) return;

      if (profileSuccess) profileSuccess.style.display = "none";
      if (profileError) profileError.style.display = "none";

      try {
        const url = await uploadToCloudinary({ file, type: "profile_photo" });
        if (!url) throw new Error("Upload failed.");
        await saveProfilePhotoUrl(url);
        setAvatar(url);

        try {
          sessionStorage.setItem("elecom_user_photo_url", url);
        } catch (e) {
          // ignore
        }

        showSuccess("Profile photo updated.");
      } catch (e) {
        showError(e && e.message ? e.message : "Failed to update profile photo.");
      } finally {
        try {
          profilePhotoFile.value = "";
        } catch (e) {
          // ignore
        }
      }
    });
  }

  loadProfile();
});
