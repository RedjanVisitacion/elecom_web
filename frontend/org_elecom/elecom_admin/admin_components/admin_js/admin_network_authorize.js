const API_BASE_URL = "/api";
let detectedRequestIp = "";
let restrictionEnabled = false;
let accessLogs = [];
let logPage = 1;
const LOG_PAGE_SIZE = 10;

function initNetworkAuthorizePage() {
  initSidebar();
  setupEventListeners();
  loadNetworkSettings();
  loadAccessLogs();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNetworkAuthorizePage);
} else {
  initNetworkAuthorizePage();
}

function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");
  const closeBtn = document.getElementById("closeSidebar");

  const closeSidebar = () => {
    sidebar?.classList.remove("active");
    overlay?.classList.remove("active");
  };

  menuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("active");
    overlay?.classList.toggle("active");
  });
  closeBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 992) closeSidebar();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 992) closeSidebar();
  });
}

function setupEventListeners() {
  document.getElementById("enableNetworkRestriction")?.addEventListener("change", updateRestriction);
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
    const toggle = document.getElementById("enableNetworkRestriction");
    toggle.checked = restrictionEnabled; toggle.disabled = false;
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

async function updateRestriction() {
  const toggle = document.getElementById("enableNetworkRestriction");
  const enabled = toggle.checked;
  toggle.disabled = true;
  document.getElementById("btnAddNetwork").disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/admin/network-settings/`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_enabled', enabled }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to update network restriction.');
    restrictionEnabled = data.enabled === true;
    toggle.checked = restrictionEnabled;
    showNotification(restrictionEnabled ? 'Network restriction enabled.' : 'Network restriction disabled.', 'success');
    await loadNetworkSettings();
  } catch (error) {
    toggle.checked = restrictionEnabled;
    showNotification(error.message, 'error');
  } finally { toggle.disabled = false; document.getElementById("btnAddNetwork").disabled = false; }
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
        enabled: true,
        network_ip: networkIp,
        ssid,
        status: "Active",
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
    const status = network.status || "Active";
    const statusClass = status.toLowerCase() === "active" ? "status-text-active" : "status-text-disabled";

    return `
      <tr>
        <td>${escapeHtml(formatDate(network.created_at || network.updated_at))}</td>
        <td>${escapeHtml(network.network_ip || "")}</td>
        <td>${escapeHtml(network.ssid || "N/A")}</td>
        <td><span class="${statusClass}">${escapeHtml(status)}</span></td>
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

async function loadAccessLogs() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/network-logs/`, {
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.ok) {
      accessLogs = data.logs || [];
      renderAccessLogs();
    } else {
      throw new Error(data.error || "Failed to load network access logs.");
    }
  } catch (error) {
    showNotification(error.message || "Failed to load network access logs.", "error");
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
  let container = document.getElementById("notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-container";
    container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999;";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `alert alert-${type === "success" ? "success" : type === "error" ? "danger" : "info"} alert-dismissible fade show`;
  toast.innerHTML = `
    ${escapeHtml(message)}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
