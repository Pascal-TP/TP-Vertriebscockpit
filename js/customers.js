"use strict";

function renderCustomers() {
  const filter = $("#customerTypeFilter .active")?.dataset.value || "all";
  const owner = $("#customerOwnerFilter").value || "all";
  const customerGroup = $("#customerGroupFilter")?.value || "all";
  const query = $("#customerSearch").value.toLowerCase();

  const list = data.customers.filter((customer) => {
    const isArchived = customer.archived === true;

    const matchesArchiveFilter =
      filter === "archived" ? isArchived : !isArchived;

    const matchesType =
      filter === "all" ||
      filter === "archived" ||
      customer.type === filter;

    const matchesOwner =
      owner === "all" || customer.owner === owner;

    const matchesCustomerGroup =
      customerGroup === "all" || customer.customerGroup === customerGroup;

    const matchesSearch = [
      customer.customerNumber,
      customer.name,
      customer.city,
      customer.contact,
      customer.contact2,
      customer.contact3,
      customer.email,
      customer.email2,
      customer.email3,
      customer.phone,
      customer.phone2,
      customer.phone3,
      customer.zip,
      customer.customerGroup,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);

    return (
      matchesArchiveFilter &&
      matchesType &&
      matchesOwner &&
      matchesCustomerGroup &&
      matchesSearch
    );
  });

  $("#customerCount").textContent =
    filter === "archived"
      ? `${list.length} archivierte Kunden`
      : `${list.length} aktive Kunden`;

  $("#customerList").innerHTML =
    list
      .map((customer) => customerListItem(customer))
      .join("") ||
    `
      <div class="empty-state">
        <p>
          ${
            filter === "archived"
              ? "Keine archivierten Kunden gefunden."
              : "Keine passenden Kunden gefunden."
          }
        </p>
      </div>
    `;

  const selectedCustomerIsVisible = list.some(
    (customer) => customer.id === currentCustomerId,
  );

  if (currentCustomerId && selectedCustomerIsVisible) {
    renderCustomerDetail(currentCustomerId);
  } else {
    currentCustomerId = null;
    renderEmptyCustomerDetail();
  }
}

function customerListItem(customer) {
  const isArchived = customer.archived === true;

  const statusClass = isArchived
    ? "archived"
    : customer.type === "Bestandskunde"
      ? "green"
      : customer.type === "Kaltakquise"
        ? "orange"
        : "";

  const statusText = isArchived ? "Archiviert" : customer.type;

  return `
    <div
      class="customer-row ${isArchived ? "archived-customer-row" : ""} ${
        customer.id === currentCustomerId ? "active" : ""
      }"
      data-id="${customer.id}"
    >
      <div class="avatar">${initials(customer.name)}</div>

      <div>
        <h3>${customer.name}</h3>
        <p>${customer.customerNumber ? `Kundennr. ${customer.customerNumber} · ` : ""}${customer.zip} ${customer.city}${customer.owner ? ` · ${customer.owner}` : ""}</p>
      </div>

      <span class="status-pill ${statusClass}">
        ${statusText}
      </span>
    </div>
  `;
}


function customerRevenueHistory(customer) {
  const byDate = new Map();

  if (Array.isArray(customer?.revenueHistory)) {
    customer.revenueHistory.forEach((entry) => {
      const asOf = String(entry?.asOf || "").slice(0, 10);
      const revenue = Number(entry?.revenue);
      if (!asOf || !Number.isFinite(revenue)) return;
      byDate.set(asOf, { ...entry, asOf, revenue });
    });
  }

  // Bestehende Kunden aus Versionen vor der Umsatzhistorie bleiben sofort sichtbar.
  const currentAsOf = String(customer?.revenueAsOf || "").slice(0, 10);
  const currentRevenue = Number(customer?.revenue);
  if (currentAsOf && Number.isFinite(currentRevenue) && !byDate.has(currentAsOf)) {
    byDate.set(currentAsOf, {
      asOf: currentAsOf,
      revenue: currentRevenue,
      source: "bestand",
    });
  }

  return [...byDate.values()].sort((a, b) => a.asOf.localeCompare(b.asOf));
}

function revenueHistorySourceLabel(source) {
  const labels = {
    "csv-import": "CSV-Import",
    manual: "Manuell",
    bestand: "Bisheriger Stand",
  };
  return labels[source] || "Gespeichert";
}

function revenueDevelopmentChart(entries) {
  if (!entries.length) {
    return '<div class="revenue-history-empty">Noch keine Umsatzstände mit Datum vorhanden.</div>';
  }

  const width = 760;
  const height = 260;
  const left = 72;
  const right = 22;
  const top = 24;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = entries.map((entry) => entry.revenue);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);

  if (minValue === maxValue) {
    const padding = Math.max(Math.abs(maxValue) * 0.1, 1000);
    minValue = Math.max(0, minValue - padding);
    maxValue += padding;
  } else {
    const padding = (maxValue - minValue) * 0.12;
    minValue = Math.max(0, minValue - padding);
    maxValue += padding;
  }

  const range = maxValue - minValue || 1;
  const xFor = (index) =>
    entries.length === 1
      ? left + plotWidth / 2
      : left + (plotWidth * index) / (entries.length - 1);
  const yFor = (value) => top + plotHeight - ((value - minValue) / range) * plotHeight;

  const points = entries
    .map((entry, index) => `${xFor(index).toFixed(1)},${yFor(entry.revenue).toFixed(1)}`)
    .join(" ");

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxValue - range * ratio;
    const y = top + plotHeight * ratio;
    return `
      <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="revenue-chart-grid"></line>
      <text x="${left - 10}" y="${y + 4}" text-anchor="end" class="revenue-chart-axis-label">${Math.round(value).toLocaleString("de-DE")}</text>
    `;
  }).join("");

  const pointMarkup = entries.map((entry, index) => {
    const x = xFor(index);
    const y = yFor(entry.revenue);
    const dateLabel = formatDate(entry.asOf);
    return `
      <circle cx="${x}" cy="${y}" r="5" class="revenue-chart-point">
        <title>${dateLabel}: ${formatRevenue(entry.revenue)}</title>
      </circle>
      <text x="${x}" y="${height - 18}" text-anchor="middle" class="revenue-chart-axis-label revenue-chart-date-label">${dateLabel}</text>
    `;
  }).join("");

  return `
    <div class="revenue-chart-scroll">
      <svg class="revenue-development-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik der Umsatzentwicklung">
        ${yTicks}
        <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" class="revenue-chart-axis"></line>
        ${entries.length > 1 ? `<polyline points="${points}" class="revenue-chart-line"></polyline>` : ""}
        ${pointMarkup}
      </svg>
    </div>
  `;
}

function renderCustomerRevenueDevelopment(customer) {
  const entries = customerRevenueHistory(customer);
  const newest = entries.at(-1);
  const previous = entries.at(-2);
  const delta = newest && previous ? newest.revenue - previous.revenue : null;
  const deltaPercent = previous && previous.revenue !== 0
    ? (delta / previous.revenue) * 100
    : null;

  return `
    <section class="customer-revenue-development-section">
      <div class="section-title-row revenue-development-heading">
        <div>
          <h3 class="section-title">Umsatzentwicklung</h3>
          <p class="section-subtitle">
            ${entries.length === 1 ? "1 gespeicherter Umsatzstand" : `${entries.length} gespeicherte Umsatzstände`}
          </p>
        </div>
        ${
          delta === null
            ? ""
            : `<div class="revenue-development-delta ${delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral"}">
                <small>Veränderung zum vorherigen Stand</small>
                <strong>${delta > 0 ? "+" : ""}${formatRevenue(delta)}</strong>
                ${deltaPercent === null ? "" : `<span>${deltaPercent > 0 ? "+" : ""}${deltaPercent.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</span>`}
              </div>`
        }
      </div>

      ${revenueDevelopmentChart(entries)}

      <div class="table-scroll revenue-history-table-wrap">
        <table class="revenue-history-table">
          <thead>
            <tr>
              <th>Stand</th>
              <th>Umsatz</th>
              <th>Veränderung</th>
              <th>Quelle</th>
            </tr>
          </thead>
          <tbody>
            ${
              entries.length
                ? [...entries].reverse().map((entry, reverseIndex, reversed) => {
                    const originalIndex = entries.length - 1 - reverseIndex;
                    const prior = originalIndex > 0 ? entries[originalIndex - 1] : null;
                    const change = prior ? entry.revenue - prior.revenue : null;
                    return `<tr>
                      <td>${formatDate(entry.asOf)}</td>
                      <td><strong>${formatRevenue(entry.revenue)}</strong></td>
                      <td>${change === null ? "–" : `${change > 0 ? "+" : ""}${formatRevenue(change)}`}</td>
                      <td>${revenueHistorySourceLabel(entry.source)}</td>
                    </tr>`;
                  }).join("")
                : '<tr><td colspan="4">Noch keine historischen Umsatzstände vorhanden.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCustomerContactPerson(customer, number) {
  const suffix = number === 1 ? "" : String(number);
  const name = customer[`contact${suffix}`] || "";
  const phone = customer[`phone${suffix}`] || "";
  const mobile = customer[`mobile${suffix}`] || "";
  const email = customer[`email${suffix}`] || "";

  if (!name && !phone && !mobile && !email) {
    return `
      <div class="customer-contact-person">
        <small>Ansprechpartner ${number}</small>
        <strong>–</strong>
      </div>
    `;
  }

  return `
    <div class="customer-contact-person">
      <small>Ansprechpartner ${number}</small>
      <strong>${name || "–"}</strong>
      ${phone ? `<span>Telefon: ${phone}</span>` : ""}
      ${mobile ? `<span>Mobil: ${mobile}</span>` : ""}
      ${email ? `<span>E-Mail: ${email}</span>` : ""}
    </div>
  `;
}

function renderCustomerDetail(id) {
  const customer = customerById(id);

  if (!customer) {
    currentCustomerId = null;
    renderEmptyCustomerDetail();
    return;
  }

  currentCustomerId = id;

  const isArchived = customer.archived === true;

  const customerActivities = data.activities
    .filter((activity) => activity.customerId === id)
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.updatedAt || b.createdAt || "").localeCompare(
        String(a.updatedAt || a.createdAt || ""),
      );
    });

  const openCustomerFollowups = data.followups
    .filter(
      (followup) =>
        followup.customerId === id && followup.status !== "Erledigt",
    )
    .sort((a, b) => String(a.due || "9999-12-31").localeCompare(String(b.due || "9999-12-31")));

  const upcomingCustomerAppointments = data.appointments
    .filter(
      (appointment) =>
        appointment.customerId === id &&
        appointment.date >= iso(new Date()),
    )
    .sort((a, b) =>
      `${a.date || "9999-12-31"} ${a.time || "23:59"}`.localeCompare(
        `${b.date || "9999-12-31"} ${b.time || "23:59"}`,
      ),
    );

  $("#customerDetail").innerHTML = `
    <div class="detail-header">
      <div>
        <div class="tag-row">
          <span class="status-pill ${
            isArchived
              ? "archived"
              : customer.type === "Bestandskunde"
                ? "green"
                : customer.type === "Kaltakquise"
                  ? "orange"
                  : ""
          }">
            ${isArchived ? "Archiviert" : customer.type}
          </span>

          <span class="status-pill">
            ${customer.pipeline.replace(/^\d+ /, "")}
          </span>
        </div>

        <h2>${customer.name}</h2>

        <p>
          ${customer.street || "Keine Straße hinterlegt"},
          ${customer.zip} ${customer.city}
        </p>

        ${
          isArchived
            ? `
              <p class="archive-note">
                Dieser Kunde ist archiviert
                ${
                  customer.archivedAt
                    ? `seit dem ${formatDate(customer.archivedAt)}`
                    : ""
                }.
              </p>
            `
            : ""
        }
      </div>

      <div class="detail-actions">
        <button
          class="secondary-button map-link"
          data-customer="${customer.id}"
        >
          ⌖ Google Maps
        </button>

        <button
          class="secondary-button"
          data-action="edit-customer"
          data-id="${customer.id}"
        >
          ✎ Bearbeiten
        </button>

        ${
          isArchived
            ? `
              <button
                class="secondary-button restore-button"
                data-action="restore-customer"
                data-id="${customer.id}"
              >
                ↺ Wiederherstellen
              </button>

              ${
                isAdmin()
                  ? `
                    <button
                      class="danger-button"
                      data-action="permanently-delete-customer"
                      data-id="${customer.id}"
                    >
                      Endgültig löschen
                    </button>
                  `
                  : ""
              }
            `
            : `
              <button
                class="secondary-button archive-button"
                data-action="archive-customer"
                data-id="${customer.id}"
              >
                Archivieren
              </button>

              <button
                class="secondary-button"
                data-action="appointment"
                data-id="${customer.id}"
              >
                + Termin
              </button>

              <button
                class="secondary-button"
                data-action="followup"
                data-id="${customer.id}"
              >
                + Wiedervorlage
              </button>

              <button
                class="primary-button"
                data-action="activity"
                data-id="${customer.id}"
              >
                + Kontakt erfassen
              </button>
            `
        }
      </div>
    </div>

    <div class="detail-body">
      <div class="info-grid">
        <div class="info-cell">
          <small>Kundennummer</small>
          <strong>${customer.customerNumber || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Kundengruppe</small>
          <strong>${customer.customerGroup || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Außendienst</small>
          <strong>${customer.owner || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Potenzial</small>
          <strong>${customer.potential || "–"}</strong>
        </div>

        <div class="info-cell revenue-info-cell">
          <small>Umsatz</small>
          <strong>${formatRevenue(customer.revenue)}</strong>
          <span>${customer.revenueAsOf ? `Stand: ${formatDate(customer.revenueAsOf)}` : "Stand nicht angegeben"}</span>
        </div>

        <div class="info-cell">
          <small>Letzter Kontakt</small>
          <strong>${formatDate(customer.lastContact)}</strong>
        </div>
      </div>

      <section>
        <h3 class="section-title">Ansprechpartner</h3>
        <div class="customer-contact-persons">
          ${renderCustomerContactPerson(customer, 1)}
          ${renderCustomerContactPerson(customer, 2)}
          ${renderCustomerContactPerson(customer, 3)}
        </div>
      </section>

      <div class="audit-summary">
        <div>
          <small>Angelegt</small>
          <strong>${formatDateTime(customer.createdAt)}</strong>
          <span>${customer.createdByEmail || "–"}</span>
        </div>

        <div>
          <small>Zuletzt geändert</small>
          <strong>${formatDateTime(customer.updatedAt)}</strong>
          <span>${customer.updatedByEmail || "–"}</span>
        </div>
      </div>

      <section>
        <h3 class="section-title">Relevante Gewerke</h3>

        <div class="tag-row">
          ${
            customer.trades.length
              ? customer.trades
                  .map((trade) => `<span class="tag">${trade}</span>`)
                  .join("")
              : "–"
          }
        </div>
      </section>

      <section>
        <h3 class="section-title">Kurznotiz</h3>
        <p>${customer.note || "Keine Notiz vorhanden."}</p>
      </section>

      ${renderCustomerRevenueDevelopment(customer)}

      <section class="customer-followup-section">
        <div class="section-title-row customer-followup-heading">
          <div>
            <h3 class="section-title">Offene Wiedervorlagen</h3>
            <p class="section-subtitle">
              ${openCustomerFollowups.length === 1 ? "1 offene Wiedervorlage" : `${openCustomerFollowups.length} offene Wiedervorlagen`}
            </p>
          </div>

          ${
            isArchived
              ? ""
              : `<button
                  type="button"
                  class="text-button"
                  data-action="followup"
                  data-id="${customer.id}"
                >
                  + Wiedervorlage
                </button>`
          }
        </div>

        <div class="customer-followup-list">
          ${
            openCustomerFollowups.length
              ? openCustomerFollowups.map(renderCustomerFollowupCard).join("")
              : '<p class="empty-customer-followups">Für diesen Kunden sind keine offenen Wiedervorlagen vorhanden.</p>'
          }
        </div>
      </section>

      <section class="customer-appointment-section">
        <div class="section-title-row customer-appointment-heading">
          <div>
            <h3 class="section-title">Kommende Termine</h3>
            <p class="section-subtitle">
              ${upcomingCustomerAppointments.length === 1 ? "1 kommender Termin" : `${upcomingCustomerAppointments.length} kommende Termine`}
            </p>
          </div>

          ${
            isArchived
              ? ""
              : `<button
                  type="button"
                  class="text-button"
                  data-action="appointment"
                  data-id="${customer.id}"
                >
                  + Termin
                </button>`
          }
        </div>

        <div class="customer-appointment-list">
          ${
            upcomingCustomerAppointments.length
              ? upcomingCustomerAppointments.map(renderCustomerAppointmentCard).join("")
              : '<p class="empty-customer-appointments">Für diesen Kunden sind keine kommenden Termine vorhanden.</p>'
          }
        </div>
      </section>

      <section class="customer-contact-section">
        <div class="section-title-row customer-contact-heading">
          <div>
            <h3 class="section-title">Erfasste Kontakte</h3>
            <p class="section-subtitle">
              ${customerActivities.length === 1 ? "1 Kontakt" : `${customerActivities.length} Kontakte`}
            </p>
          </div>

          ${
            isArchived
              ? ""
              : `<button
                  type="button"
                  class="text-button"
                  data-action="activity"
                  data-id="${customer.id}"
                >
                  + Kontakt erfassen
                </button>`
          }
        </div>

        <div class="customer-contact-list">
          ${
            customerActivities.length
              ? customerActivities.map(renderCustomerContactCard).join("")
              : '<p class="empty-customer-contacts">Für diesen Kunden wurden noch keine Kontakte erfasst.</p>'
          }
        </div>
      </section>

      <section class="customer-history-section">
        <button
          type="button"
          class="customer-history-toggle"
          data-action="toggle-customer-history"
          data-id="${customer.id}"
          aria-expanded="false"
          aria-controls="customerHistoryPanel"
        >
          <span>
            <strong>CRM-Historie</strong>
            <small>Änderungen und protokollierte Aktionen anzeigen</small>
          </span>
          <span class="customer-history-toggle-icon" aria-hidden="true">⌄</span>
        </button>

        <div id="customerHistoryPanel" class="customer-history-panel" hidden>
          <div class="customer-history-panel-head">
            <span>Chronologische Änderungshistorie</span>
            <button
              type="button"
              class="text-button"
              data-action="refresh-customer-history"
              data-id="${customer.id}"
            >
              Aktualisieren
            </button>
          </div>

          <div id="customerAuditHistory" class="audit-history">
            <p class="audit-loading">Historie wird beim Öffnen geladen.</p>
          </div>
        </div>
      </section>
    </div>
  `;

  $$(".customer-row").forEach((row) =>
    row.classList.toggle("active", row.dataset.id === id),
  );

}


function renderCustomerFollowupCard(followup) {
  const isOverdue = followup.due && followup.due < iso(new Date());
  const priorityClass = isOverdue
    ? "red"
    : followup.priority === "Hoch"
      ? "orange"
      : "";
  const priorityLabel = isOverdue ? "Überfällig" : (followup.priority || "Mittel");

  return `
    <article class="customer-followup-card">
      <div class="customer-followup-date">
        <strong>${formatDate(followup.due)}</strong>
        <small>${followup.owner || "Kein Verantwortlicher"}</small>
      </div>

      <div class="customer-followup-content">
        <div class="customer-followup-title-row">
          <h4>${followup.task || "Wiedervorlage"}</h4>
          <span class="status-pill ${priorityClass}">${priorityLabel}</span>
        </div>

        <div class="customer-followup-footer">
          <span class="status-pill">${followup.status || "Offen"}</span>
          <div class="customer-followup-actions">
            <button type="button" class="text-button" data-action="edit-followup" data-id="${followup.id}">Bearbeiten</button>
            <button type="button" class="text-button" data-action="create-appointment-from-followup" data-id="${followup.id}">+ Termin</button>
            <button type="button" class="text-button" data-action="complete-followup" data-id="${followup.id}">Erledigen</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderCustomerAppointmentCard(appointment) {
  const isToday = appointment.date === iso(new Date());

  return `
    <article class="customer-appointment-card">
      <div class="customer-appointment-date">
        <strong>${formatDate(appointment.date)}</strong>
        <small>${appointment.time ? `${appointment.time} Uhr` : "Keine Uhrzeit"}</small>
      </div>

      <div class="customer-appointment-content">
        <div class="customer-appointment-title-row">
          <h4>${appointment.subject || "Termin"}</h4>
          ${isToday ? '<span class="status-pill green">Heute</span>' : ""}
        </div>

        ${
          appointment.note
            ? `<p>${appointment.note}</p>`
            : '<p class="customer-appointment-empty-note">Keine Notiz vorhanden.</p>'
        }

        <div class="customer-appointment-footer">
          <small>${appointment.owner || "Kein Außendienst"}</small>

          <div class="customer-appointment-actions">
            <button type="button" class="text-button" data-action="edit-appointment" data-id="${appointment.id}">Bearbeiten</button>
            <button type="button" class="text-button" data-action="create-contact-from-appointment" data-id="${appointment.id}">+ Kontakt erfassen</button>
            <button type="button" class="text-button danger-text-button" data-action="delete-appointment" data-id="${appointment.id}">Löschen</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderCustomerContactCard(activity) {
  const photoCount = Array.isArray(activity.photos) ? activity.photos.length : 0;
  const documentCount = Array.isArray(activity.documents)
    ? activity.documents.length
    : 0;

  return `
    <article class="customer-contact-card">
      <div class="customer-contact-date">
        <strong>${formatDate(activity.date)}</strong>
        <small>${activity.owner || "Kein Außendienst"}</small>
      </div>

      <div class="customer-contact-content">
        <div class="customer-contact-title-row">
          <h4>${activity.type || "Kontakt"}</h4>
          <span class="status-pill">${activity.result || "Ohne Ergebnis"}</span>
        </div>

        <p>${activity.note || "Keine Notiz vorhanden."}</p>

        ${
          activity.next
            ? `<div class="customer-contact-next"><strong>Nächster Schritt:</strong> ${activity.next}${activity.due ? ` · ${formatDate(activity.due)}` : ""}</div>`
            : ""
        }

        <div class="customer-contact-footer">
          <div class="customer-contact-attachments">
            ${
              photoCount
                ? `<button class="attachment-count-button" type="button" data-action="open-activity-photos" data-id="${activity.id}">📷 Fotos: ${photoCount}</button>`
                : ""
            }
            ${
              documentCount
                ? `<button class="attachment-count-button" type="button" data-action="open-activity-documents" data-id="${activity.id}">📎 Dokumente: ${documentCount}</button>`
                : ""
            }
            ${activity.handNote ? '<span class="tag">Handnotiz vorhanden</span>' : ""}
          </div>

          <button
            type="button"
            class="secondary-button compact-button"
            data-action="edit-activity"
            data-id="${activity.id}"
          >
            Bearbeiten
          </button>
        </div>
      </div>
    </article>
  `;
}

function toggleCustomerHistory(customerId, button) {
  if (currentCustomerId !== customerId) return;

  const panel = $("#customerHistoryPanel");
  if (!panel) return;

  const shouldOpen = panel.hidden;
  panel.hidden = !shouldOpen;
  button?.setAttribute("aria-expanded", String(shouldOpen));
  button?.classList.toggle("open", shouldOpen);

  if (shouldOpen && panel.dataset.loaded !== "true") {
    panel.dataset.loaded = "true";
    renderCustomerAuditHistory(customerId);
  }
}

async function renderCustomerAuditHistory(customerId) {
  const container = $("#customerAuditHistory");

  if (!container || currentCustomerId !== customerId) {
    return;
  }

  container.innerHTML = '<p class="audit-loading">Historie wird geladen …</p>';

  try {
    const entries = await window.crmFirestore.loadCustomerHistory(customerId);

    if (!container || currentCustomerId !== customerId) {
      return;
    }

    container.innerHTML = entries.length
      ? entries
          .map(
            (entry) => `
              <article class="audit-entry">
                <div class="audit-entry-head">
                  <strong>
                    ${historyEntityLabel(entry.entityType)}
                    · ${historyActionLabel(entry.action)}
                  </strong>
                  <time>${formatDateTime(entry.changedAt)}</time>
                </div>

                <p>${entry.summary || "Kundendaten geändert"}</p>

                <small>
                  ${entry.changedByName || entry.changedByEmail || "Unbekannt"}
                  ${
                    entry.changedByEmail &&
                    entry.changedByName !== entry.changedByEmail
                      ? ` · ${entry.changedByEmail}`
                      : ""
                  }
                </small>

                ${renderHistoryChanges(entry.changes)}
              </article>
            `,
          )
          .join("")
      : "<p>Noch keine Änderungshistorie vorhanden.</p>";
  } catch (error) {
    console.error("History loading failed:", error);
    container.innerHTML =
      '<p class="audit-error">Die Änderungshistorie konnte nicht geladen werden.</p>';
  }
}

function historyEntityLabel(entityType) {
  const labels = {
    customer: "Kunde",
    activity: "Aktivität",
    appointment: "Termin",
    followup: "Wiedervorlage",
  };

  return labels[entityType] || "Eintrag";
}

function historyActionLabel(action) {
  const labels = {
    created: "Angelegt",
    updated: "Bearbeitet",
    archived: "Archiviert",
    restored: "Wiederhergestellt",
    imported: "CSV-Import",
    migrated: "Lokale Übernahme",
    "system-updated": "Automatisch aktualisiert",
    completed: "Erledigt",
    reopened: "Wieder geöffnet",
    deleted: "Gelöscht",
  };

  return labels[action] || "Geändert";
}

function renderHistoryChanges(changes = {}) {
  const labels = {
    name: "Firma / Kundenname",
    type: "Kundenstatus",
    customerGroup: "Kundengruppe",
    street: "Straße",
    zip: "PLZ",
    city: "Ort",
    contact: "Ansprechpartner 1",
    phone: "Telefon Ansprechpartner 1",
    mobile: "Mobil Ansprechpartner 1",
    email: "E-Mail Ansprechpartner 1",
    contact2: "Ansprechpartner 2",
    phone2: "Telefon Ansprechpartner 2",
    mobile2: "Mobil Ansprechpartner 2",
    email2: "E-Mail Ansprechpartner 2",
    contact3: "Ansprechpartner 3",
    phone3: "Telefon Ansprechpartner 3",
    mobile3: "Mobil Ansprechpartner 3",
    email3: "E-Mail Ansprechpartner 3",
    owner: "Außendienst",
    potential: "Potenzial",
    pipeline: "Pipeline",
    trades: "Gewerke",
    note: "Kurznotiz",
    lastContact: "Letzter Kontakt",
    nextAppointment: "Nächster Termin",
    archived: "Archivstatus",
    archivedAt: "Archiviert am",
  };

  const rows = Object.entries(changes);

  if (!rows.length) {
    return "";
  }

  return `
    <details class="audit-changes">
      <summary>${rows.length} Änderung${rows.length === 1 ? "" : "en"}</summary>

      <div>
        ${rows
          .map(([field, values]) => {
            const oldValue = formatHistoryValue(values.oldValue);
            const newValue = formatHistoryValue(values.newValue);

            return `
              <p>
                <strong>${labels[field] || field}:</strong>
                <span>${oldValue}</span>
                <span aria-hidden="true">→</span>
                <span>${newValue}</span>
              </p>
            `;
          })
          .join("")}
      </div>
    </details>
  `;
}

function formatHistoryValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "–";
  }

  if (value === true) {
    return "Ja";
  }

  if (value === false) {
    return "Nein";
  }

  return value === null || value === undefined || value === ""
    ? "–"
    : String(value);
}

function renderEmptyCustomerDetail() {
  const archivedFilterIsActive =
    $("#customerTypeFilter .active")?.dataset.value === "archived";

  $("#customerDetail").innerHTML = `
    <div class="empty-state">
      <div>◉</div>

      <h2>
        ${
          archivedFilterIsActive
            ? "Archivierten Kunden auswählen"
            : "Kunden auswählen"
        }
      </h2>

      <p>
        ${
          archivedFilterIsActive
            ? "Wählen Sie links einen archivierten Kunden aus, um seine Daten einzusehen oder ihn wiederherzustellen."
            : "Wählen Sie links einen Kunden aus, um Stammdaten, Historie und nächste Schritte zu sehen."
        }
      </p>
    </div>
  `;
}

function openCustomerEditForm(customerId) {
  const customer = customerById(customerId);

  if (!customer) {
    toast("Der Kunde wurde nicht gefunden.");
    return;
  }

  openForm(
    "customer",
    {
      ...customer,
      trades: customer.trades.join(", "),
    },
    {
      mode: "edit",
      recordId: customer.id,
    },
  );
}

async function archiveCustomer(customerId) {
  const customer = customerById(customerId);

  if (!customer) {
    toast("Der Kunde wurde nicht gefunden.");
    return;
  }

  if (customer.archived === true) {
    toast("Der Kunde ist bereits archiviert.");
    return;
  }

  const linkedActivities = data.activities.filter(
    (activity) => activity.customerId === customerId,
  ).length;

  const linkedAppointments = data.appointments.filter(
    (appointment) => appointment.customerId === customerId,
  ).length;

  const linkedFollowups = data.followups.filter(
    (followup) => followup.customerId === customerId,
  ).length;

  const confirmed = window.confirm(
    `Soll der Kunde „${customer.name}“ wirklich archiviert werden?

` +
      `Verknüpfte Einträge bleiben erhalten:
` +
      `• ${linkedActivities} Aktivitäten
` +
      `• ${linkedAppointments} Termine
` +
      `• ${linkedFollowups} Wiedervorlagen

` +
      `Der Kunde kann später wiederhergestellt werden.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await window.crmFirestore.archiveCustomerRecord(customer);
    currentCustomerId = null;
    renderEmptyCustomerDetail();
    toast("Der Kunde wurde archiviert.");
  } catch (error) {
    console.error("Customer archiving failed:", error);
    toast("Der Kunde konnte nicht archiviert werden.");
  }
}

async function restoreCustomer(customerId) {
  const customer = customerById(customerId);

  if (!customer) {
    toast("Der Kunde wurde nicht gefunden.");
    return;
  }

  if (customer.archived !== true) {
    toast("Der Kunde ist nicht archiviert.");
    return;
  }

  try {
    await window.crmFirestore.restoreCustomerRecord(customer);
    currentCustomerId = null;
    renderEmptyCustomerDetail();
    toast("Der Kunde wurde wiederhergestellt.");
  } catch (error) {
    console.error("Customer restoration failed:", error);
    toast("Der Kunde konnte nicht wiederhergestellt werden.");
  }
}


async function permanentlyDeleteCustomer(customerId) {
  if (!isAdmin()) {
    toast("Nur Administratoren dürfen Kunden endgültig löschen.");
    return;
  }

  const customer = customerById(customerId);
  if (!customer || customer.archived !== true) {
    toast("Nur archivierte Kunden können endgültig gelöscht werden.");
    return;
  }

  const enteredName = window.prompt(
    `Der Kunde und alle zugehörigen Aktivitäten, Termine und Wiedervorlagen werden endgültig gelöscht.\n\nDie Historie bleibt erhalten.\n\nBitte geben Sie zur Bestätigung den Kundennamen exakt ein:\n${customer.name}`,
  );

  if (enteredName === null) return;

  if (enteredName.trim() !== String(customer.name || "").trim()) {
    window.alert("Der eingegebene Kundenname stimmt nicht überein. Der Kunde wurde nicht gelöscht.");
    return;
  }

  try {
    await window.crmFirestore.permanentlyDeleteCustomer(customer, {
      activities: data.activities,
      appointments: data.appointments,
      followups: data.followups,
    });

    currentCustomerId = null;
    toast(`Kunde „${customer.name}“ wurde endgültig gelöscht.`);
  } catch (error) {
    console.error("Permanent customer deletion failed:", error);
    window.alert(error?.message || "Der Kunde konnte nicht endgültig gelöscht werden.");
  }
}
