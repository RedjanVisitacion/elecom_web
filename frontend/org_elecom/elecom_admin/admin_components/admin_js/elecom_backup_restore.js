(function () {
  const API_HISTORY = "/backup/history/";
  const API_SETTINGS = "/backup/settings/";
  const API_CREATE = "/backup/create/";
  const API_RESTORE = "/backup/restore/";
  const API_DELETE = "/backup/delete/";

  let page = 1;
  let total = 0;
  let pageSize = 8;
  let latestBackup = null;
  let pendingRestoreForm = null;
  const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);

  const showAlert = (message, type) => {
    const alert = $("backupAlert");
    if (!alert) return;
    alert.textContent = message || "";
    alert.className = `backup-alert ${type || "success"}`;
    alert.classList.toggle("d-none", !message);
  };

  const formatBytes = (bytes) => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
  };

  const formatDate = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const setProgress = (visible, text) => {
    const wrap = $("backupProgress");
    const label = $("backupProgressText");
    if (!wrap) return;
    wrap.classList.toggle("d-none", !visible);
    if (label) label.textContent = text || "Preparing backup...";
  };

  const statusClass = (status) => {
    const safeStatus = String(status || "").toLowerCase();
    if (safeStatus === "completed") return "status-completed";
    if (safeStatus === "processing") return "status-processing";
    if (safeStatus === "restoring") return "status-restoring";
    return "status-failed";
  };

  const updateAnalytics = (stats, storageUsed) => {
    const safeStats = stats || {};
    const total = $("statTotalBackups");
    const success = $("statSuccessBackups");
    const failed = $("statFailedBackups");
    const storage = $("statStorageUsed");
    const last = $("statLastBackup");
    if (total) total.textContent = String(safeStats.total_backups || 0);
    if (success) success.textContent = String(safeStats.successful_backups || 0);
    if (failed) failed.textContent = String(safeStats.failed_backups || 0);
    if (storage) storage.textContent = formatBytes(storageUsed || 0);
    if (last) last.textContent = safeStats.last_backup_time ? formatDate(safeStats.last_backup_time) : "None yet";
  };

  const renderHistory = (items) => {
    const body = $("backupHistoryBody");
    if (!body) return;
    if (!items.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="backup-empty-state">
              <i class="bi bi-database-add"></i>
              <strong>No backups yet</strong>
              <span>Create a protected backup before changing election records or system settings.</span>
              <button class="btn btn-sm btn-primary empty-create-backup" type="button"><i class="bi bi-plus-circle"></i> Create Backup</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    body.innerHTML = items.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(item.type_label)}</td>
        <td>${escapeHtml(formatDate(item.created_at))}</td>
        <td>${escapeHtml(formatBytes(item.file_size))}</td>
        <td>${escapeHtml(item.created_by || "Admin")}</td>
        <td><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status || "completed")}</span></td>
        <td>
          <div class="backup-actions">
            <a class="btn btn-sm btn-outline-dark download-action" href="/backup/download/${item.id}/" title="Download backup" aria-label="Download ${escapeHtml(item.name)}"><i class="bi bi-download"></i></a>
            <button class="btn btn-sm btn-outline-warning restore-action history-restore-btn" type="button" data-id="${item.id}" data-name="${escapeHtml(item.name)}" title="Restore backup" aria-label="Restore ${escapeHtml(item.name)}"><i class="bi bi-database-down"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-backup-btn" type="button" data-id="${item.id}" title="Delete backup" aria-label="Delete ${escapeHtml(item.name)}"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  const updateStorage = (bytes) => {
    const used = Number(bytes) || 0;
    const text = formatBytes(bytes);
    const storageText = $("storageUsageText");
    const meterText = $("storageMeterText");
    const fill = $("storageMeterFill");
    const historyFill = $("historyStorageFill");
    const historyPercent = $("historyStoragePercent");
    const pctValue = Math.min(100, (used / STORAGE_LIMIT_BYTES) * 100);
    const pctText = `${pctValue.toFixed(pctValue >= 10 ? 1 : 2)}%`;
    const width = used > 0 ? `${Math.max(2, pctValue)}%` : "0";
    if (storageText) storageText.textContent = `${text} / 5 GB Used`;
    if (meterText) meterText.textContent = `${text} / 5 GB`;
    if (historyPercent) historyPercent.textContent = pctText;
    [fill, historyFill].forEach((bar) => {
      if (!bar) return;
      bar.style.width = width;
      bar.classList.toggle("warn", pctValue >= 70 && pctValue < 90);
      bar.classList.toggle("danger", pctValue >= 90);
    });
  };

  const setButtonLoading = (button, loading, label = "Saving") => {
    if (!button) return;
    if (loading) {
      button.dataset.originalHtml = button.innerHTML;
      button.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> ${escapeHtml(label)}`;
    } else if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  };

  const loadHistory = async () => {
    const url = new URL(API_HISTORY, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    const resp = await fetch(url.toString(), { credentials: "same-origin", cache: "no-store" });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || "Failed to load backup history.");
    total = Number(data.total || 0);
    pageSize = Number(data.page_size || pageSize);
    latestBackup = data.latest_backup || (data.backups && data.backups[0]) || null;
    renderHistory(data.backups || []);
    updateStorage(data.storage_used || 0);
    updateAnalytics(data.stats || {}, data.storage_used || 0);
    const latestText = $("latestBackupText");
    if (latestText) latestText.textContent = latestBackup ? latestBackup.name : "No backup available";
    const pageText = $("backupPageText");
    if (pageText) pageText.textContent = `Page ${page}`;
    const prev = $("backupPrevBtn");
    const next = $("backupNextBtn");
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page * pageSize >= total;
  };

  const loadSettings = async () => {
    const resp = await fetch(API_SETTINGS, { credentials: "same-origin", cache: "no-store" });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || "Failed to load backup settings.");
    const settings = data.settings || {};
    const enabled = $("autoBackupEnabled");
    if (enabled) enabled.checked = !!settings.enabled;
    document.querySelectorAll('input[name="backupFrequency"]').forEach((input) => {
      input.checked = input.value === (settings.frequency || "weekly");
    });
    const autoText = $("autoBackupText");
    if (autoText) autoText.textContent = settings.enabled ? `${settings.frequency} enabled` : "Automatic backup disabled";
    const next = $("nextScheduleText");
    const latest = $("latestSuccessText");
    if (next) next.textContent = settings.next_scheduled_backup ? formatDate(settings.next_scheduled_backup) : "Not scheduled";
    if (latest) latest.textContent = settings.latest_successful_backup ? formatDate(settings.latest_successful_backup) : "None yet";
    if (data.auto_backup && data.auto_backup.ran && data.auto_backup.backup) {
      showAlert(`Automatic backup created: ${data.auto_backup.backup.name}`, "success");
    } else if (settings.last_attempt_error) {
      showAlert(`Auto backup needs attention: ${settings.last_attempt_error}`, "error");
    }
  };

  const refreshAll = async () => {
    showAlert("", "success");
    try {
      await Promise.all([loadHistory(), loadSettings()]);
    } catch (error) {
      showAlert(error.message, "error");
    }
  };

  const createBackup = async (type) => {
    showAlert("", "success");
    setProgress(true, "Generating backup file...");
    document.querySelectorAll("[data-backup-type]").forEach((btn) => { btn.disabled = true; });
    try {
      const resp = await fetch(API_CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ type }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.error || "Backup failed.");
      showAlert(`Backup created: ${data.backup.name}`, "success");
      page = 1;
      await refreshAll();
    } catch (error) {
      showAlert(error.message, "error");
      await loadHistory().catch(() => {});
    } finally {
      setProgress(false);
      document.querySelectorAll("[data-backup-type]").forEach((btn) => { btn.disabled = false; });
    }
  };

  const deleteBackup = async (id) => {
    if (!window.confirm("Delete this backup file and history record?")) return;
    const resp = await fetch(`${API_DELETE}${id}/`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      showAlert(data.error || "Failed to delete backup.", "error");
      return;
    }
    showAlert("Backup deleted.", "success");
    await refreshAll();
  };

  const openRestoreConfirm = (formData) => {
    pendingRestoreForm = formData;
    const error = $("restorePasswordError");
    const input = $("restorePasswordInput");
    if (error) error.textContent = "";
    if (input) input.value = "";
    const modalEl = $("restoreConfirmModal");
    if (!modalEl || !window.bootstrap) return;
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setTimeout(() => input && input.focus(), 200);
  };

  const submitRestore = async () => {
    const password = $("restorePasswordInput");
    const error = $("restorePasswordError");
    if (!pendingRestoreForm) return;
    if (!password || !password.value.trim()) {
      if (error) error.textContent = "Admin password is required.";
      return;
    }
    pendingRestoreForm.set("password", password.value.trim());
    const confirmBtn = $("confirmRestoreBtn");
    setButtonLoading(confirmBtn, true, "Restoring");
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      const resp = await fetch(API_RESTORE, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: pendingRestoreForm,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.error || "Restore failed.");
      const modalEl = $("restoreConfirmModal");
      if (modalEl && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      pendingRestoreForm = null;
      const form = $("restoreForm");
      if (form) form.reset();
      const label = $("backupFileLabel");
      if (label) label.textContent = "Choose backup file";
      showAlert("Backup restored successfully.", "success");
      await refreshAll();
    } catch (restoreError) {
      if (error) error.textContent = restoreError.message;
    } finally {
      setButtonLoading(confirmBtn, false);
      if (confirmBtn) confirmBtn.disabled = false;
    }
  };

  const saveSettings = async () => {
    const enabled = !!($("autoBackupEnabled") && $("autoBackupEnabled").checked);
    const frequencyInput = document.querySelector('input[name="backupFrequency"]:checked');
    const frequency = frequencyInput ? frequencyInput.value : "weekly";
    const saveBtn = $("saveAutoSettingsBtn");
    setButtonLoading(saveBtn, true);
    if (saveBtn) saveBtn.disabled = true;
    try {
      const resp = await fetch(API_SETTINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ enabled, frequency }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        showAlert(data.error || "Failed to save settings.", "error");
        return;
      }
      showAlert("Auto backup settings saved.", "success");
      await Promise.all([loadHistory(), loadSettings()]);
    } finally {
      setButtonLoading(saveBtn, false);
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  const setupUploadDropZone = () => {
    const zone = document.querySelector(".backup-upload-zone");
    const input = $("backupFileInput");
    if (!zone || !input) return;
    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.remove("dragover");
      });
    });
    zone.addEventListener("drop", (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    $("backupPrevBtn")?.addEventListener("click", () => {
      if (page > 1) {
        page -= 1;
        loadHistory().catch((error) => showAlert(error.message, "error"));
      }
    });
    $("backupNextBtn")?.addEventListener("click", () => {
      if (page * pageSize < total) {
        page += 1;
        loadHistory().catch((error) => showAlert(error.message, "error"));
      }
    });
    document.querySelectorAll("[data-backup-type]").forEach((btn) => {
      btn.addEventListener("click", () => createBackup(btn.dataset.backupType || "postgres"));
    });
    $("downloadLatestBtn")?.addEventListener("click", () => {
      if (!latestBackup) {
        showAlert("No backup is available to download yet.", "error");
        return;
      }
      window.location.href = `/backup/download/${latestBackup.id}/`;
    });
    $("openRestoreCard")?.addEventListener("click", () => {
      $("restorePanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("toggleAutoCard")?.addEventListener("click", () => {
      $("autoBackupEnabled")?.focus();
    });
    $("backupFileInput")?.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      const label = $("backupFileLabel");
      if (label) label.textContent = file ? file.name : "Choose backup file";
    });
    $("restoreForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const fileInput = $("backupFileInput");
      if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showAlert("Choose a .sql or .zip backup file before restoring.", "error");
        return;
      }
      const formData = new FormData(event.currentTarget);
      openRestoreConfirm(formData);
    });
    $("confirmRestoreBtn")?.addEventListener("click", submitRestore);
    $("saveAutoSettingsBtn")?.addEventListener("click", saveSettings);
    $("backupHistoryBody")?.addEventListener("click", (event) => {
      const emptyCreate = event.target.closest(".empty-create-backup");
      if (emptyCreate) {
        createBackup("postgres");
        return;
      }
      const deleteBtn = event.target.closest(".delete-backup-btn");
      if (deleteBtn) {
        deleteBackup(deleteBtn.dataset.id);
        return;
      }
      const restoreBtn = event.target.closest(".history-restore-btn");
      if (restoreBtn) {
        const formData = new FormData();
        formData.set("backup_id", restoreBtn.dataset.id || "");
        formData.set("scope", "database");
        openRestoreConfirm(formData);
        showAlert(`Confirm your password to restore ${restoreBtn.dataset.name}.`, "success");
      }
    });
    setupUploadDropZone();
    refreshAll();
  });
})();
