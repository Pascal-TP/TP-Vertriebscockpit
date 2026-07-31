"use strict";

function renderDashboard() {
  const owner = $("#dashboardOwner").value || "all";
  const period = $("#dashboardPeriod").value;
  const now = new Date();

  const filtered = data.activities.filter((activity) => {
    if (owner !== "all" && activity.owner !== owner) {
      return false;
    }

    const activityDate = new Date(activity.date + "T12:00:00");

    if (period === "week") {
      return (
        getWeek(activityDate) === getWeek(now) &&
        activityDate.getFullYear() === now.getFullYear()
      );
    }

    if (period === "month") {
      return (
        activityDate.getMonth() === now.getMonth() &&
        activityDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });

  const appointments = data.appointments.filter(
    (appointment) => owner === "all" || appointment.owner === owner,
  );

  const openFollowups = data.followups.filter(
    (followup) =>
      followup.status !== "Erledigt" &&
      (owner === "all" || followup.owner === owner),
  );

  const results = {
    activities: filtered.length,
    visits: filtered.filter((activity) => activity.type.includes("Besuch"))
      .length,
    appointments: filtered.filter(
      (activity) => activity.result === "Termin vereinbart",
    ).length,
    offers: filtered.filter((activity) =>
      activity.result.includes("Angebot"),
    ).length,
    orders: filtered.filter(
      (activity) => activity.result === "Auftrag erhalten",
    ).length,
    followups: openFollowups.length,
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
      (kpi) => `
        <article class="card kpi-card">
          <div class="kpi-top">
            <span>${kpi[0]}</span>
            <span class="kpi-icon">${kpi[2]}</span>
          </div>

          <div class="kpi-value">${kpi[1]}</div>
          <div class="kpi-note">${kpi[3]}</div>
        </article>
      `,
    )
    .join("");

  const weeks = [...Array(6)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (5 - index) * 7);

    return {
      week: getWeek(date),
      year: date.getFullYear(),
    };
  });

  const counts = weeks.map(
    (week) =>
      data.activities.filter((activity) => {
        const activityDate = new Date(activity.date + "T12:00:00");

        return (
          getWeek(activityDate) === week.week &&
          activityDate.getFullYear() === week.year &&
          (owner === "all" || activity.owner === owner)
        );
      }).length,
  );

  const max = Math.max(...counts, 1);

  $("#activityChart").innerHTML = weeks
    .map(
      (week, index) => `
        <div class="bar-item">
          <div
            class="bar"
            style="height:${Math.max(4, (counts[index] / max) * 180)}px"
          >
            <span>${counts[index]}</span>
          </div>

          <div class="bar-label">KW ${week.week}</div>
        </div>
      `,
    )
    .join("");

  const stageCounts = pipelineStages.map((stage) => ({
    stage,
    count: data.customers.filter(
      (customer) =>
        customer.archived !== true &&
        customer.pipeline === stage &&
        (owner === "all" || customer.owner === owner),
    ).length,
  }));

  const maxStage = Math.max(
    ...stageCounts.map((stage) => stage.count),
    1,
  );

  $("#pipelineList").innerHTML = stageCounts
    .map(
      (stage) => `
        <div class="pipeline-row">
          <span>${stage.stage.replace(/^\d+ /, "")}</span>

          <div class="progress">
            <span style="width:${(stage.count / maxStage) * 100}%"></span>
          </div>

          <strong>${stage.count}</strong>
        </div>
      `,
    )
    .join("");

  const upcoming = [...appointments]
    .filter((appointment) => appointment.date >= iso(new Date()))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 4);

  $("#upcomingAppointments").innerHTML = upcoming.length
    ? upcoming.map((appointment) => appointmentCompact(appointment)).join("")
    : '<p class="muted">Keine Termine vorhanden.</p>';

  const overdue = openFollowups
    .filter((followup) => followup.due < iso(new Date()))
    .slice(0, 3)
    .map((followup) => ({
      title: followup.task,
      sub: customerById(followup.customerId)?.name || "",
      label: `${Math.abs(daysBetween(followup.due))} Tage überfällig`,
      cls: "red",
    }));

  const stale = data.customers
    .filter(
      (customer) =>
        customer.archived !== true &&
        daysBetween(customer.lastContact) > 180,
    )
    .slice(0, 2)
    .map((customer) => ({
      title: customer.name,
      sub: "Lange ohne Kontakt",
      label: `${daysBetween(customer.lastContact)} Tage`,
      cls: "orange",
    }));

  $("#attentionList").innerHTML =
    [...overdue, ...stale]
      .map(
        (item) => `
          <div class="compact-item">
            <div class="compact-date">!</div>

            <div>
              <h3>${item.title}</h3>
              <p>${item.sub}</p>
            </div>

            <span class="status-pill ${item.cls}">
              ${item.label}
            </span>
          </div>
        `,
      )
      .join("") || "<p>Kein akuter Handlungsbedarf.</p>";
}

function appointmentCompact(appointment, options = {}) {
  const customer = customerById(appointment.customerId);
  const date = new Date(appointment.date + "T12:00:00");
  const showActions = options.showActions === true;

  return `
    <div class="compact-item">
      <div class="compact-date">
        <strong>${date.getDate()}</strong>
        <span>
          ${date.toLocaleDateString("de-DE", { month: "short" })}
        </span>
      </div>

      <div>
        <h3>
          ${appointment.time} · ${customer?.name || "Unbekannt"}
        </h3>

        <p>${appointment.subject} · ${appointment.owner}</p>
      </div>

      ${
        showActions
          ? `
            <div class="compact-actions">
              <button
                class="text-button map-link"
                data-customer="${appointment.customerId}"
              >
                Maps
              </button>

              <button
                class="text-button"
                data-action="edit-appointment"
                data-id="${appointment.id}"
              >
                Bearbeiten
              </button>

              <button
                class="text-button danger-text-button"
                data-action="delete-appointment"
                data-id="${appointment.id}"
              >
                Löschen
              </button>
            </div>
          `
          : `
            <button
              class="text-button map-link"
              data-customer="${appointment.customerId}"
            >
              Maps
            </button>
          `
      }
    </div>
  `;
}
