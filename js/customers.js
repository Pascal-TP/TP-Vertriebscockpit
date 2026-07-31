"use strict";

function renderCustomers() {
  const type = $("#customerTypeFilter .active")?.dataset.value || "all";
  const owner = $("#customerOwnerFilter").value || "all";
  const q = $("#customerSearch").value.toLowerCase();

  const list = data.customers.filter(
    (customer) =>
      (type === "all" || customer.type === type) &&
      (owner === "all" || customer.owner === owner) &&
      [customer.name, customer.city, customer.contact, customer.zip]
        .join(" ")
        .toLowerCase()
        .includes(q),
  );

  $("#customerCount").textContent = `${list.length} Kunden`;

  $("#customerList").innerHTML =
    list
      .map(
        (customer) => `
          <div
            class="customer-row ${customer.id === currentCustomerId ? "active" : ""}"
            data-id="${customer.id}"
          >
            <div class="avatar">${initials(customer.name)}</div>

            <div>
              <h3>${customer.name}</h3>
              <p>${customer.zip} ${customer.city} · ${customer.owner}</p>
            </div>

            <span class="status-pill ${
              customer.type === "Bestandskunde"
                ? "green"
                : customer.type === "Kaltakquise"
                  ? "orange"
                  : ""
            }">
              ${customer.type}
            </span>
          </div>
        `,
      )
      .join("") ||
    '<div class="empty-state"><p>Keine passenden Kunden gefunden.</p></div>';

  if (currentCustomerId) {
    renderCustomerDetail(currentCustomerId);
  }
}

function renderCustomerDetail(id) {
  const customer = customerById(id);

  if (!customer) {
    currentCustomerId = null;
    renderEmptyCustomerDetail();
    return;
  }

  currentCustomerId = id;

  const history = data.activities
    .filter((activity) => activity.customerId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  $("#customerDetail").innerHTML = `
    <div class="detail-header">
      <div>
        <div class="tag-row">
          <span class="status-pill ${
            customer.type === "Bestandskunde"
              ? "green"
              : customer.type === "Kaltakquise"
                ? "orange"
                : ""
          }">
            ${customer.type}
          </span>

          <span class="status-pill">
            ${customer.pipeline.replace(/^\d+ /, "")}
          </span>
        </div>

        <h2>${customer.name}</h2>
        <p>${customer.street || "Keine Straße hinterlegt"}, ${customer.zip} ${customer.city}</p>
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
  $("#customerDetail").innerHTML = `
    <div class="empty-state">
      <div>◉</div>
      <h2>Kunden auswählen</h2>
      <p>
        Wählen Sie links einen Kunden aus, um Stammdaten,
        Historie und nächste Schritte zu sehen.
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
