const API_BASE_URL = '/api';

// State
let currentSettings = {
    enabled: false,
    admin_ip: null,
    allowed_prefix: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    loadNetworkSettings();
    setupEventListeners();
    loadAccessLogs();
});

// Sidebar toggle
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('toggleSidebar');
    const closeBtn = document.getElementById('closeSidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    const toggle = document.getElementById('networkAuthToggle');
    const saveBtn = document.getElementById('saveBtn');
    const refreshBtn = document.getElementById('refreshIpBtn');

    toggle.addEventListener('change', (e) => {
        currentSettings.enabled = e.target.checked;
        updateUI();
        saveBtn.disabled = false;
    });

    saveBtn.addEventListener('click', saveSettings);
    refreshBtn.addEventListener('click', loadNetworkSettings);

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        fetch('/api/auth/logout/', { method: 'POST' })
            .then(() => window.location.href = '/static/org_elecom/elecom_public/index.html');
    });
}

// Load network settings
async function loadNetworkSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/network-settings/`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load settings');
        
        const data = await response.json();
        
        if (data.ok) {
            currentSettings = {
                enabled: data.enabled || false,
                admin_ip: data.admin_ip || null,
                allowed_prefix: data.allowed_prefix || null
            };
            
            document.getElementById('networkAuthToggle').checked = currentSettings.enabled;
            updateUI();
        }
    } catch (error) {
        console.error('Error loading network settings:', error);
        showNotification('Error loading network settings', 'error');
    }
}

// Update UI based on current settings
function updateUI() {
    const statusBadge = document.getElementById('statusBadge');
    const adminIpDisplay = document.getElementById('adminIp');
    const allowedNetworkDisplay = document.getElementById('allowedNetwork');
    
    // Update status badge
    if (currentSettings.enabled) {
        statusBadge.className = 'status-badge status-enabled';
        statusBadge.innerHTML = '<i class="bi bi-check-circle"></i> Enabled';
    } else {
        statusBadge.className = 'status-badge status-disabled';
        statusBadge.innerHTML = '<i class="bi bi-x-circle"></i> Disabled';
    }
    
    // Update IP displays
    if (currentSettings.admin_ip) {
        adminIpDisplay.textContent = currentSettings.admin_ip;
    } else {
        adminIpDisplay.innerHTML = '<span class="text-muted">Unable to detect IP</span>';
    }
    
    if (currentSettings.allowed_prefix) {
        allowedNetworkDisplay.textContent = currentSettings.allowed_prefix + '.xxx.xxx (/' + getCidrFromPrefix(currentSettings.allowed_prefix) + ')';
    } else if (currentSettings.admin_ip) {
        // Extract prefix from admin IP (first 3 octets for /24)
        const prefix = currentSettings.admin_ip.split('.').slice(0, 3).join('.');
        allowedNetworkDisplay.textContent = prefix + '.xxx (/24)';
    } else {
        allowedNetworkDisplay.innerHTML = '<span class="text-muted">Not configured</span>';
    }
}

// Save settings
async function saveSettings() {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/network-settings/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                enabled: currentSettings.enabled
            })
        });
        
        if (!response.ok) throw new Error('Failed to save settings');
        
        const data = await response.json();
        
        if (data.ok) {
            showNotification('Network settings saved successfully', 'success');
            // Refresh to get updated IP/prefix
            loadNetworkSettings();
        } else {
            throw new Error(data.error || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Save Settings';
    }
}

// Load access logs
async function loadAccessLogs() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/network-logs/`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load logs');
        
        const data = await response.json();
        
        if (data.ok && data.logs) {
            renderAccessLogs(data.logs);
        }
    } catch (error) {
        console.error('Error loading access logs:', error);
    }
}

// Render access logs
function renderAccessLogs(logs) {
    const tbody = document.getElementById('accessLogsBody');
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-4">
                    No access attempts recorded
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${log.student_id || 'N/A'}</td>
            <td><code>${log.ip_address}</code></td>
            <td>
                <span class="badge ${log.allowed ? 'bg-success' : 'bg-danger'}">
                    ${log.allowed ? 'Allowed' : 'Blocked'}
                </span>
            </td>
        </tr>
    `).join('');
}

// Helper: Format date time
function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper: Get CIDR from IP prefix
function getCidrFromPrefix(prefix) {
    // Assuming /24 for now (first 3 octets)
    return 24;
}

// Show notification
function showNotification(message, type = 'info') {
    // Check if notification container exists
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}
