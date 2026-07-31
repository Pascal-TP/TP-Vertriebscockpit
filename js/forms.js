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
      ["mobile", "Mobil", "tel"],
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
    let changed = true;

    if (type === "customer") {
      changed = await saveCustomer(values, mode, recordId);
    }

    if (type === "activity") {
      changed = await saveActivity(values, mode, recordId);
    }

    if (type === "appointment") {
      changed = await saveAppointment(values, mode, recordId);
    }

    if (type === "followup") {
      changed = await saveFollowup(values, mode, recordId);
    }

    if (changed === "opened") {
      return true;
    }

    if (changed === false) {
      return false;
    } else {
      toast(
        mode === "edit"
          ? "Die Änderungen wurden gespeichert."
          : "Der Eintrag wurde gespeichert.",
      );
    }

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

  const matches = findCustomerDuplicates(values, mode === "edit" ? recordId : "");

  if (matches.length) {
    const decision = await requestDuplicateDecision(matches);

    if (decision.action === "cancel") {
      return false;
    }

    if (decision.action === "open") {
      $("#formDialog").close();
      showView("customers");
      renderCustomerDetail(decision.customerId);
      return "opened";
    }
  }

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

async function saveActivity(values, mode, recordId) {
  if (mode === "edit") {
    const activity = activityById(recordId);

    if (!activity) {
      throw new Error("Die Aktivität wurde nicht gefunden.");
    }

    const updatedActivity = {
      ...activity,
      ...values,
      id: activity.id,
    };

    return window.crmFirestore.updateActivity(
      activity,
      updatedActivity,
      {
        activities: data.activities,
        customers: data.customers,
      },
    );
  }

  const activity = {
    ...values,
    id: `A-${Date.now()}`,
  };

  const followup =
    values.next && values.due
      ? {
          id: `W-${Date.now() + 1}`,
          customerId: values.customerId,
          owner: values.owner,
          due: values.due,
          priority: "Mittel",
          task: values.next,
          status: "Offen",
        }
      : null;

  await window.crmFirestore.createActivity(activity, {
    activity,
    activities: data.activities,
    customer: customerById(values.customerId),
    followup,
  });

  return true;
}

async function saveAppointment(values, mode, recordId) {
  if (mode === "edit") {
    const appointment = appointmentById(recordId);

    if (!appointment) {
      throw new Error("Der Termin wurde nicht gefunden.");
    }

    const updatedAppointment = {
      ...appointment,
      ...values,
      id: appointment.id,
    };

    return window.crmFirestore.updateAppointment(
      appointment,
      updatedAppointment,
      {
        appointments: data.appointments,
        customers: data.customers,
      },
    );
  }

  const appointment = {
    ...values,
    id: `T-${Date.now()}`,
  };

  await window.crmFirestore.createAppointment(appointment, {
    appointments: data.appointments,
    customers: data.customers,
  });

  return true;
}

async function saveFollowup(values, mode, recordId) {
  if (mode === "edit") {
    const followup = followupById(recordId);

    if (!followup) {
      throw new Error("Die Wiedervorlage wurde nicht gefunden.");
    }

    const updatedFollowup = {
      ...followup,
      ...values,
      id: followup.id,
    };

    return window.crmFirestore.updateFollowup(
      followup,
      updatedFollowup,
      "updated",
    );
  }

  const followup = {
    ...values,
    id: `W-${Date.now()}`,
  };

  await window.crmFirestore.createFollowup(followup);
  return true;
}
