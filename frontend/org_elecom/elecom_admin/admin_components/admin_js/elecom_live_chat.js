/**
 * elecom_live_chat.js
 * Admin Live Chat – Messenger-style support inbox.
 *
 * Polls /api/admin/chat/conversations/ every 8 s to refresh the left pane.
 * When a conversation is open it polls /api/admin/chat/thread/ every 4 s.
 * Admin replies go to POST /api/admin/chat/reply/.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Sidebar / mobile menu ─────────────────────────────────────────────────
  const menuToggle    = document.getElementById('menuToggle');
  const sidebar       = document.getElementById('sidebar');
  const sidebarOverlay= document.getElementById('sidebarOverlay');
  const closeSidebar  = document.getElementById('closeSidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => { sidebar.classList.add('active'); sidebarOverlay?.classList.add('active'); });
  }
  if (closeSidebar) {
    closeSidebar.addEventListener('click', () => { sidebar.classList.remove('active'); sidebarOverlay?.classList.remove('active'); });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
      sidebar?.classList.remove('active');
      sidebarOverlay?.classList.remove('active');
    }
  });

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const convListEl      = document.getElementById('convList');
  const convSearchEl    = document.getElementById('convSearch');
  const threadEmpty     = document.getElementById('threadEmpty');
  const activeThread    = document.getElementById('activeThread');
  const chatMessagesEl  = document.getElementById('chatMessages');
  const replyInput      = document.getElementById('replyInput');
  const sendBtn         = document.getElementById('sendBtn');
  const threadAvatar    = document.getElementById('threadAvatar');
  const threadNameEl    = document.getElementById('threadName');
  const threadStudentId = document.getElementById('threadStudentId');
  const takeoverBadge   = document.getElementById('takeoverBadge');
  const takeoverBtn     = document.getElementById('takeoverBtn');
  const takeoverBanner  = document.getElementById('takeoverBanner');

  // ── State ─────────────────────────────────────────────────────────────────
  let conversations   = [];
  let activeStudentId = null;
  let lastMsgId       = null;
  let convPollTimer   = null;
  let threadPollTimer = null;
  let sending         = false;
  let takeoverBusy    = false;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const esc = (s) =>
    String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function relativeTime(isoStr) {
    if (!isoStr) return '';
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(isoStr).toLocaleDateString();
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
  }

  // Returns either an <img> avatar or an initials div, depending on photo availability.
  function avatarHtml(name, photoUrl, extraClass = '') {
    const cls = `chat-conv-avatar${extraClass ? ' ' + extraClass : ''}`;
    if (photoUrl) {
      return `<img class="${cls} chat-conv-avatar-img" src="${esc(photoUrl)}"
                   alt="${esc(initials(name))}"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <div class="${cls}" style="display:none;">${esc(initials(name))}</div>`;
    }
    return `<div class="${cls}">${esc(initials(name))}</div>`;
  }

  function scrollToBottom() {
    if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  // ── Sync takeover button + banner + badge to a conversation's state ───────
  function updateTakeoverUI(conv) {
    if (!conv) return;
    const active = !!conv.takeover_active;

    // Header badge
    if (takeoverBadge) {
      takeoverBadge.style.display = active ? '' : 'none';
    }

    // Banner above the message feed
    if (takeoverBanner) {
      takeoverBanner.style.display = active ? '' : 'none';
    }

    // Toggle button label
    if (takeoverBtn) {
      if (active) {
        takeoverBtn.innerHTML = '<i class="bi bi-robot me-1"></i>Release to EleVote';
        takeoverBtn.classList.remove('btn-takeover-take');
        takeoverBtn.classList.add('btn-takeover-release');
        takeoverBtn.title = 'Hand conversation back to EleVote AI';
      } else {
        takeoverBtn.innerHTML = '<i class="bi bi-person-check me-1"></i>Take Over';
        takeoverBtn.classList.remove('btn-takeover-release');
        takeoverBtn.classList.add('btn-takeover-take');
        takeoverBtn.title = 'Suppress EleVote AI and reply as Admin';
      }
    }
  }

  // ── Toggle admin takeover for the active conversation ─────────────────────
  async function setTakeover(active) {
    if (takeoverBusy || !activeStudentId) return;
    takeoverBusy = true;
    if (takeoverBtn) takeoverBtn.disabled = true;

    try {
      const res  = await fetch('/api/admin/chat/takeover/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: activeStudentId, active }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        // Update local conversations state immediately (no need to wait for poll)
        const conv = conversations.find(c => c.student_id === activeStudentId);
        if (conv) {
          conv.takeover_active = data.takeover_active;
          updateTakeoverUI(conv);
          renderConvList();
        }
      } else {
        alert(data.error || 'Could not update takeover state.');
      }
    } catch (_) {
      alert('Network error. Please try again.');
    } finally {
      takeoverBusy = false;
      if (takeoverBtn) takeoverBtn.disabled = false;
    }
  }

  // ── Render conversations list ─────────────────────────────────────────────
  function renderConvList() {
    const q = (convSearchEl?.value || '').toLowerCase();
    const filtered = q
      ? conversations.filter(c =>
          c.display_name.toLowerCase().includes(q) || c.student_id.toLowerCase().includes(q))
      : conversations;

    if (!filtered.length) {
      convListEl.innerHTML = `
        <div class="chat-list-empty">
          <i class="bi bi-inbox d-block mb-2" style="font-size:1.8rem;"></i>
          ${q ? 'No matching conversations.' : 'No chat conversations yet.'}
        </div>`;
      return;
    }

    convListEl.innerHTML = filtered.map(c => {
      const isActive = c.student_id === activeStudentId;
      const unread   = c.unread_count > 0 ? `<span class="chat-conv-unread">${c.unread_count}</span>` : '';
      const roleIcon = c.last_role === 'admin' ? '↩ ' : c.last_role === 'assistant' ? 'EleVote: ' : '';
      return `
        <div class="chat-conv-item${isActive ? ' active' : ''}" data-id="${esc(c.student_id)}">
          <div class="chat-conv-avatar-wrap">${avatarHtml(c.display_name, c.photo_url)}</div>
          <div class="overflow-hidden flex-grow-1">
            <div class="chat-conv-name">${esc(c.display_name)}</div>
            <div class="chat-conv-snippet">${roleIcon}${esc(c.last_message || '…')}</div>
          </div>
          <div class="d-flex flex-column align-items-end gap-1 flex-shrink-0">
            <span class="chat-conv-time">${relativeTime(c.last_activity)}</span>
            ${unread}
          </div>
        </div>`;
    }).join('');
  }

  // ── Load conversations (poll) ─────────────────────────────────────────────
  async function loadConversations() {
    try {
      const res  = await fetch('/api/admin/chat/conversations/', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        conversations = data.conversations || [];
        renderConvList();
        // Keep takeover UI in sync after each poll
        if (activeStudentId) {
          const conv = conversations.find(c => c.student_id === activeStudentId);
          if (conv) updateTakeoverUI(conv);
        }
      } else if (res.status === 403) {
        convListEl.innerHTML = `
          <div class="chat-list-empty text-danger">
            <i class="bi bi-lock d-block mb-2" style="font-size:1.8rem;"></i>
            Session expired. Please <a href="/static/org_elecom/elecom_admin/admin_dashboard.html">log in again</a>.
          </div>`;
        clearInterval(convPollTimer);
      } else {
        convListEl.innerHTML = `
          <div class="chat-list-empty text-warning">
            <i class="bi bi-exclamation-triangle d-block mb-2" style="font-size:1.8rem;"></i>
            ${esc(data.error || 'Could not load conversations.')}
          </div>`;
      }
    } catch (_) {
      convListEl.innerHTML = `
        <div class="chat-list-empty text-muted">
          <i class="bi bi-wifi-off d-block mb-2" style="font-size:1.8rem;"></i>
          Network error. Retrying…
        </div>`;
    }
  }

  // ── Render a single message bubble ───────────────────────────────────────
  function msgBubble(msg) {
    const role    = msg.role; // user | assistant | admin
    const wrapCls = role === 'admin' ? 'admin-wrap' : role === 'assistant' ? 'bot-wrap' : 'user-wrap';
    const bubCls  = role === 'admin' ? 'admin-bubble' : role === 'assistant' ? 'bot-bubble' : 'user-bubble';
    const label   = role === 'admin' ? 'Admin' : role === 'assistant' ? 'EleVote' : 'Voter';
    const metaCls = role === 'admin' ? 'admin-meta' : '';

    // Build avatar — real photo for user, EleVote wordmark for assistant, badge for admin
    let avatar;
    if (role === 'user') {
      const conv     = conversations.find(c => c.student_id === activeStudentId);
      const photoUrl = conv?.photo_url;
      const name     = conv?.display_name || activeStudentId || '?';
      if (photoUrl) {
        avatar = `<div class="chat-role-avatar user-av msg-photo-av" style="padding:0;overflow:hidden;">
                    <img src="${esc(photoUrl)}" alt="${esc(initials(name))}"
                         style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"
                         onerror="this.parentElement.innerHTML='${esc(initials(name))}';this.parentElement.style.padding='';">
                  </div>`;
      } else {
        avatar = `<div class="chat-role-avatar user-av">${esc(initials(name))}</div>`;
      }
    } else if (role === 'assistant') {
      avatar = `<div class="chat-role-avatar bot-av elevote-av" title="EleVote AI">
                  <span style="font-size:.55rem;font-weight:800;letter-spacing:-.5px;line-height:1;">EV</span>
                </div>`;
    } else {
      // admin
      avatar = `<div class="chat-role-avatar admin-av" title="Admin">
                  <i class="bi bi-person-badge-fill"></i>
                </div>`;
    }

    const bubble = `
      <div>
        <div class="chat-bubble ${bubCls}">${esc(msg.content)}</div>
        <div class="chat-bubble-meta ${metaCls}">${label} · ${formatTime(msg.created_at)}</div>
      </div>`;

    return `
      <div class="chat-bubble-wrap ${wrapCls}">
        ${role !== 'admin' ? avatar + bubble : bubble + avatar}
      </div>`;
  }

  // ── Load thread for active conversation ───────────────────────────────────
  async function loadThread(studentId, append = false) {
    const url = new URL('/api/admin/chat/thread/', window.location.origin);
    url.searchParams.set('student_id', studentId);
    if (append && lastMsgId) url.searchParams.set('since_id', lastMsgId);

    try {
      const res  = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) return;

      const msgs = data.messages || [];
      if (!msgs.length) return;

      // Update lastMsgId
      lastMsgId = msgs[msgs.length - 1].id;

      if (append) {
        msgs.forEach(m => {
          const div = document.createElement('div');
          div.innerHTML = msgBubble(m);
          chatMessagesEl.appendChild(div.firstElementChild);
        });
      } else {
        chatMessagesEl.innerHTML = msgs.map(msgBubble).join('');
      }
      scrollToBottom();

      // Sync takeover badge/banner/button from conversations state
      const conv = conversations.find(c => c.student_id === activeStudentId);
      if (conv) updateTakeoverUI(conv);

    } catch (_) {}
  }

  // ── Open a conversation ───────────────────────────────────────────────────
  function openConversation(studentId) {
    if (activeStudentId === studentId) return;

    activeStudentId = studentId;
    lastMsgId       = null;

    // Update list highlight
    renderConvList();

    // Show thread pane
    if (threadEmpty)  threadEmpty.style.display  = 'none';
    if (activeThread) { activeThread.style.display = 'flex'; }

    // Set header
    const conv = conversations.find(c => c.student_id === studentId);
    if (conv) {
      threadNameEl.textContent    = conv.display_name;
      threadStudentId.textContent = `ID: ${conv.student_id}`;
      // Photo or initials in thread header avatar
      if (conv.photo_url) {
        threadAvatar.innerHTML = '';
        threadAvatar.style.padding = '0';
        threadAvatar.style.overflow = 'hidden';
        const img = document.createElement('img');
        img.src   = conv.photo_url;
        img.alt   = initials(conv.display_name);
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        img.onerror = () => {
          threadAvatar.innerHTML = esc(initials(conv.display_name));
          threadAvatar.style.padding = '';
          threadAvatar.style.overflow = '';
        };
        threadAvatar.appendChild(img);
      } else {
        threadAvatar.innerHTML  = '';
        threadAvatar.textContent = initials(conv.display_name);
        threadAvatar.style.padding  = '';
        threadAvatar.style.overflow = '';
      }
    }

    // Enable input
    replyInput.disabled = false;
    replyInput.value    = '';
    sendBtn.disabled    = true;

    // Sync takeover UI immediately from known conversation state
    updateTakeoverUI(conv || {});

    // Clear messages and load fresh
    chatMessagesEl.innerHTML = '<div class="text-center text-muted py-4" style="font-size:.82rem;">Loading…</div>';
    loadThread(studentId, false);

    // Start thread polling
    clearInterval(threadPollTimer);
    threadPollTimer = setInterval(() => {
      if (activeStudentId) loadThread(activeStudentId, true);
    }, 4000);
  }

  // ── Send admin reply ──────────────────────────────────────────────────────
  async function sendReply() {
    if (sending || !activeStudentId) return;
    const content = (replyInput.value || '').trim();
    if (!content) return;

    sending = true;
    sendBtn.disabled = true;
    replyInput.disabled = true;

    try {
      const res = await fetch('/api/admin/chat/reply/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: activeStudentId, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.message) {
        replyInput.value = '';
        // Append the new message immediately
        const div = document.createElement('div');
        div.innerHTML = msgBubble(data.message);
        chatMessagesEl.appendChild(div.firstElementChild);
        lastMsgId = data.message.id;
        scrollToBottom();
        // Refresh conversation list snippet
        loadConversations();
      } else {
        alert(data.error || 'Failed to send message.');
      }
    } catch (_) {
      alert('Network error. Please try again.');
    } finally {
      sending = false;
      replyInput.disabled = false;
      replyInput.focus();
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  convListEl?.addEventListener('click', (e) => {
    const item = e.target.closest('.chat-conv-item[data-id]');
    if (item) openConversation(item.getAttribute('data-id'));
  });

  convSearchEl?.addEventListener('input', renderConvList);

  replyInput?.addEventListener('input', () => {
    // Auto-grow
    replyInput.style.height = 'auto';
    replyInput.style.height = Math.min(replyInput.scrollHeight, 120) + 'px';
    sendBtn.disabled = !replyInput.value.trim();
  });

  replyInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendReply();
    }
  });

  sendBtn?.addEventListener('click', sendReply);

  takeoverBtn?.addEventListener('click', () => {
    const conv = conversations.find(c => c.student_id === activeStudentId);
    const currentlyActive = conv?.takeover_active ?? false;
    setTakeover(!currentlyActive);
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  loadConversations();
  convPollTimer = setInterval(loadConversations, 8000);

});
