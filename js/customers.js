"use strict";

function renderCustomers() {
  const filter = $("#customerTypeFilter .active")?.dataset.value || "all";
  const owner = $("#customerOwnerFilter").value || "all";
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

    const matchesSearch = [
      customer.customerNumber,
      customer.name,
      customer.city,
      customer.contact,
      customer.zip,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);

    return (
      matchesArchiveFilter &&
      matchesType &&
      matchesOwner &&
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
          <small>Ansprechpartner</small>
          <strong>${customer.contact || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Telefon</small>
          <strong>${customer.phone || customer.mobile || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>E-Mail</small>
          <strong>${customer.email || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Außendienst</small>
          <strong>${customer.owner || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Potenzial</small>
          <strong>${customer.potential || "–"}</strong>
        </div>

        <div class="info-cell">
          <small>Letzter Kontakt</small>
          <strong>${formatDate(customer.lastContact)}</strong>
        </div>
      </div>

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
    type: "Kundengruppe",
    street: "Straße",
    zip: "PLZ",
    city: "Ort",
    contact: "Ansprechpartner",
    phone: "Telefon",
    mobile: "Mobil",
    email: "E-Mail",
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
