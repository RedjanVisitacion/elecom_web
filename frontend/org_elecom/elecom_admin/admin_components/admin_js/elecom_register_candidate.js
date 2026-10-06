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
  let applicationsSnapshot = "", applicationsRequest = null, applicationsGeneration = 0, reviewingApplication = false;
  const rejectionRemarksModalEl = document.getElementById("rejectionRemarksModal");
  const rejectionRemarksInput = document.getElementById("rejectionRemarksInput");
  const rejectionRemarksError = document.getElementById("rejectionRemarksError");
  const confirmRejectApplicationBtn = document.getElementById("confirmRejectApplicationBtn");
  const rejectionRemarksModal = rejectionRemarksModalEl && window.bootstrap
    ? new bootstrap.Modal(rejectionRemarksModalEl)
    : null;
  let pendingRejectApplicationId = "";

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
    const cards = (items) => items
      .map((app) => {
        const photo = app.photo_url || "/static/assets/avatar-placeholder.png";
        const reviewingRequirements = app.status === "requirements_review";
        const requirementLinks = reviewingRequirements
          ? [
              ["2x2 Picture", app.requirements_photo_url, "requirements_photo"],
              ["Certificate of Enrollment", app.enrollment_certificate_url, "enrollment_certificate"],
              ["Grades - Last 2 Semesters", app.grades_url, "grades"],
              ["Good Moral Certificate", app.good_moral_url, "good_moral"],
            ]
              .map(([label, url, kind]) => `<button type="button" class="btn btn-outline-secondary btn-sm" data-app-preview="${kind}" data-app-id="${escapeHtml(app.id)}" data-election-id="${escapeHtml(app.election_id || "")}" data-candidate-name="${escapeHtml(candidateName(app))}" ${url ? "" : "disabled"}>${escapeHtml(label)}</button>`)
              .join("")
          : "";
        return `
          <div class="border rounded-3 p-3 d-flex gap-3 align-items-start">
            <img src="${escapeHtml(photo)}" alt="" class="rounded-3 border" style="width:72px;height:82px;object-fit:cover;">
            <div class="flex-grow-1">
              <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <div>
                  <strong>${escapeHtml(candidateName(app))}</strong>
                  <div class="small text-muted">${escapeHtml(app.student_id)} &bull; ${escapeHtml(app.organization)} &bull; ${escapeHtml(app.position)}</div>
                  <div class="small text-muted">${escapeHtml(app.program)} ${escapeHtml(app.year_section)} &bull; ${escapeHtml(app.candidate_type || "Independent")}</div>
                </div>
                <span class="badge ${reviewingRequirements ? "text-bg-info" : "text-bg-warning"}">${reviewingRequirements ? "Requirements Review" : "Initial Review"}</span>
              </div>
              <div class="small mt-2">${escapeHtml(app.platform || "")}</div>
              ${reviewingRequirements ? `<div class="small fw-semibold mt-3 mb-2">Submitted follow-up requirements</div><div class="d-flex flex-wrap gap-2">${requirementLinks}</div>` : ""}
              <div class="d-flex flex-wrap gap-2 justify-content-end mt-3">
                <button type="button" class="btn btn-outline-danger btn-sm" data-app-decision="reject" data-app-id="${escapeHtml(app.id)}">Reject</button>
                <button type="button" class="btn btn-primary btn-sm" data-app-decision="approve" data-app-id="${escapeHtml(app.id)}" data-app-stage="${reviewingRequirements ? "final" : "initial"}">${reviewingRequirements ? "Approve & Publish" : "Approve Initial Filing"}</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
    const initial = applications.filter(app => app.status === 'pending');
    const requirements = applications.filter(app => app.status === 'requirements_review');
    document.getElementById('initialApplicationsList').innerHTML = cards(initial) || '<div class="text-muted small py-2">No initial filings awaiting review.</div>';
    document.getElementById('requirementsApplicationsList').innerHTML = cards(requirements) || '<div class="text-muted small py-2">No supporting documents awaiting final review.</div>';
    document.getElementById('initialApplicationsCount').textContent = initial.length;
    document.getElementById('requirementsApplicationsCount').textContent = requirements.length;

  };

  const loadApplications = async (silent = false) => {
    if (!applicationsList || (silent && (applicationsRequest || reviewingApplication || document.hidden || document.querySelector('.modal.show')))) return;
    if (applicationsRequest) applicationsRequest.abort();
    const controller = new AbortController(); applicationsRequest = controller;
    const generation = ++applicationsGeneration;
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/candidate-applications/list/?status=pending`, {
        method: 'GET', credentials: 'include', cache: 'no-store', signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load applications.');
      if (generation !== applicationsGeneration) return;
      const applications = Array.isArray(data.applications) ? data.applications : [];
      const snapshot = JSON.stringify(applications);
      if (snapshot !== applicationsSnapshot) { renderApplications(applications); applicationsSnapshot = snapshot; }
      document.getElementById('applicationsSyncStatus').textContent = 'Updates automatically';
    } catch (err) {
      if (generation === applicationsGeneration) document.getElementById('applicationsSyncStatus').textContent = 'Connection interrupted. Retrying automatically...';
    } finally {
      clearTimeout(timeout);
      if (applicationsRequest === controller) applicationsRequest = null;
    }
  };
  let applicationsTimer = null;
  const startApplicationsPolling = () => {
    if (!applicationsTimer && !document.hidden) applicationsTimer = setInterval(() => loadApplications(true), 3000);
  };
  const stopApplicationsPolling = () => { clearInterval(applicationsTimer); applicationsTimer = null; };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopApplicationsPolling();
    else { loadApplications(true); startApplicationsPolling(); }
  });
  window.addEventListener('pagehide', () => { stopApplicationsPolling(); applicationsRequest?.abort(); });
  window.addEventListener('pageshow', startApplicationsPolling);
  startApplicationsPolling();

  const decideApplication = async (id, action, reason = "", stage = "") => {
    if (reviewingApplication) return;
    const label = action === "approve" && stage === "final" ? "approve these requirements and publish this candidate" : action === "approve" ? "approve this filing and request follow-up requirements" : "reject";
    if (action !== "reject" && !confirm(`Are you sure you want to ${label} this filing?`)) return;
    try {
      reviewingApplication = true;
      if (confirmRejectApplicationBtn) confirmRejectApplicationBtn.disabled = true;
      const res = await fetch(`${window.location.origin}/api/admin/candidate-applications/decision/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to review application.");
      const successMessage = action === "reject"
        ? "Candidate filing rejected."
        : data.status === "requirements_pending"
          ? "Initial filing approved. The student can now submit follow-up requirements."
          : "Requirements approved. Candidate published.";
      showAlert("success", successMessage);
      if (action === "reject") rejectionRemarksModal?.hide();
      await loadApplications();
    } catch (err) {
      showAlert("error", err.message || "Failed to review application.");
    } finally {
      reviewingApplication = false;
      if (confirmRejectApplicationBtn) confirmRejectApplicationBtn.disabled = false;
    }
  };

  const openRejectRemarks = (id) => {
    pendingRejectApplicationId = String(id || "");
    if (rejectionRemarksInput) rejectionRemarksInput.value = "";
    rejectionRemarksError?.classList.add("d-none");
    if (rejectionRemarksModal) {
      rejectionRemarksModal.show();
      setTimeout(() => rejectionRemarksInput?.focus(), 180);
      return;
    }

    const reason = window.prompt("Enter rejection remarks for this candidate filing:");
    if (reason && reason.trim()) {
      decideApplication(pendingRejectApplicationId, "reject", reason.trim());
    } else if (reason !== null) {
      showAlert("error", "Rejection remarks are required.");
    }
  };

  const previewElement = document.getElementById('candidatePreviewModal');
  const previewModal = new bootstrap.Modal(previewElement);
  const previewBody = document.getElementById('candidatePreviewBody');
  let previewUrl = '', previewRequest = null;
  function clearPreview() {
    if (previewRequest) previewRequest.abort();
    previewRequest = null; previewBody.replaceChildren();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }
  previewElement.addEventListener('hidden.bs.modal', clearPreview);
  async function openPreview(kind, label, selected) {
    if (!selected) return;
    clearPreview();
    const controller = new AbortController(); previewRequest = controller;
    document.getElementById('candidatePreviewTitle').textContent = `${label} ? ${selected.name}`;
    const message = document.createElement('p'); message.className = 'preview-message'; message.setAttribute('role', 'status'); message.textContent = 'Loading file?';
    previewBody.append(message); previewModal.show();
    const params = new URLSearchParams({ id: selected.id, source: 'application', election_id: selected.election_id || '', kind });
    try {
      const response = await fetch(`/api/admin/candidates/document/preview/?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const type = response.headers.get('content-type') || '';
      if (!response.ok) {
        const data = type.includes('application/json') ? await response.json() : null;
        throw new Error(data?.error || 'Unable to load this file. Refresh the page and try again.');
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].some(allowed => type.startsWith(allowed))) throw new Error('This file type cannot be previewed.');
      const blob = await response.blob();
      if (controller.signal.aborted || previewRequest !== controller) return;
      previewUrl = URL.createObjectURL(blob);
      const viewer = document.createElement(type.startsWith('image/') ? 'img' : 'iframe');
      viewer.className = type.startsWith('image/') ? 'candidate-preview-photo' : 'candidate-preview-pdf';
      if (type.startsWith('image/')) viewer.alt = label;
      else viewer.title = label;
      viewer.src = previewUrl;
      viewer.addEventListener('error', () => { message.textContent = 'Unable to display this file in your browser.'; previewBody.replaceChildren(message); });
      previewBody.replaceChildren(viewer);
    } catch (error) {
      if (error.name === 'AbortError' || previewRequest !== controller) return;
      message.textContent = error.message; message.classList.add('text-danger'); previewBody.replaceChildren(message);
    }
  }
  applicationsList?.addEventListener("click", (event) => {
    const previewButton = event.target.closest('[data-app-preview]');
    if (previewButton) {
      openPreview(previewButton.dataset.appPreview, previewButton.textContent.trim(), {
        id: previewButton.dataset.appId, election_id: previewButton.dataset.electionId, name: previewButton.dataset.candidateName,
      });
      return;
    }

    const btn = event.target.closest("[data-app-decision]");
    if (!btn) return;
    if (btn.dataset.appDecision === "reject") {
      openRejectRemarks(btn.dataset.appId);
      return;
    }
    decideApplication(btn.dataset.appId, btn.dataset.appDecision, "", btn.dataset.appStage || "");
  });
  confirmRejectApplicationBtn?.addEventListener("click", () => {
    const reason = String(rejectionRemarksInput?.value || "").trim();
    if (!reason) {
      rejectionRemarksError?.classList.remove("d-none");
      rejectionRemarksInput?.focus();
      return;
    }
    rejectionRemarksError?.classList.add("d-none");
    decideApplication(pendingRejectApplicationId, "reject", reason);
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

