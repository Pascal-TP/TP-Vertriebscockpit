"use strict";

function renderCustomers() {
  const type = $("#customerTypeFilter .active")?.dataset.value || "all",
    owner = $("#customerOwnerFilter").value || "all",
    q = $("#customerSearch").value.toLowerCase();
  const list = data.customers.filter(
    (c) =>
      (type === "all" || c.type === type) &&
      (owner === "all" || c.owner === owner) &&
      [c.name, c.city, c.contact, c.zip].join(" ").toLowerCase().includes(q),
  );
  $("#customerCount").textContent = `${list.length} Kunden`;
  $("#customerList").innerHTML =
    list
      .map(
        (c) =>
          `<div class="customer-row ${c.id === currentCustomerId ? "active" : ""}" data-id="${c.id}"><div class="avatar">${initials(c.name)}</div><div><h3>${c.name}</h3><p>${c.zip} ${c.city} · ${c.owner}</p></div><span class="status-pill ${c.type === "Bestandskunde" ? "green" : c.type === "Kaltakquise" ? "orange" : ""}">${c.type}</span></div>`,
      )
      .join("") ||
    '<div class="empty-state"><p>Keine passenden Kunden gefunden.</p></div>';
  if (currentCustomerId) renderCustomerDetail(currentCustomerId);
}
function renderCustomerDetail(id) {
  const c = customerById(id);
  if (!c) return;
  currentCustomerId = id;
  const hist = data.activities
    .filter((a) => a.customerId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
  $("#customerDetail").innerHTML =
    `<div class="detail-header"><div><div class="tag-row"><span class="status-pill green">${c.type}</span><span class="status-pill">${c.pipeline.replace(/^\d+ /, "")}</span></div><h2>${c.name}</h2><p>${c.street}, ${c.zip} ${c.city}</p></div><div class="detail-actions"><button class="secondary-button map-link" data-customer="${c.id}">⌖ Google Maps</button><button class="secondary-button" data-action="appointment" data-id="${c.id}">+ Termin</button><button class="primary-button" data-action="activity" data-id="${c.id}">+ Kontakt erfassen</button></div></div><div class="detail-body"><div class="info-grid"><div class="info-cell"><small>Ansprechpartner</small><strong>${c.contact || "–"}</strong></div><div class="info-cell"><small>Telefon</small><strong>${c.phone || c.mobile || "–"}</strong></div><div class="info-cell"><small>E-Mail</small><strong>${c.email || "–"}</strong></div><div class="info-cell"><small>Außendienst</small><strong>${c.owner}</strong></div><div class="info-cell"><small>Potenzial</small><strong>${c.potential}</strong></div><div class="info-cell"><small>Letzter Kontakt</small><strong>${formatDate(c.lastContact)}</strong></div></div><section><h3 class="section-title">Relevante Gewerke</h3><div class="tag-row">${c.trades.map((t) => `<span class="tag">${t}</span>`).join("") || "–"}</div></section><section><h3 class="section-title">Kurznotiz</h3><p>${c.note || "Keine Notiz vorhanden."}</p></section><section><h3 class="section-title">Kontaktverlauf</h3>${hist.length ? hist.map((a) => `<div class="history-item"><time>${formatDate(a.date)}</time><div><h4>${a.type} · ${a.result}</h4><p>${a.note || "Keine Notiz"}${a.next ? ` · Nächster Schritt: ${a.next}` : ""}</p></div></div>`).join("") : "<p>Noch keine Aktivitäten vorhanden.</p>"}</section></div>`;
  $$(".customer-row").forEach((row) =>
    row.classList.toggle("active", row.dataset.id === id),
  );
}
