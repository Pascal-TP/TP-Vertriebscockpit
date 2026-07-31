"use strict";

const formConfigs = {
  customer: {
    title: "Kunde anlegen",
    editTitle: "Kunde bearbeiten",
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
    editTitle: "Aktivität bearbeiten",
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
    editTitle: "Termin bearbeiten",
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
    editTitle: "Wiedervorlage bearbeiten",
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

function openForm(type, preset = {}, options = {}) {
  const config = formConfigs[type];
  const mode = options.mode || "create";
  const recordId = options.recordId || "";

  $("#dialogTitle").textContent =
    mode === "edit" && config.editTitle ? config.editTitle : config.title;

  $("#dialogSubtitle").textContent = config.subtitle;

  const form = $("#dynamicForm");
  form.dataset.type = type;
  form.dataset.mode = mode;
  form.dataset.recordId = recordId;

  $("#dialogSaveButton").textContent =
    mode === "edit" ? "Änderungen speichern" : "Speichern";

  $("#dialogFields").innerHTML = config.fields
    .map(([name, label, input, opts]) => {
      const value =
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

      if (input === "select") {
        control = `
          <select name="${name}" ${required}>
            ${opts
              .map(
                (option) => `
                  <option ${option === value ? "selected" : ""}>
                    ${option}
                  </option>
                `,
              )
              .join("")}
          </select>
        `;
      } else if (input === "customer") {
        control = `
          <select name="${name}" ${required}>
            ${data.customers
              .map(
                (customer) => `
                  <option
                    value="${customer.id}"
                    ${customer.id === value ? "selected" : ""}
                  >
                    ${customer.name} · ${customer.city}
                  </option>
                `,
              )
              .join("")}
          </select>
        `;
      } else if (input === "textarea") {
        control = `
          <textarea name="${name}" ${required}>${value}</textarea>
        `;
      } else if (input === "hand") {
        control = `
          <input
            type="hidden"
            name="${name}"
            value="${value}"
          >

          <button
            type="button"
            class="secondary-button open-note"
          >
            ✎ Mit Stift schreiben
          </button>

          <span class="hand-status">
            ${value ? "Notiz vorhanden" : "Noch keine Handnotiz"}
          </span>
        `;
      } else {
        control = `
          <input
            name="${name}"
            type="${input}"
            value="${value}"
            ${required}
          >
        `;
      }

      return `
        <div class="field ${
          input === "textarea" || input === "hand" ? "full" : ""
        }">
          <label>${label}</label>
          ${control}
        </div>
      `;
    })
    .join("");

  $("#formDialog").showModal();
}

async function saveForm(type, values, options = {}) {
  const mode = options.mode || "create";
  const recordId = options.recordId || "";

  try {
    if (type === "customer") {
      const changed = await saveCustomer(values, mode, recordId);

      if (changed === false) {
        toast("Es wurden keine Änderungen festgestellt.");
      } else {
        toast(
          mode === "edit"
            ? "Die Änderungen wurden gespeichert."
            : "Der Kunde wurde gespeichert.",
        );
      }

      return true;
    }

    if (type === "activity") {
      saveActivity(values, mode, recordId);
    }

    if (type === "appointment") {
      saveAppointment(values, mode, recordId);
    }

    if (type === "followup") {
      saveFollowup(values, mode, recordId);
    }

    saveData();

    toast(
      mode === "edit"
        ? "Die Änderungen wurden gespeichert."
        : "Der Eintrag wurde gespeichert.",
    );

    return true;
  } catch (error) {
    console.error("Saving form failed:", error);
    toast("Der Eintrag konnte nicht gespeichert werden.");
    return false;
  }
}

async function saveCustomer(values, mode, recordId) {
  values.trades = (values.trades || "")
    .split(",")
    .map((trade) => trade.trim())
    .filter(Boolean);

  if (mode === "edit") {
    const customer = customerById(recordId);

    if (!customer) {
      throw new Error("Der Kunde wurde nicht gefunden.");
    }

    const updatedCustomer = {
      ...customer,
      ...values,
      id: customer.id,
    };

    const changed = await window.crmFirestore.updateCustomer(
      customer,
      updatedCustomer,
    );

    currentCustomerId = customer.id;
    return changed;
  }

  const customer = {
    ...values,
    id: `K-${Date.now()}`,
    lastContact: "",
    nextAppointment: "",
    archived: false,
    archivedAt: "",
  };

  await window.crmFirestore.createCustomer(customer);
  currentCustomerId = customer.id;
  return true;
}

function saveActivity(values, mode, recordId) {
  if (mode === "edit") {
    const activity = activityById(recordId);

    if (!activity) {
      toast("Die Aktivität wurde nicht gefunden.");
      return;
    }

    const previousCustomerId = activity.customerId;

    Object.assign(activity, values);

    syncCustomerLastContact(previousCustomerId);
    syncCustomerLastContact(activity.customerId);

    const changedCustomer = customerById(activity.customerId);

    applyActivityResultToCustomer(changedCustomer, activity.result);

    window.crmFirestore.updateCustomerSystemFields(
      changedCustomer,
      {
        lastContact: changedCustomer?.lastContact || "",
        pipeline: changedCustomer?.pipeline || "",
      },
      "Kundendaten aus einer bearbeiteten Aktivität aktualisiert",
    );

    return;
  }

  values.id = `A-${Date.now()}`;
  data.activities.push(values);

  const customer = customerById(values.customerId);

  syncCustomerLastContact(values.customerId);
  applyActivityResultToCustomer(customer, values.result);

  window.crmFirestore.updateCustomerSystemFields(
    customer,
    {
      lastContact: customer?.lastContact || "",
      pipeline: customer?.pipeline || "",
    },
    "Kundendaten aus einer neuen Aktivität aktualisiert",
  );

  if (values.next && values.due) {
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
}

function saveAppointment(values, mode, recordId) {
  if (mode === "edit") {
    const appointment = appointmentById(recordId);

    if (!appointment) {
      toast("Der Termin wurde nicht gefunden.");
      return;
    }

    const previousCustomerId = appointment.customerId;

    Object.assign(appointment, values);

    syncCustomerNextAppointment(previousCustomerId);
    syncCustomerNextAppointment(appointment.customerId);

    [previousCustomerId, appointment.customerId]
      .filter((id, index, ids) => id && ids.indexOf(id) === index)
      .forEach((customerId) => {
        const customer = customerById(customerId);

        window.crmFirestore.updateCustomerSystemFields(
          customer,
          { nextAppointment: customer?.nextAppointment || "" },
          "Nächster Kundentermin automatisch aktualisiert",
        );
      });

    return;
  }

  values.id = `T-${Date.now()}`;
  data.appointments.push(values);

  syncCustomerNextAppointment(values.customerId);

  const customer = customerById(values.customerId);

  window.crmFirestore.updateCustomerSystemFields(
    customer,
    { nextAppointment: customer?.nextAppointment || "" },
    "Nächster Kundentermin automatisch aktualisiert",
  );
}

function saveFollowup(values, mode, recordId) {
  if (mode === "edit") {
    const followup = followupById(recordId);

    if (!followup) {
      toast("Die Wiedervorlage wurde nicht gefunden.");
      return;
    }

    Object.assign(followup, values);
    return;
  }

  values.id = `W-${Date.now()}`;
  data.followups.push(values);
}
