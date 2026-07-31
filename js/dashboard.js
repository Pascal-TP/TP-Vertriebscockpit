"use strict";

function renderDashboard() {
  const owner = $("#dashboardOwner").value || "all";
  const period = $("#dashboardPeriod").value;
  const now = new Date();
  const filtered = data.activities.filter((a) => {
    if (owner !== "all" && a.owner !== owner) return false;
    const d = new Date(a.date + "T12:00:00");
    if (period === "week")
      return (
        getWeek(d) === getWeek(now) && d.getFullYear() === now.getFullYear()
      );
    if (period === "month")
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    return true;
  });
  const appointments = data.appointments.filter(
    (a) => owner === "all" || a.owner === owner,
  );
  const open = data.followups.filter(
    (w) => w.status !== "Erledigt" && (owner === "all" || w.owner === owner),
  );
  const results = {
    activities: filtered.length,
    visits: filtered.filter((a) => a.type.includes("Besuch")).length,
    appointments: filtered.filter((a) => a.result === "Termin vereinbart")
      .length,
    offers: filtered.filter((a) => a.result.includes("Angebot")).length,
    orders: filtered.filter((a) => a.result === "Auftrag erhalten").length,
    followups: open.length,
  };
  const kpis = [
    ["Aktivitäten", results.activities, "↻", "im gewählten Zeitraum"],
    ["Vor-Ort-Termine", results.visits, "⌖", "durchgeführte Besuche"],
    [
      "Termine vereinbart",
      results.appointments,
      "□",
      "aus Kontakten entstanden",
    ],
    ["Angebote", results.offers, "€", "Angebotsaktivitäten"],
    ["Aufträge", results.orders, "✓", "erfolgreiche Abschlüsse"],
    ["Offene Wiedervorlagen", results.followups, "!", "nächste Schritte"],
  ];
  $("#kpiGrid").innerHTML = kpis
    .map(
      (k) =>
        `<article class="card kpi-card"><div class="kpi-top"><span>${k[0]}</span><span class="kpi-icon">${k[2]}</span></div><div class="kpi-value">${k[1]}</div><div class="kpi-note">${k[3]}</div></article>`,
    )
    .join("");
  const weeks = [...Array(6)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (5 - i) * 7);
    return { week: getWeek(d), year: d.getFullYear() };
  });
  const counts = weeks.map(
    (w) =>
      data.activities.filter((a) => {
        const d = new Date(a.date + "T12:00:00");
        return (
          getWeek(d) === w.week &&
          d.getFullYear() === w.year &&
          (owner === "all" || a.owner === owner)
        );
      }).length,
  );
  const max = Math.max(...counts, 1);
  $("#activityChart").innerHTML = weeks
    .map(
      (w, i) =>
        `<div class="bar-item"><div class="bar" style="height:${Math.max(4, (counts[i] / max) * 180)}px"><span>${counts[i]}</span></div><div class="bar-label">KW ${w.week}</div></div>`,
    )
    .join("");
  const stageCounts = pipelineStages.map((s) => ({
    stage: s,
    count: data.customers.filter(
      (c) => c.pipeline === s && (owner === "all" || c.owner === owner),
    ).length,
  }));
  const maxStage = Math.max(...stageCounts.map((s) => s.count), 1);
  $("#pipelineList").innerHTML = stageCounts
    .map(
      (s) =>
        `<div class="pipeline-row"><span>${s.stage.replace(/^\d+ /, "")}</span><div class="progress"><span style="width:${(s.count / maxStage) * 100}%"></span></div><strong>${s.count}</strong></div>`,
    )
    .join("");
  const upcoming = [...appointments]
    .filter((a) => a.date >= iso(new Date()))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 4);
  $("#upcomingAppointments").innerHTML = upcoming.length
    ? upcoming.map(appointmentCompact).join("")
    : '<p class="muted">Keine Termine vorhanden.</p>';
  const overdue = open
    .filter((w) => w.due < iso(new Date()))
    .slice(0, 3)
    .map((w) => ({
      title: w.task,
      sub: customerById(w.customerId)?.name || "",
      label: `${Math.abs(daysBetween(w.due))} Tage überfällig`,
      cls: "red",
    }));
  const stale = data.customers
    .filter((c) => daysBetween(c.lastContact) > 180)
    .slice(0, 2)
    .map((c) => ({
      title: c.name,
      sub: "Lange ohne Kontakt",
      label: `${daysBetween(c.lastContact)} Tage`,
      cls: "orange",
    }));
  $("#attentionList").innerHTML =
    [...overdue, ...stale]
      .map(
        (x) =>
          `<div class="compact-item"><div class="compact-date">!</div><div><h3>${x.title}</h3><p>${x.sub}</p></div><span class="status-pill ${x.cls}">${x.label}</span></div>`,
      )
      .join("") || "<p>Kein akuter Handlungsbedarf.</p>";
}
function appointmentCompact(a) {
  const c = customerById(a.customerId);
  const d = new Date(a.date + "T12:00:00");
  return `<div class="compact-item"><div class="compact-date"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString("de-DE", { month: "short" })}</span></div><div><h3>${a.time} · ${c?.name || "Unbekannt"}</h3><p>${a.subject} · ${a.owner}</p></div><button class="text-button map-link" data-customer="${a.customerId}">Maps</button></div>`;
}
