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
        <p>${customer.zip} ${customer.city} · ${customer.owner}</p>
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

  const history = data.activities
    .filter((activity) => activity.customerId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

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
          <strong>${customer.owner}</strong>
        </div>

        <div class="info-cell">
          <small>Potenzial</small>
          <strong>${customer.potential}</strong>
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

      <section>
        <div class="section-title-row">
          <h3 class="section-title">CRM-Historie</h3>
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
          <p class="audit-loading">Historie wird geladen …</p>
        </div>
      </section>

      <section>
        <h3 class="section-title">Kontaktverlauf</h3>

        ${
          history.length
            ? history
                .map(
                  (activity) => `
                    <div class="history-item">
                      <time>${formatDate(activity.date)}</time>

                      <div>
                        <h4>${activity.type} · ${activity.result}</h4>

                        <p>
                          ${activity.note || "Keine Notiz"}
                          ${
                            activity.next
                              ? ` · Nächster Schritt: ${activity.next}`
                              : ""
                          }
                        </p>
                      </div>
                    </div>
                  `,
                )
                .join("")
            : "<p>Noch keine Aktivitäten vorhanden.</p>"
        }
      </section>
    </div>
  `;

  $$(".customer-row").forEach((row) =>
    row.classList.toggle("active", row.dataset.id === id),
  );

  renderCustomerAuditHistory(id);
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
