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
  let editingEventId = null;

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

  const createEvent = async (payload, eventId = null) => {
    const res  = await fetch(eventId ? `/api/admin/calendar-events/${eventId}/` : "/api/admin/calendar-events/", {
      method: eventId ? "PUT" : "POST",
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

        html += `<td><button type="button" class="${classes}" data-key="${k}" data-day="${dayNum}" aria-label="View events for ${k}" aria-pressed="${isSel}">${dayNum}${dot}</button></td>`;
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
          ? (ev.end_time ? `${fmtTime(ev.start_time)} - ${fmtTime(ev.end_time)}` : fmtTime(ev.start_time))
          : "";
        const meta = [
          timeStr ? `<i class="bi bi-clock me-1"></i>${timeStr}` : "",
          ev.location ? `<i class="bi bi-geo-alt-fill me-1"></i>${escHtml(ev.location)}` : "",
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
            <button type="button" class="cal-event-edit btn btn-sm btn-link p-0" data-id="${ev.id}" title="Edit activity" aria-label="Edit activity"><i class="bi bi-pencil-square"></i></button>
            <button type="button" class="cal-event-del" data-id="${ev.id}" title="Delete event" aria-label="Delete activity">
              <i class="bi bi-trash3"></i>
            </button>
          </div>`;
      }).join("");

      dayEventsList.querySelectorAll(".cal-event-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const event = allEvents.find((ev) => Number(ev.id) === Number(btn.dataset.id));
          if (event) openModal(event.event_date, event);
        });
      });
      // Delete handlers
      dayEventsList.querySelectorAll(".cal-event-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this event?")) return;
          btn.disabled = true;
          try {
            await deleteEvent(Number(btn.dataset.id));
            await loadEvents();
          } catch (e) {
            (window.ElecomToast ? window.ElecomToast.error : window.alert)(e.message || "Failed to delete.");
            btn.disabled = false;
          }
        });
      });
    }

    const wasHidden = dayEventsWrap.hidden;
    dayEventsWrap.hidden = false;
    dayEventsWrap.classList.add("is-open");
    const calendarBody = gridEl.closest(".card-body");
    if (calendarBody) calendarBody.inert = true;
    if (wasHidden) dayEventsClose?.focus({ preventScroll: true });
  };

  const hideDayEvents = () => {
    if (dayEventsWrap) {
      dayEventsWrap.hidden = true;
      dayEventsWrap.classList.remove("is-open");
      const calendarBody = gridEl.closest(".card-body");
      if (calendarBody) calendarBody.inert = false;
    }
  };

  const escHtml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /* ── Modal ────────────────────────────────────────────────────────────── */
  const dateRangeInput = document.getElementById('event_date_range');
  const timeRangeSelect = document.getElementById('event_time_range');
  const customTimes = document.getElementById('eventCustomTimes');
  const datePicker = window.flatpickr ? window.flatpickr(dateRangeInput, {
    mode: 'range', dateFormat: 'Y-m-d', static: false, appendTo: document.body,
    disableMobile: true,
    onReady: (_, __, instance) => instance.calendarContainer.classList.add('event-range-calendar'),
    onChange: (dates, _, instance) => {
      dateInput.value = dates[0] ? instance.formatDate(dates[0], 'Y-m-d') : '';
      endDateInput.value = dates[1] ? instance.formatDate(dates[1], 'Y-m-d') : '';
    },
  }) : null;
  if (!datePicker) {
    dateRangeInput.placeholder = 'YYYY-MM-DD to YYYY-MM-DD';
    dateRangeInput.addEventListener('input', () => {
      const match = dateRangeInput.value.trim().match(/^(\d{4}-\d{2}-\d{2})(?: to (\d{4}-\d{2}-\d{2}))?$/);
      dateInput.value = match ? match[1] : '';
      endDateInput.value = match ? match[2] || '' : '';
    });
  }
  // Allow focus in the body-mounted calendar without Bootstrap redirecting it.
  document.addEventListener('focusin', (event) => {
    if (modalEl.classList.contains('show') && datePicker?.calendarContainer.contains(event.target)) event.stopImmediatePropagation();
  }, true);
  modalEl.addEventListener('hide.bs.modal', () => datePicker?.close());
  modalEl.querySelector('.modal-body').addEventListener('scroll', () => datePicker?.close());
  for (const input of [startTimeInput, endTimeInput]) {
    input.add(new Option('Not specified', ''));
    for (let minute = 0; minute < 1440; minute += 15) {
      const hour = Math.floor(minute / 60), mins = String(minute % 60).padStart(2, '0');
      input.add(new Option(`${hour % 12 || 12}:${mins} ${hour < 12 ? 'AM' : 'PM'}`, `${String(hour).padStart(2, '0')}:${mins}`));
    }
  }
  const selectTimeValue = (input, value) => {
    if (value && !Array.from(input.options).some((option) => option.value === value)) input.add(new Option(value, value));
    input.value = value;
  };
  const syncTimeRange = () => {
    const start = startTimeInput.value, end = endTimeInput.value;
    const preset = `${start}|${end}`;
    timeRangeSelect.value = !start && !end ? 'all_day' : ['08:00|12:00', '13:00|17:00'].includes(preset) ? preset : 'custom';
    customTimes.classList.toggle('d-none', timeRangeSelect.value !== 'custom');
  };
  timeRangeSelect.addEventListener('change', () => {
    const custom = timeRangeSelect.value === 'custom';
    customTimes.classList.toggle('d-none', !custom);
    if (!custom) {
      const [start = '', end = ''] = timeRangeSelect.value === 'all_day' ? [] : timeRangeSelect.value.split('|');
      startTimeInput.value = start; endTimeInput.value = end;
    }
  });

  const activityToggle = document.getElementById('activityTypeToggle');
  const activityMenu = document.getElementById('activityTypeMenu');
  const activitySearch = document.getElementById('activityTypeSearch');
  const activityResults = document.getElementById('activityTypeResults');
  const syncActivityLabel = () => {
    activityToggle.textContent = typeSelect.selectedOptions[0]?.textContent || 'Select activity';
  };
  const closeActivityMenu = (restoreFocus = false) => {
    activityMenu.hidden = true;
    activityToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) activityToggle.focus();
  };
  const positionActivityMenu = () => {
    const field = activityToggle.getBoundingClientRect();
    const card = modalEl.querySelector('.modal-content').getBoundingClientRect();
    const header = modalEl.querySelector('.modal-header').getBoundingClientRect();
    const footer = modalEl.querySelector('.modal-footer').getBoundingClientRect();
    const below = Math.max(0, Math.min(footer.top, window.innerHeight - 8) - field.bottom - 8);
    const above = Math.max(0, field.top - Math.max(header.bottom, 8) - 8);
    const useBelow = below >= Math.min(280, above);
    const space = useBelow ? below : above;
    const height = Math.min(280, space);
    activityMenu.style.width = `${Math.min(field.width, card.width - 16)}px`;
    activityMenu.style.left = `${Math.max(card.left + 8, Math.min(field.left, card.right - field.width - 8))}px`;
    activityResults.style.maxHeight = `${Math.max(0, Math.min(220, height - 60))}px`;
    activityMenu.style.top = `${useBelow ? field.bottom + 4 : field.top - height - 4}px`;
  };
  const renderActivityChoices = () => {
    activityResults.replaceChildren();
    const query = activitySearch.value.trim().toLowerCase();
    let lastGroup = '';
    for (const option of Array.from(typeSelect.options)) {
      if (!option.value || !option.textContent.toLowerCase().includes(query)) continue;
      const group = option.parentElement.label || '';
      if (group && group !== lastGroup) {
        const heading = document.createElement('div');
        heading.className = 'activity-type-group'; heading.textContent = group;
        activityResults.appendChild(heading); lastGroup = group;
      }
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'activity-type-option';
      button.textContent = option.textContent;
      button.classList.toggle('active', option.value === typeSelect.value);
      button.setAttribute('aria-pressed', String(option.value === typeSelect.value));
      button.addEventListener('click', () => {
        typeSelect.value = option.value;
        closeActivityMenu(true); syncActivityLabel();
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      activityResults.appendChild(button);
    }
    if (!activityResults.children.length) {
      const empty = document.createElement('p'); empty.className = 'activity-type-empty';
      empty.textContent = 'No matching activities.'; empty.setAttribute('role', 'status');
      activityResults.appendChild(empty);
    }
    positionActivityMenu();
  };
  activityToggle.addEventListener('click', () => {
    if (!activityMenu.hidden) { closeActivityMenu(); return; }
    datePicker?.close(); activitySearch.value = ''; activityMenu.hidden = false;
    activityToggle.setAttribute('aria-expanded', 'true');
    renderActivityChoices(); activitySearch.focus();
  });
  activitySearch.addEventListener('input', renderActivityChoices);
  activityMenu.addEventListener('keydown', (event) => {
    const buttons = Array.from(activityResults.querySelectorAll('button'));
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeActivityMenu(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? index + 1 : index < 0 ? buttons.length - 1 : index - 1;
      (buttons[next] || activitySearch).focus();
    } else if (event.key === 'Enter' && event.target === activitySearch && buttons[0]) {
      event.preventDefault(); buttons[0].click();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!activityMenu.contains(event.target) && !activityToggle.contains(event.target)) closeActivityMenu();
  });
  modalEl.addEventListener('hide.bs.modal', () => closeActivityMenu());
  modalEl.querySelector('.modal-body').addEventListener('scroll', () => closeActivityMenu());
  window.addEventListener('resize', () => closeActivityMenu());
  typeSelect.addEventListener('change', syncActivityLabel);

  const syncColorSelection = () => {
    if (!modalEl) return;
    modalEl.querySelectorAll('.cal-color-opt').forEach((swatch) => {
      const selected = swatch.querySelector('input[name="calColor"]').checked;
      swatch.classList.toggle('active', selected);
      const dot = swatch.querySelector('span');
      dot.querySelectorAll('.cal-color-check').forEach((icon) => icon.remove());
      if (selected) {
        const icon = document.createElement('i');
        icon.className = 'bi bi-check cal-color-check';
        icon.setAttribute('aria-hidden', 'true');
        dot.appendChild(icon);
      }
    });
  };
  modalEl?.addEventListener('change', (event) => {
    if (event.target.matches('input[name="calColor"]')) syncColorSelection();
  });
  const openModal = (prefillDate, event = null) => {
    if (saveBtn.disabled) return;
    editingEventId = event ? event.id : null;
    if (!modalEl || !window.bootstrap) return;
    modal = modal || window.bootstrap.Modal.getOrCreateInstance(modalEl);

    modalEl.querySelectorAll("[data-original-color]").forEach((input) => input.remove());
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

    modalEl.querySelector(".modal-title").textContent = event ? "Edit activity" : "New event";
    if (event) {
      const known = Array.from(typeSelect.options).some((option) => option.value === event.title);
      typeSelect.value = known ? event.title : "__custom__";
      customWrap.classList.toggle("d-none", known);
      titleInput.value = event.title;
      dateInput.value = event.event_date;
      endDateInput.value = event.end_date || "";
      selectTimeValue(startTimeInput, (event.start_time || "").slice(0, 5));
      selectTimeValue(endTimeInput, (event.end_time || "").slice(0, 5));
      locationInput.value = event.location || "";
      descInput.value = event.description || "";
      const colors = Array.from(modalEl.querySelectorAll('input[name="calColor"]'));
      let match = colors.find((input) => input.value.toLowerCase() === (event.color || "").toLowerCase());
      if (!match && event.color) {
        match = document.createElement("input");
        match.type = "radio"; match.name = "calColor"; match.value = event.color;
        match.hidden = true; match.dataset.originalColor = "true";
        modalEl.appendChild(match);
      }
      if (match) match.checked = true;
    }
    if (datePicker) datePicker.setDate([dateInput.value, endDateInput.value].filter(Boolean), false);
    else dateRangeInput.value = [dateInput.value, endDateInput.value].filter(Boolean).join(' to ');
    closeActivityMenu();
    syncActivityLabel();
    syncTimeRange();
    syncColorSelection();
    modal.show();
    setTimeout(() => { if (activityToggle) activityToggle.focus(); }, 400);
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
    if (saveBtn.disabled) return;
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
        if (activityToggle) activityToggle.focus();
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
    if (!evDate) { showModalError("Start date is required."); dateRangeInput.focus(); return; }
    if (endDate && endDate < evDate) { showModalError("End date cannot be before start date."); dateRangeInput.focus(); return; }

    if (startTime && endTime && (!endDate || endDate === evDate) && endTime <= startTime) {
      showModalError("End time must be after start time for a single-day event."); endTimeInput.focus(); return;
    }
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Saving...';

    try {
      await createEvent({ title, event_date: evDate, end_date: endDate, start_time: startTime, end_time: endTime, description: desc, location, color }, editingEventId);
      modal.hide();
      const savedDate = new Date(evDate + "T00:00:00");
      curMonth = savedDate.getMonth();
      curYear = savedDate.getFullYear();
      selectedKey = evDate;
      await loadEvents();
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
    const closeDayEvents = () => {
      const key = selectedKey;
      selectedKey = null;
      hideDayEvents();
      renderGrid();
      if (key) gridEl.querySelector(`[data-key="${key}"]`)?.focus({ preventScroll: true });
    };
    dayEventsClose.addEventListener("click", closeDayEvents);
    dayEventsWrap?.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modalEl.classList.contains("show")) {
        event.preventDefault();
        closeDayEvents();
      }
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
