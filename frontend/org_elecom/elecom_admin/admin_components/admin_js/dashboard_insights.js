/* Reported hourly turnout only: withheld counts stay gaps, never synthetic activity. */
(() => {
  let chart = null;
  const clock = iso => new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
  const timestamp = iso => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const render = data => {
    const canvas = document.getElementById("turnoutLineChart");
    const plot = document.getElementById("turnoutPlot");
    const empty = document.getElementById("turnoutEmpty");
    const caption = document.getElementById("turnoutLineCaption");
    const turnout = data.turnout;
    const start = Date.parse(data.election?.start_at), end = Date.parse(data.election?.end_at);
    const hourly = (Array.isArray(turnout?.hourly) ? turnout.hourly : []).filter(item => {
      if (!item || typeof item !== "object") return false;
      const hour = Date.parse(item.hour);
      return Number.isFinite(hour) && (!Number.isFinite(start) || hour + 3600000 > start) && (!Number.isFinite(end) || hour < end);
    });
    const values = hourly.map(item => {
      if (item.withheld || !["number", "string"].includes(typeof item.count) || String(item.count).trim() === "") return null;
      const count = Number(item.count);
      return Number.isFinite(count) && count >= 0 ? count : null;
    });
    const historical = turnout?.scope === "historical";
    const labels = hourly.map(item => historical ? timestamp(item.hour) : clock(item.hour));
    const peak = values.reduce((highest, count) => Math.max(highest, count || 0), 0);
    // The API zero-fills hours without matching ballot rows. A zero-only
    // response is not evidence of a recorded trend. Preserve real zeroes
    // beside positive observations, and keep withheld values as gaps.
    const hasWithheld = hourly.some(item => item.withheld);
    const canPlot = peak > 0 && !!window.Chart;
    const state = document.getElementById("turnoutActivityState");
    if (state) state.textContent = canPlot ? (hasWithheld ? "Some hours withheld" : "Reported hours") : hasWithheld ? "Privacy protected" : "Unavailable";
    if (plot) plot.hidden = !canPlot;
    if (empty) empty.hidden = canPlot;
    if (canPlot && canvas) {
      if (!chart) chart = new Chart(canvas, {
        type: "line",
        data: { labels, datasets: [{ label: "Votes cast per hour", data: values,
          borderColor: "#0A2463", borderWidth: 2.5,
          backgroundColor: context => {
            const area = context.chart.chartArea;
            if (!area) return "rgba(10,36,99,0)";
            const fade = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            fade.addColorStop(0, "rgba(10,36,99,0.08)");
            fade.addColorStop(1, "rgba(10,36,99,0)");
            return fade;
          }, fill: true, tension: 0,
          pointRadius: 2, pointBackgroundColor: "#0A2463", pointBorderWidth: 0,
          pointHoverRadius: 4, pointHitRadius: 12, spanGaps: false,
        }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          layout: { padding: { top: 6, right: 8, bottom: 0, left: 0 } },
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: {
            backgroundColor: "#0F172A", cornerRadius: 4, padding: 8,
            titleFont: { family: "JetBrains Mono" }, bodyFont: { family: "JetBrains Mono" },
            filter: item => Number.isFinite(item.parsed.y),
            callbacks: {
              title: items => timestamp(chart.$hourly[items[0].dataIndex].hour),
              label: item => `${item.parsed.y.toLocaleString()} votes cast in this hour`,
            },
          } },
          scales: {
            x: { border: { display: false }, grid: { display: false, drawTicks: false },
              ticks: { autoSkip: true, padding: 6, maxTicksLimit: 5, minRotation: 0, maxRotation: 0, color: "#64748B", font: { family: "JetBrains Mono", size: 11, weight: "500" } },
              title: { display: true, text: "Election hours - Philippine time", color: "#64748B", font: { family: "JetBrains Mono", size: 11 } },
            },
            y: { beginAtZero: true, min: 0, max: Math.max(1, Math.ceil(peak * 1.15)), border: { display: false }, grid: { display: false, drawTicks: false },
              ticks: { maxTicksLimit: 5, padding: 6, precision: 0, color: "#64748B", font: { family: "JetBrains Mono", size: 11, weight: "500" } },
              title: { display: true, text: "Votes cast per hour", color: "#64748B", font: { family: "JetBrains Mono", size: 11 } },
            },
          },
        },
      });
      chart.$hourly = hourly;
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.options.scales.y.max = Math.max(1, Math.ceil(peak * 1.15));
      chart.update("none");
    } else {
      if (chart) { chart.destroy(); chart = null; }
      const title = "Hourly activity unavailable";
      let message;
      if (!turnout) {
        message = "Hourly records were not returned. Overall participation remains visible above.";
      } else if (!hourly.length) {
        message = "No hourly records fall within this reporting period. Overall participation is counted separately.";
      } else if (peak > 0 && !window.Chart) {
        message = "The hourly chart could not load. Refresh the page to try again; participation totals are unaffected.";
      } else if (hasWithheld) {
        message = "Some hourly counts are withheld for privacy. Zero-filled hours alone do not show a recorded trend.";
      } else if (values.some(count => count === 0)) {
        message = "No ballot activity was returned for these hours. Election-wide participation is counted separately.";
      } else {
        message = "The response does not contain usable hourly counts. Overall participation remains visible above.";
      }
      const titleElement = document.getElementById("turnoutEmptyTitle"), messageElement = document.getElementById("turnoutEmptyMessage");
      if (titleElement) titleElement.textContent = title;
      if (messageElement) messageElement.textContent = message;
    }
    if (caption) {
      const through = Number.isFinite(Date.parse(turnout?.through)) ? ` through ${timestamp(turnout.through)}` : "";
      caption.textContent = !canPlot
        ? (historical ? "Hourly view: election schedule, Philippine time. Overall turnout is counted separately." : "Hourly activity covers the displayed period; overall turnout is election-scoped.")
        : historical ? "Historical completed-hour counts. Small counts are withheld; gaps are not zero votes." : `Completed hourly intervals${through}. Small counts are withheld; gaps are not zero votes.`;
    }
    // Preserve nonvisual access to the actual reported counts without a visible footer link.
    const tableWrap = document.getElementById("turnoutDataTable");
    if (tableWrap) {
      tableWrap.replaceChildren();
      const table = document.createElement("table");
      table.createCaption().textContent = "Reported hourly votes (Philippine time)";
      const head = table.createTHead().insertRow();
      for (const label of ["Hour (PH time)", "Votes cast"]) { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.append(th); }
      const body = table.createTBody();
      hourly.forEach((item, index) => {
        const row = body.insertRow(); row.insertCell().textContent = timestamp(item.hour);
        row.insertCell().textContent = item.withheld ? "Withheld" : values[index] == null ? "Unavailable" : String(values[index]);
      });
      tableWrap.append(table);
    }
  };
  window.addEventListener("elecom:dashboard", event => render(event.detail));
  window.addEventListener("elecom:dashboard-error", () => {
    const state = document.getElementById("turnoutActivityState");
    if (state) state.textContent = chart ? "Last loaded hours" : "Unavailable";
    const title = document.getElementById("turnoutEmptyTitle");
    const message = document.getElementById("turnoutEmptyMessage");
    if (title && title.textContent === "Loading hourly activity") {
      title.textContent = "Hourly activity unavailable";
      if (message) message.textContent = "The dashboard will retry automatically. No voting activity has been estimated.";
    }
  });
})();
