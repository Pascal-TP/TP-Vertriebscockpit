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

function archiveCustomer(customerId) {
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
    `Soll der Kunde „${customer.name}“ wirklich archiviert werden?\n\n` +
      `Verknüpfte Einträge bleiben erhalten:\n` +
      `• ${linkedActivities} Aktivitäten\n` +
      `• ${linkedAppointments} Termine\n` +
      `• ${linkedFollowups} Wiedervorlagen\n\n` +
      `Der Kunde kann später wiederhergestellt werden.`,
  );

  if (!confirmed) {
    return;
  }

  customer.archived = true;
  customer.archivedAt = iso(new Date());

  currentCustomerId = null;

  saveData();
  renderEmptyCustomerDetail();

  toast("Der Kunde wurde archiviert.");
}

function restoreCustomer(customerId) {
  const customer = customerById(customerId);

  if (!customer) {
    toast("Der Kunde wurde nicht gefunden.");
    return;
  }

  if (customer.archived !== true) {
    toast("Der Kunde ist nicht archiviert.");
    return;
  }

  customer.archived = false;
  customer.archivedAt = "";

  currentCustomerId = null;

  saveData();
  renderEmptyCustomerDetail();

  toast("Der Kunde wurde wiederhergestellt.");
}
