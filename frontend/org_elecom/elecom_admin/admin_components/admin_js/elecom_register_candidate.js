document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");

  const candidateSearchInput = document.getElementById("candidateSearch");
  const candidateSearchBtn = document.getElementById("candidateSearchBtn");

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

  const redirectToSearchResults = () => {
    const q = String(candidateSearchInput?.value || "").trim();
    const url = new URL("/static/org_elecom/elecom_admin/search_results.html", window.location.origin);
    if (q) url.searchParams.set("q", q);
    window.location.href = window.ElecomAdminSecureUrl ? window.ElecomAdminSecureUrl(url.toString()) : url.toString();
  };

  if (candidateSearchInput) {
    candidateSearchInput.addEventListener("focus", redirectToSearchResults);
    candidateSearchInput.addEventListener("click", redirectToSearchResults);
  }

  if (candidateSearchBtn) {
    candidateSearchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      redirectToSearchResults();
    });
  }

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


  const applicationsList = document.getElementById("candidateApplicationsList");
  const refreshApplicationsBtn = document.getElementById("refreshApplicationsBtn");

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const candidateName = (app) =>
    [app.first_name, app.middle_name, app.last_name]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(" ");

  const renderApplications = (applications) => {
    if (!applicationsList) return;
    if (!applications.length) {
      applicationsList.innerHTML = '<div class="text-muted">No pending candidate filings.</div>';
      return;
    }

    applicationsList.innerHTML = applications
      .map((app) => {
        const photo = app.photo_url || "/static/assets/avatar-placeholder.png";
        return `
          <div class="border rounded-3 p-3 d-flex gap-3 align-items-start">
            <img src="${escapeHtml(photo)}" alt="" class="rounded-3 border" style="width:72px;height:82px;object-fit:cover;">
            <div class="flex-grow-1">
              <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <div>
                  <strong>${escapeHtml(candidateName(app))}</strong>
                  <div class="small text-muted">${escapeHtml(app.student_id)} • ${escapeHtml(app.organization)} • ${escapeHtml(app.position)}</div>
                  <div class="small text-muted">${escapeHtml(app.program)} ${escapeHtml(app.year_section)} • ${escapeHtml(app.candidate_type || "Independent")}</div>
                </div>
                <span class="badge text-bg-warning">Pending</span>
              </div>
              <div class="small mt-2">${escapeHtml(app.platform || "")}</div>
              <div class="d-flex flex-wrap gap-2 justify-content-end mt-3">
                <button type="button" class="btn btn-outline-danger btn-sm" data-app-decision="reject" data-app-id="${escapeHtml(app.id)}">Reject</button>
                <button type="button" class="btn btn-primary btn-sm" data-app-decision="approve" data-app-id="${escapeHtml(app.id)}">Approve</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const loadApplications = async () => {
    if (!applicationsList) return;
    applicationsList.innerHTML = '<div class="text-muted">Loading applications...</div>';
    try {
      const res = await fetch(`${window.location.origin}/api/admin/candidate-applications/list/?status=pending`, {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load applications.");
      renderApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch (err) {
      applicationsList.innerHTML = `<div class="text-danger">${escapeHtml(err.message || "Failed to load applications.")}</div>`;
    }
  };

  const decideApplication = async (id, action) => {
    const label = action === "approve" ? "approve" : "reject";
    if (!confirm(`Are you sure you want to ${label} this filing?`)) return;
    try {
      const res = await fetch(`${window.location.origin}/api/admin/candidate-applications/decision/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to review application.");
      showAlert("success", action === "approve" ? "Candidate approved and published." : "Candidate filing rejected.");
      await loadApplications();
    } catch (err) {
      showAlert("error", err.message || "Failed to review application.");
    }
  };

  refreshApplicationsBtn?.addEventListener("click", loadApplications);
  applicationsList?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-app-decision]");
    if (!btn) return;
    decideApplication(btn.dataset.appId, btn.dataset.appDecision);
  });
  loadApplications();

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
          party_name: String(fd.get("party_name") || "").trim(),
          party_logo_url: String(fd.get("party_logo_url") || "").trim(),
        };

        if (!payload.middle_name) delete payload.middle_name;
        if (!payload.party_name) delete payload.party_name;
        if (!payload.party_logo_url) delete payload.party_logo_url;

        setLoading(true);

        // Upload files if provided; file upload overrides manual URL fields
        if (!photoFile || typeof photoFile !== "object" || photoFile.size <= 0) {
          showAlert("error", "Candidate photo upload is required.");
          return;
        }

        const photoUrl = await uploadToCloudinary({ file: photoFile, type: "candidate_photo" });
        if (!photoUrl) {
          showAlert("error", "Candidate photo upload failed.");
          return;
        }
        payload.photo_url = photoUrl;

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
        await loadApplications();
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
