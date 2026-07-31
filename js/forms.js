"use strict";

const formConfigs = {
  customer: {
    title: "Kunde anlegen",
    subtitle: "Stammdaten und Vertriebszuordnung",
    fields: [
      ["name", "Firma / Kundenname", "text", true],
      [
        "type",
        "Kundengruppe",
        "select",
        ["Bestandskunde", "Interessent", "Kaltakquise"],
      ],
      ["street", "Straße", "text"],
      ["zip", "PLZ", "text"],
      ["city", "Ort", "text"],
      ["contact", "Ansprechpartner", "text"],
      ["phone", "Telefon", "tel"],
      ["email", "E-Mail", "email"],
      ["owner", "Außendienst", "select", owners],
      [
        "potential",
        "Potenzial",
        "select",
        ["A – sehr hoch", "B – hoch", "C – mittel", "D – gering"],
      ],
      ["pipeline", "Pipeline", "select", pipelineStages],
      ["trades", "Gewerke (kommagetrennt)", "text"],
      ["note", "Kurznotiz", "textarea"],
    ],
  },
  activity: {
    title: "Kontakt erfassen",
    subtitle: "Telefonat, E-Mail, Besuch oder Akquise dokumentieren",
    fields: [
      ["customerId", "Kunde", "customer", true],
      ["date", "Datum", "date", true],
      ["owner", "Außendienst", "select", owners],
      [
        "type",
        "Kontaktart",
        "select",
        [
          "Kaltakquise Telefon",
          "Telefon",
          "E-Mail",
          "Vor-Ort-Besuch",
          "Video/Teams",
          "Messe/Veranstaltung",
          "Angebot",
          "Sonstiges",
        ],
      ],
      [
        "goal",
        "Besuchsziel",
        "select",
        [
          "Neukundengewinnung",
          "Bestandskundenpflege",
          "Bedarfsanalyse",
          "Produktvorstellung",
          "Angebot nachfassen",
          "Reklamation",
          "Baustellenbesuch",
          "Jahresgespräch",
        ],
      ],
      [
        "result",
        "Ergebnis",
        "select",
        [
          "Nicht erreicht",
          "Information gesendet",
          "Wiedervorlage",
          "Termin vereinbart",
          "Termin durchgeführt",
          "Bedarf erkannt",
          "Angebot angefragt",
          "Angebot erstellt",
          "Auftrag erhalten",
          "Kein Interesse",
          "Verloren",
        ],
      ],
      ["next", "Nächster Schritt", "text"],
      ["due", "Fällig am", "date"],
      ["note", "Kurznotiz", "textarea"],
      ["handNote", "Handschriftliche Notiz", "hand"],
    ],
  },
  appointment: {
    title: "Termin anlegen",
    subtitle: "Kundentermin für Innen- und Außendienst planen",
    fields: [
      ["customerId", "Kunde", "customer", true],
      ["date", "Datum", "date", true],
      ["time", "Uhrzeit", "time", true],
      ["owner", "Außendienst", "select", owners],
      ["subject", "Terminart / Betreff", "text", true],
      ["note", "Vorbereitung / Notiz", "textarea"],
    ],
  },
  followup: {
    title: "Wiedervorlage anlegen",
    subtitle: "Konkreten nächsten Schritt terminieren",
    fields: [
      ["customerId", "Kunde", "customer", true],
      ["owner", "Verantwortlich", "select", owners],
      ["due", "Fällig am", "date", true],
      ["priority", "Priorität", "select", ["Hoch", "Mittel", "Niedrig"]],
      ["task", "Aufgabe / nächster Schritt", "textarea", true],
      ["status", "Status", "select", ["Offen", "In Bearbeitung", "Erledigt"]],
    ],
  },
};
function openForm(type, preset = {}) {
  const cfg = formConfigs[type];
  $("#dialogTitle").textContent = cfg.title;
  $("#dialogSubtitle").textContent = cfg.subtitle;
  $("#dynamicForm").dataset.type = type;
  $("#dialogFields").innerHTML = cfg.fields
    .map(([name, label, input, opts]) => {
      const val =
        preset[name] ??
        (name === "date"
          ? iso(new Date())
          : name === "owner"
            ? owners[0]
            : name === "status"
              ? "Offen"
              : "");
      const required = opts === true ? "required" : "";
      let control = "";
      if (input === "select")
        control = `<select name="${name}" ${required}>${opts.map((o) => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select>`;
      else if (input === "customer")
        control = `<select name="${name}" ${required}>${data.customers.map((c) => `<option value="${c.id}" ${c.id === val ? "selected" : ""}>${c.name} · ${c.city}</option>`).join("")}</select>`;
      else if (input === "textarea")
        control = `<textarea name="${name}" ${required}>${val}</textarea>`;
      else if (input === "hand")
        control = `<input type="hidden" name="${name}" value="${val}"><button type="button" class="secondary-button open-note">✎ Mit Stift schreiben</button><span class="hand-status">${val ? "Notiz vorhanden" : "Noch keine Handnotiz"}</span>`;
      else
        control = `<input name="${name}" type="${input}" value="${val}" ${required}>`;
      return `<div class="field ${input === "textarea" || input === "hand" ? "full" : ""}"><label>${label}</label>${control}</div>`;
    })
    .join("");
  $("#formDialog").showModal();
}
function saveForm(type, values) {
  const idPrefix = {
    customer: "K",
    activity: "A",
    appointment: "T",
    followup: "W",
  }[type];
  values.id = `${idPrefix}-${Date.now()}`;
  if (type === "customer") {
    values.trades = (values.trades || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    values.lastContact = "";
    values.nextAppointment = "";
    data.customers.push(values);
  }
  if (type === "activity") {
    data.activities.push(values);
    const c = customerById(values.customerId);
    if (c) {
      c.lastContact = values.date;
      if (values.result === "Termin vereinbart")
        c.pipeline = "04 Termin vereinbart";
      if (values.result === "Bedarf erkannt")
        c.pipeline = "05 Bedarf qualifiziert";
      if (values.result === "Angebot erstellt") c.pipeline = "06 Angebot";
      if (values.result === "Auftrag erhalten") c.pipeline = "08 Gewonnen";
    }
    if (values.next && values.due)
      data.followups.push({
        id: `W-${Date.now() + 1}`,
        customerId: values.customerId,
        owner: values.owner,
        due: values.due,
        priority: "Mittel",
        task: values.next,
        status: "Offen",
      });
  }
  if (type === "appointment") {
    data.appointments.push(values);
    const c = customerById(values.customerId);
    if (c) c.nextAppointment = values.date;
  }
  if (type === "followup") data.followups.push(values);
  saveData();
  toast("Eintrag wurde gespeichert.");
}
