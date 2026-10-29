const API_BASE_URL = "/api";
let detectedRequestIp = "";
let restrictionEnabled = false;
let accessLogs = [];
let logPage = 1;
const LOG_PAGE_SIZE = 10;
let logPollTimer = null;
let logRequest = null;
let logsLoaded = false;
let logsPageActive = true;

function startLogPolling() {
  if (logPollTimer || document.hidden || !logsPageActive) return;
  loadAccessLogs(logsLoaded);
  logPollTimer = setInterval(() => loadAccessLogs(true), 3000);
}

function stopLogPolling() {
  clearInterval(logPollTimer);
  logPollTimer = null;
  if (logRequest) logRequest.abort();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLogPolling();
  else startLogPolling();
});
window.addEventListener('pagehide', () => { logsPageActive = false; stopLogPolling(); });
window.addEventListener('pageshow', event => {
  if (event.persisted) { logsPageActive = true; loadNetworkSettings(); startLogPolling(); }
});

function initNetworkAuthorizePage() {
  setupEventListeners();
  loadNetworkSettings();
  startLogPolling();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNetworkAuthorizePage);
} else {
  initNetworkAuthorizePage();
}

// Sidebar interactions are owned by admin_user_menu.js on every admin page.

function setupEventListeners() {
  document.getElementById("logSearchInput")?.addEventListener("input", () => { logPage = 1; renderAccessLogs(); });
  document.getElementById("logPrevious")?.addEventListener("click", () => { logPage--; renderAccessLogs(); });
  document.getElementById("logNext")?.addEventListener("click", () => { logPage++; renderAccessLogs(); });
  const addBtn = document.getElementById("btnAddNetwork");
  if (addBtn) {
    addBtn.addEventListener("click", addNetwork);
  } else {
    console.error("Network authorize add button was not found.");
  }

  document.getElementById("useCurrentIpBtn")?.addEventListener("click", () => {
    const ipInput = document.getElementById("networkIpInput");
    if (ipInput && detectedRequestIp) {
      ipInput.value = detectedRequestIp;
      ipInput.focus();
    }
  });

  document.getElementById("authorizedNetworksBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-network]");
    if (!button) return;
    deleteNetwork(button.dataset.deleteNetwork);
  });
}

async function loadNetworkSettings() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/network-settings/`, {
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load network settings");
    }

    restrictionEnabled = data.enabled === true;
    detectedRequestIp = data.current_ip || data.request_ip || "";
    renderDetectedRequestIp(detectedRequestIp);
    renderAuthorizedNetworks(data.networks || []);
  } catch (error) {
    console.error("Error loading network settings:", error);
    showNotification(error.message || "Error loading network settings", "error");
    renderDetectedRequestIp("");
    renderAuthorizedNetworks([]);
  }
}

async function addNetwork() {
  const ipInput = document.getElementById("networkIpInput");
  const ssidInput = document.getElementById("ssidInput");
  const addBtn = document.getElementById("btnAddNetwork");
  const networkIp = (ipInput?.value || "").trim();
  const ssid = (ssidInput?.value || "").trim();

  if (!networkIp) {
    showNotification("Enter a network IP first.", "error");
    ipInput?.focus();
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Adding...";

  try {
    const response = await fetch(`${API_BASE_URL}/admin/network-settings/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        network_ip: networkIp,
        ssid,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to add network");
    }

    if (ipInput) ipInput.value = "";
    if (ssidInput) ssidInput.value = "";
    showNotification("Authorized network added.", "success");
    loadNetworkSettings();
  } catch (error) {
    console.error("Error adding network:", error);
    showNotification(error.message || "Error adding network", "error");
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "+ Add Network";
  }
}

async function deleteNetwork(networkId) {
  if (!networkId) return;

  try {
    const response = await fetch(`${API_BASE_URL}/admin/network-settings/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: networkId }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to delete network");
    }

    showNotification("Authorized network removed.", "success");
    loadNetworkSettings();
  } catch (error) {
    console.error("Error deleting network:", error);
    showNotification(error.message || "Error deleting network", "error");
  }
}

function renderAuthorizedNetworks(networks) {
  const tbody = document.getElementById("authorizedNetworksBody");
  if (!tbody) return;

  if (!networks || networks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">No authorized networks</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = networks.map((network) => {
    const status = restrictionEnabled ? "Active" : "Disabled";
    const statusClass = status === "Active" ? "bg-success" : "bg-secondary";

    return `
      <tr>
        <td>${escapeHtml(formatDate(network.created_at || network.updated_at))}</td>
        <td>${escapeHtml(network.network_ip || "")}</td>
        <td>${escapeHtml(network.ssid || "N/A")}</td>
        <td><span class="badge ${statusClass}" data-network-status>${escapeHtml(status)}</span></td>
        <td class="text-center">
          <button type="button" class="delete-network-btn" data-delete-network="${escapeHtml(network.id)}" aria-label="Delete network">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderDetectedRequestIp(ipAddress) {
  const currentIp = document.getElementById("currentNetworkIp");
  const useCurrentBtn = document.getElementById("useCurrentIpBtn");

  if (currentIp) {
    currentIp.textContent = ipAddress || "Unavailable";
  }

  if (useCurrentBtn) {
    useCurrentBtn.disabled = !ipAddress;
  }
}

async function loadAccessLogs(silent = false) {
  if (logRequest || document.hidden || !logsPageActive) return;
  const controller = new AbortController();
  logRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE_URL}/admin/network-logs/`, {
      credentials: "include", cache: "no-store", signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load network access logs.");
    if (controller.signal.aborted || document.hidden || !logsPageActive) return;
    const nextLogs = data.logs || [];
    const changed = JSON.stringify(accessLogs) !== JSON.stringify(nextLogs);
    accessLogs = nextLogs;
    if (!logsLoaded || changed) renderAccessLogs();
    logsLoaded = true;
  } catch (error) {
    // Retain the last successful rows; background failures retry next interval.
    if (!silent && !document.hidden && logsPageActive) {
      document.getElementById('logPageStatus').textContent = 'Unable to load access attempts. Retrying automatically.';
    }
  } finally {
    clearTimeout(timeout);
    if (logRequest === controller) logRequest = null;
  }
}

function renderAccessLogs() {
  const query = document.getElementById("logSearchInput").value.trim().toLowerCase();
  const filtered = accessLogs.filter(log => String(log.student_id || "").toLowerCase().includes(query) || String(log.ip_address || "").toLowerCase().includes(query));
  const pages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
  logPage = Math.max(1, Math.min(logPage, pages));
  const start = (logPage - 1) * LOG_PAGE_SIZE;
  const logs = filtered.slice(start, start + LOG_PAGE_SIZE);
  document.getElementById("logPrevious").disabled = logPage <= 1;
  document.getElementById("logNext").disabled = logPage >= pages;
  document.getElementById("logPageStatus").textContent = filtered.length ? `${start + 1}-${Math.min(start + LOG_PAGE_SIZE, filtered.length)} of ${filtered.length} attempts (page ${logPage} of ${pages})` : '0 attempts';
  const tbody = document.getElementById("accessLogsBody");
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">${query ? "No matching access attempts" : "No access attempts recorded"}</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map((log) => `
    <tr>
      <td>${escapeHtml(formatDateTime(log.timestamp))}</td>
      <td>${escapeHtml(log.student_id || "N/A")}</td>
      <td><code>${escapeHtml(log.ip_address || "")}</code></td>
      <td>
        <span class="badge ${log.allowed ? "bg-success" : "bg-danger"}">
          ${log.allowed ? "Allowed" : "Blocked"}
        </span>
      </td>
    </tr>
  `).join("");
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showNotification(message, type = "info") {
    if (window.ElecomToast) return window.ElecomToast.show(message, { id: "network", type: type, title: 'Network Authorization', duration: type === "error" ? 0 : 6000 });
  const element = document.getElementById('networkToast');
  const error = type === 'error';
  element.dataset.type = type;
  document.getElementById('networkToastTitle').textContent = error ? 'Please check Network Authorization' : type === 'success' ? 'Network settings updated' : 'Network Authorization';
  document.getElementById('networkToastBody').textContent = String(message || '');
  document.getElementById('networkToastIcon').className = `bi ${error ? 'bi-exclamation-circle-fill text-danger' : type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-info-circle-fill text-primary'} me-2`;
  element.setAttribute('role', error ? 'alert' : 'status');
  element.setAttribute('aria-live', error ? 'assertive' : 'polite');
  bootstrap.Toast.getInstance(element)?.dispose();
  new bootstrap.Toast(element, { autohide: !error, delay: 6000 }).show();
}
