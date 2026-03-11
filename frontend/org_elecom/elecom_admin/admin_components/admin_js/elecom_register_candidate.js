document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");
  const logoutLink = document.getElementById("logoutLink");
  const displayName = document.getElementById("displayName");
  const displayRole = document.getElementById("displayRole");

  const successAlert = document.getElementById("successAlert");
  const errorAlert = document.getElementById("errorAlert");

  const form = document.getElementById("registerCandidateForm");
  const submitBtn = document.getElementById("submitBtn");

  const showAlert = (type, msg) => {
    if (successAlert) successAlert.style.display = "none";
    if (errorAlert) errorAlert.style.display = "none";

    const el = type === "success" ? successAlert : errorAlert;
    if (!el) return;

    el.textContent = msg;
    el.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setLoading = (loading) => {
    if (!submitBtn) return;
    submitBtn.disabled = !!loading;

    if (loading) {
      submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
    } else {
      submitBtn.innerHTML = submitBtn.dataset.originalText || "Submit";
    }
  };

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

  // Sidebar
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar?.classList.add("active");
      sidebarOverlay?.classList.add("active");
    });
  }
  if (closeSidebar) {
    closeSidebar.addEventListener("click", () => {
      sidebar?.classList.remove("active");
      sidebarOverlay?.classList.remove("active");
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      sidebar?.classList.remove("active");
      sidebarOverlay?.classList.remove("active");
    });
  }

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 992) {
        sidebar?.classList.remove("active");
        sidebarOverlay?.classList.remove("active");
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 992) {
      sidebar?.classList.remove("active");
      sidebarOverlay?.classList.remove("active");
    }
  });

  const toLogin = () => {
    try {
      sessionStorage.removeItem("elecom_role");
      sessionStorage.removeItem("elecom_user");
    } catch (e) {
      // ignore
    }
    window.location.href = `${window.location.origin}/login/`;
  };

  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      toLogin();
    });
  }

  // User info
  try {
    const role = sessionStorage.getItem("elecom_role") || "admin";
    const user = sessionStorage.getItem("elecom_user") || "";
    if (displayName) displayName.textContent = user || "Admin";
    if (displayRole) displayRole.textContent = role;
  } catch (e) {
    // ignore
  }

  // Toggle party fields
  const partyFields = document.querySelectorAll(".party-fields");
  const updateParty = () => {
    const isParty = document.getElementById("type_party")?.checked;
    partyFields.forEach((el) => el.classList.toggle("d-none", !isParty));
  };
  document.querySelectorAll('input[name="candidate_type"]').forEach((r) => r.addEventListener("change", updateParty));
  updateParty();

  // Program -> Year/Section
  const programSelect = document.getElementById("programSelect");
  const yearSelect = document.getElementById("yearSectionSelect");

  const optionsByProgram = {
    BSIT: [
      "BSIT-1A",
      "BSIT-1B",
      "BSIT-1C",
      "BSIT-1D",
      "BSIT-2A",
      "BSIT-2B",
      "BSIT-2C",
      "BSIT-2D",
      "BSIT-3A",
      "BSIT-3B",
      "BSIT-3C",
      "BSIT-3D",
      "BSIT-4A",
      "BSIT-4B",
      "BSIT-4C",
      "BSIT-4D",
      "BSIT-4E",
      "BSIT-4F",
    ],
    BTLED: [
      "BTLED-ICT-1A",
      "BTLED-ICT-2A",
      "BTLED-ICT-3A",
      "BTLED-ICT-4A",
      "BTLED-IA-1A",
      "BTLED-IA-2A",
      "BTLED-IA-3A",
      "BTLED-IA-4A",
      "BTLED-HE-1A",
      "BTLED-HE-2A",
      "BTLED-HE-3A",
      "BTLED-HE-4A",
    ],
    BFPT: [
      "BFPT-1A",
      "BFPT-1B",
      "BFPT-1C",
      "BFPT-1D",
      "BFPT-2A",
      "BFPT-2B",
      "BFPT-2C",
      "BFPT-3A",
      "BFPT-3B",
      "BFPT-3C",
      "BFPT-4A",
      "BFPT-4B",
    ],
  };

  const populateYearSections = () => {
    if (!programSelect || !yearSelect) return;
    const prog = programSelect.value;
    yearSelect.innerHTML = '<option value="" selected disabled>Select year/section</option>';
    if (!prog || !optionsByProgram[prog]) return;

    optionsByProgram[prog].forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      yearSelect.appendChild(opt);
    });
  };

  programSelect?.addEventListener("change", populateYearSections);
  populateYearSections();

  // Organization -> Position rule: only USG can select Representative
  const orgSelect = document.querySelector('select[name="organization"]');
  const positionSelect = document.querySelector('select[name="position"]');

  const filterPositionsByOrg = () => {
    if (!orgSelect || !positionSelect) return;
    const isUSG = (orgSelect.value || "").toUpperCase() === "USG";

    Array.from(positionSelect.options).forEach((opt) => {
      if (/Representative/i.test(opt.textContent)) {
        opt.disabled = !isUSG;
        if (!isUSG && positionSelect.value === opt.value) {
          positionSelect.value = "";
        }
      }
    });
  };

  orgSelect?.addEventListener("change", filterPositionsByOrg);
  filterPositionsByOrg();

  // Submit handler
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        if (successAlert) successAlert.style.display = "none";
        if (errorAlert) errorAlert.style.display = "none";

        const fd = new FormData(form);

        const photoFile = fd.get("photo_file");
        const partyLogoFile = fd.get("party_logo_file");

        const payload = {
          candidate_type: String(fd.get("candidate_type") || "").trim(),
          student_id: String(fd.get("student_id") || "").trim(),
          organization: String(fd.get("organization") || "").trim(),
          first_name: String(fd.get("first_name") || "").trim(),
          middle_name: String(fd.get("middle_name") || "").trim(),
          last_name: String(fd.get("last_name") || "").trim(),
          position: String(fd.get("position") || "").trim(),
          program: String(fd.get("program") || "").trim(),
          year_section: String(fd.get("year_section") || "").trim(),
          platform: String(fd.get("platform") || "").trim(),
          photo_url: String(fd.get("photo_url") || "").trim(),
          party_name: String(fd.get("party_name") || "").trim(),
          party_logo_url: String(fd.get("party_logo_url") || "").trim(),
        };

        if (!payload.photo_url) delete payload.photo_url;
        if (!payload.middle_name) delete payload.middle_name;
        if (!payload.party_name) delete payload.party_name;
        if (!payload.party_logo_url) delete payload.party_logo_url;

        setLoading(true);

        // Upload files if provided; file upload overrides manual URL fields
        if (photoFile && typeof photoFile === "object" && photoFile.size > 0) {
          const url = await uploadToCloudinary({ file: photoFile, type: "candidate_photo" });
          if (!url) {
            showAlert("error", "Candidate photo upload failed.");
            return;
          }
          payload.photo_url = url;
        }

        if (partyLogoFile && typeof partyLogoFile === "object" && partyLogoFile.size > 0) {
          const url = await uploadToCloudinary({ file: partyLogoFile, type: "party_logo" });
          if (!url) {
            showAlert("error", "Party logo upload failed.");
            return;
          }
          payload.party_logo_url = url;
        }

        const res = await fetch(`${window.location.origin}/api/admin/candidates/create/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          showAlert("error", data.error || "Failed to register candidate.");
          return;
        }

        showAlert("success", `Candidate registered successfully.`);
        form.reset();
        populateYearSections();
        filterPositionsByOrg();
        updateParty();
      } catch (err) {
        const msg = (err && err.message) ? String(err.message) : "Failed to register candidate.";
        showAlert("error", msg);
      } finally {
        setLoading(false);
      }
    });
  }
});
