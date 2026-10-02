/**
 * admin_calendar.js — COMELEC Activities Calendar
 * Renders an interactive month-grid calendar on the admin dashboard.
 * Admins can create and delete events backed by /api/admin/calendar-events/.
 */
(function () {
  "use strict";

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  const gridEl        = document.getElementById("activitiesCalendarGrid");
  const monthLabelEl  = document.getElementById("calMonthLabel");
  const prevBtn       = document.getElementById("calPrevMonth");
  const nextBtn       = document.getElementById("calNextMonth");
  const newEventBtn   = document.getElementById("btnNewCalEvent");

  const dayEventsWrap = document.getElementById("calDayEvents");
  const dayEventsLbl  = document.getElementById("calDayEventsLabel");
  const dayEventsList = document.getElementById("calDayEventsList");
  const dayEventsClose= document.getElementById("calDayEventsClose");

  const modalEl       = document.getElementById("calEventModal");
  const modalErrEl    = document.getElementById("calEventError");
  const typeSelect    = document.getElementById("calEventType");
  const customWrap    = document.getElementById("calCustomTitleWrap");
  const titleInput    = document.getElementById("calEventTitle");
  const dateInput     = document.getElementById("calEventDate");
  const endDateInput  = document.getElementById("calEventEndDate");
  const startTimeInput= document.getElementById("calEventStartTime");
  const endTimeInput  = document.getElementById("calEventEndTime");
  const locationInput = document.getElementById("calEventLocation");
  const descInput     = document.getElementById("calEventDescription");
  const saveBtn       = document.getElementById("btnSaveCalEvent");

  if (!gridEl) return; // not on dashboard page

  /* ── State ────────────────────────────────────────────────────────────── */
  const today    = new Date();
  let curYear    = today.getFullYear();
  let curMonth   = today.getMonth(); // 0-indexed
  let allEvents  = [];               // events for current displayed month
  let selectedKey= null;             // "YYYY-MM-DD" of clicked day
  let modal      = null;

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const pad2 = (n) => String(n).padStart(2, "0");

  const dateKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  /** Group events by their date key (event may span multiple days via end_date) */
  const buildEventMap = (events) => {
    const map = {}; // { "YYYY-MM-DD": [event, ...] }
    events.forEach((ev) => {
      const start = ev.event_date; // "YYYY-MM-DD"
      const end   = ev.end_date || start;
      // Parse as LOCAL date (avoid UTC timezone shift by using year/month/day directly)
      const [sy, sm, sd] = start.split("-").map(Number);
      const [ey, em, ed] = end.split("-").map(Number);
      let cur = new Date(sy, sm - 1, sd);          // local midnight
      const endDate = new Date(ey, em - 1, ed);    // local midnight
      while (cur <= endDate) {
        const k = dateKey(cur.getFullYear(), cur.getMonth(), cur.getDate());
        if (!map[k]) map[k] = [];
        map[k].push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  };

  /* ── API ──────────────────────────────────────────────────────────────── */
  const loadEvents = async () => {
    try {
      const res  = await fetch(
        `/api/admin/calendar-events/?year=${curYear}&month=${curMonth + 1}`,
        { credentials: "same-origin" }
      );
      const data = await res.json().catch(() => ({}));
      allEvents  = (data.ok && Array.isArray(data.events)) ? data.events : [];
    } catch (_) {
      allEvents = [];
    }
    renderGrid();
    if (selectedKey) showDayEvents(selectedKey);
  };

  const createEvent = async (payload) => {
    const res  = await fetch("/api/admin/calendar-events/", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save event.");
    return data.event;
  };

  const deleteEvent = async (eventId) => {
    const res  = await fetch(`/api/admin/calendar-events/${eventId}/`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "Failed to delete event.");
  };

  /* ── Grid renderer ────────────────────────────────────────────────────── */
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const renderGrid = () => {
    if (!gridEl || !monthLabelEl) return;

    const firstDay  = new Date(curYear, curMonth, 1);
    const daysCount = new Date(curYear, curMonth + 1, 0).getDate();
    const startDow  = firstDay.getDay(); // 0=Sun
    const monthName = firstDay.toLocaleString(undefined, { month: "long", year: "numeric" });
    monthLabelEl.textContent = monthName;

    const eventMap = buildEventMap(allEvents);

    let html = '<table><thead><tr>';
    DAYS.forEach((d) => { html += `<th>${d}</th>`; });
    html += '</tr></thead><tbody>';

    let dayNum = 1;
    for (let row = 0; row < 6; row++) {
      html += '<tr>';
      for (let col = 0; col < 7; col++) {
        const cellIdx = row * 7 + col;
        if (cellIdx < startDow || dayNum > daysCount) {
          html += '<td></td>';
          continue;
        }
        const k       = dateKey(curYear, curMonth, dayNum);
        const isToday = k === todayKey;
        const isSel   = k === selectedKey;
        const evs     = eventMap[k] || [];
        const hasEvs  = evs.length > 0;

        // Pick dot color: first event's color, or indicator
        const dotColor = hasEvs ? evs[0].color || "#1D4ED8" : null;
        const classes  = [
          "acal-day",
          isToday ? "is-today" : "",
          isSel   ? "is-selected" : "",
        ].filter(Boolean).join(" ");

        const dot = dotColor
          ? `<span class="acal-dot" style="background:${dotColor};"></span>`
          : "";

        html += `<td><span class="${classes}" data-key="${k}" data-day="${dayNum}">${dayNum}${dot}</span></td>`;
        dayNum++;
      }
      html += '</tr>';
      if (dayNum > daysCount) break;
    }
    html += '</tbody></table>';
    gridEl.innerHTML = html;

    // Attach click handlers to day cells
    gridEl.querySelectorAll(".acal-day").forEach((cell) => {
      cell.addEventListener("click", () => {
        const k = cell.dataset.key;
        if (selectedKey === k) {
          // Toggle off
          selectedKey = null;
          hideDayEvents();
          renderGrid();
        } else {
          selectedKey = k;
          renderGrid();
          showDayEvents(k);
        }
      });
    });
  };

  /* ── Day events panel ─────────────────────────────────────────────────── */
  const showDayEvents = (key) => {
    if (!dayEventsWrap) return;
    const eventMap = buildEventMap(allEvents);
    const evs      = eventMap[key] || [];

    const [y, m, d] = key.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    dayEventsLbl.textContent = label;

    if (evs.length === 0) {
      dayEventsList.innerHTML = `<p class="text-muted" style="font-size:12px;margin:0;">No events on this day.</p>`;
    } else {
      const fmtTime = (t) => {
        if (!t) return "";
        const [h, m] = t.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2,"0")} ${ampm}`;
      };
      dayEventsList.innerHTML = evs.map((ev) => {
        const timeStr = ev.start_time
          ? (ev.end_time ? `${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}` : fmtTime(ev.start_time))
          : "";
        const meta = [
          timeStr ? `<i class="bi bi-clock me-1"></i>${timeStr}` : "",
          ev.location ? `<i class="bi bi-geo-alt-fill me-1"></i>${ev.location}` : "",
          ev.end_date && ev.end_date !== ev.event_date ? `Until ${ev.end_date}` : "",
        ].filter(Boolean).join(" &bull; ");

        return `
          <div class="cal-event-chip">
            <span class="cal-event-chip-dot" style="background:${ev.color || "#1D4ED8"};"></span>
            <div class="cal-event-chip-body">
              <div class="cal-event-chip-title">${escHtml(ev.title)}</div>
              ${meta ? `<div class="cal-event-chip-meta">${meta}</div>` : ""}
              ${ev.description ? `<div class="cal-event-chip-meta mt-1">${escHtml(ev.description)}</div>` : ""}
            </div>
            <button class="cal-event-del" data-id="${ev.id}" title="Delete event">
              <i class="bi bi-trash3"></i>
            </button>
          </div>`;
      }).join("");

      // Delete handlers
      dayEventsList.querySelectorAll(".cal-event-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this event?")) return;
          btn.disabled = true;
          try {
            await deleteEvent(Number(btn.dataset.id));
            await loadEvents();
          } catch (e) {
            alert(e.message || "Failed to delete.");
            btn.disabled = false;
          }
        });
      });
    }

    dayEventsWrap.style.display = "block";
  };

  const hideDayEvents = () => {
    if (dayEventsWrap) dayEventsWrap.style.display = "none";
  };

  const escHtml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /* ── Modal ────────────────────────────────────────────────────────────── */
  const openModal = (prefillDate) => {
    if (!modalEl || !window.bootstrap) return;
    modal = modal || window.bootstrap.Modal.getOrCreateInstance(modalEl);

    // Reset form
    if (typeSelect) { typeSelect.value = ""; }
    if (customWrap) { customWrap.classList.add("d-none"); }
    if (titleInput) { titleInput.value = ""; }
    dateInput.value      = prefillDate || todayKey;
    endDateInput.value   = "";
    if (startTimeInput) startTimeInput.value = "";
    if (endTimeInput)   endTimeInput.value   = "";
    locationInput.value  = "";
    descInput.value      = "";
    // Reset color to first option
    const firstColor = modalEl.querySelector('input[name="calColor"]');
    if (firstColor) firstColor.checked = true;
    showModalError("");

    modal.show();
    setTimeout(() => { if (typeSelect) typeSelect.focus(); }, 400);
  };

  const showModalError = (msg) => {
    if (!modalErrEl) return;
    if (msg) {
      modalErrEl.textContent = msg;
      modalErrEl.classList.remove("d-none");
    } else {
      modalErrEl.classList.add("d-none");
      modalErrEl.textContent = "";
    }
  };

  const getSelectedColor = () => {
    const checked = modalEl && modalEl.querySelector('input[name="calColor"]:checked');
    return checked ? checked.value : "#1D4ED8";
  };

  const saveNewEvent = async () => {
    // Resolve title from dropdown or custom input
    const typeVal  = (typeSelect && typeSelect.value) || "";
    const customVal= (titleInput && titleInput.value || "").trim();
    const title    = typeVal === "__custom__" ? customVal : typeVal;

    const evDate    = (dateInput.value || "").trim();
    const endDate   = (endDateInput.value || "").trim() || null;
    const startTime = (startTimeInput && startTimeInput.value || "").trim() || null;
    const endTime   = (endTimeInput   && endTimeInput.value   || "").trim() || null;
    const location  = (locationInput.value || "").trim() || null;
    const desc     = (descInput.value || "").trim() || null;
    const color    = getSelectedColor();

    if (!title) {
      if (typeVal === "__custom__" || !typeVal) {
        showModalError("Please select an activity type.");
        if (typeSelect) typeSelect.focus();
      } else {
        showModalError("Activity title is required.");
      }
      return;
    }
    if (typeVal === "__custom__" && !customVal) {
      showModalError("Please enter a custom activity title.");
      if (titleInput) titleInput.focus();
      return;
    }
    if (!evDate) { showModalError("Start date is required."); dateInput.focus(); return; }
    if (endDate && endDate < evDate) { showModalError("End date cannot be before start date."); endDateInput.focus(); return; }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Saving…';

    try {
      await createEvent({ title, event_date: evDate, end_date: endDate, start_time: startTime, end_time: endTime, description: desc, location, color });
      modal.hide();
      // If we created an event for the currently displayed month, reload
      const evMonth = new Date(evDate + "T00:00:00").getMonth();
      const evYear  = new Date(evDate + "T00:00:00").getFullYear();
      if (evYear === curYear && evMonth === curMonth) {
        selectedKey = evDate;
        await loadEvents();
      }
    } catch (e) {
      showModalError(e.message || "Failed to save event.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Save';
    }
  };

  /* ── Event wiring ─────────────────────────────────────────────────────── */
  // Show/hide custom title field based on dropdown selection
  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      if (!customWrap) return;
      if (typeSelect.value === "__custom__") {
        customWrap.classList.remove("d-none");
        if (titleInput) { titleInput.value = ""; titleInput.focus(); }
      } else {
        customWrap.classList.add("d-none");
        if (titleInput) titleInput.value = "";
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      curMonth--;
      if (curMonth < 0) { curMonth = 11; curYear--; }
      selectedKey = null;
      hideDayEvents();
      loadEvents();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      curMonth++;
      if (curMonth > 11) { curMonth = 0; curYear++; }
      selectedKey = null;
      hideDayEvents();
      loadEvents();
    });
  }

  if (newEventBtn) {
    newEventBtn.addEventListener("click", () => openModal(selectedKey || todayKey));
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => saveNewEvent());
  }

  // Also allow opening modal when clicking "New event" while a day is selected
  // and pre-fill that day's date
  if (modalEl) {
    modalEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement !== saveBtn) {
        e.preventDefault();
        saveNewEvent();
      }
    });
  }

  if (dayEventsClose) {
    dayEventsClose.addEventListener("click", () => {
      selectedKey = null;
      hideDayEvents();
      renderGrid();
    });
  }

  /* ── Bootstrap modal clear on hide ───────────────────────────────────── */
  if (modalEl) {
    modalEl.addEventListener("hidden.bs.modal", () => {
      showModalError("");
    });
  }

  /* ── Init ─────────────────────────────────────────────────────────────── */
  loadEvents();
})();
