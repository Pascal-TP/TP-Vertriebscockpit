"use strict";

const viewMeta = {
  dashboard: [
    "Dashboard",
    "Aktivitäten, Termine und offene Aufgaben im Überblick",
    "Vertriebsaktivitäten im Überblick",
  ],
  customers: [
    "Kunden",
    "Bestandskunden, Interessenten und Kaltakquise zentral verwalten",
    "Kundenstamm und Historie",
  ],
  appointments: [
    "Termine",
    "Besuche planen, vorbereiten und direkt navigieren",
    "Termin- und Tourenübersicht",
  ],
  activities: [
    "Aktivitäten",
    "Kontakt- und Besuchshistorie ohne zusätzliche E-Mail-Berichte",
    "Alle Vertriebsaktivitäten",
  ],
  followups: [
    "Wiedervorlagen",
    "Nächste Schritte zuverlässig verfolgen",
    "Offene Aufgaben und Fristen",
  ],
  import: [
    "CSV-Import",
    "Bestehende Kundenlisten strukturiert übernehmen",
    "Daten aus CSV übernehmen",
  ],
};
function showView(name) {
  $$(".view").forEach((v) =>
    v.classList.toggle("active", v.id === `view-${name}`),
  );
  $$(".nav-button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name),
  );
  const [title, sub, hint] = viewMeta[name];
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = sub;
  $("#locationLabel").textContent = title;
  $("#locationHint").textContent = hint;
  $("#sidebar").classList.remove("open");
}

function fillOwnerSelects() {
  ["dashboardOwner", "customerOwnerFilter"].forEach((id) => {
    const el = $("#" + id);
    const first = el.options[0].outerHTML;
    el.innerHTML = first + owners.map((o) => `<option>${o}</option>`).join("");
  });
}
