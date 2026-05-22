const API_BASE_URL = "/api";
let detectedRequestIp = "";

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
    sidebar?.classList.remove("show");
    overlay?.classList.remove("show");
  };

  menuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("show");
    overlay?.classList.toggle("show");
  });
  closeBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);
}

function setupEventListeners() {
  const addBtn = document.getElementById("addNetworkBtn");
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
  const addBtn = document.getElementById("addNetworkBtn");
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
    addBtn.textContent = "Add";
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
      renderAccessLogs(data.logs || []);
    }
  } catch (error) {
    console.error("Error loading access logs:", error);
  }
}

function renderAccessLogs(logs) {
  const tbody = document.getElementById("accessLogsBody");
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">No access attempts recorded</td>
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
