"use strict";

function renderAppointments() {
  const start = new Date();

  start.setDate(
    start.getDate() - ((start.getDay() + 6) % 7) + calendarOffset * 7,
  );

  start.setHours(12, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 4);

  $("#calendarRange").textContent =
    `${formatDate(iso(start))} – ${formatDate(iso(end))}`;

  $("#weekGrid").innerHTML = [...Array(5)]
    .map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const dateValue = iso(date);

      const appointments = data.appointments
        .filter((appointment) => appointment.date === dateValue)
        .sort((a, b) => a.time.localeCompare(b.time));

      return `
        <div class="day-column">
          <div class="day-heading">
            ${date.toLocaleDateString("de-DE", { weekday: "short" })}
            <strong>${date.getDate()}</strong>
          </div>

          ${appointments
            .map((appointment) => appointmentCalendarCard(appointment))
            .join("")}
        </div>
      `;
    })
    .join("");

  $("#appointmentList").innerHTML = [...data.appointments]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((appointment) =>
      appointmentCompact(appointment, {
        showActions: true,
      }),
    )
    .join("");
}

function appointmentCalendarCard(appointment) {
  const customer = customerById(appointment.customerId);

  return `
    <div class="appointment-card">
      <strong>
        ${appointment.time} · ${customer?.name || "Unbekannt"}
      </strong>

      <span>${appointment.subject}</span>
      <small class="record-audit">
        Zuletzt: ${formatDateTime(appointment.updatedAt)}
        · ${appointment.updatedByEmail || "–"}
      </small>

      <div class="appointment-actions">
        <button
          class="text-button"
          data-action="edit-appointment"
          data-id="${appointment.id}"
          aria-label="Termin bearbeiten"
          title="Termin bearbeiten"
        >
          Bearbeiten
        </button>

        <button
          class="text-button danger-text-button"
          data-action="delete-appointment"
          data-id="${appointment.id}"
          aria-label="Termin löschen"
          title="Termin löschen"
        >
          Löschen
        </button>

        <button
          class="text-button"
          data-action="create-contact-from-appointment"
          data-id="${appointment.id}"
          aria-label="Kontakt aus Termin erfassen"
          title="Kontakt aus Termin erfassen"
        >
          + Kontakt erfassen
        </button>
      </div>
    </div>
  `;
}

function openActivityFromAppointment(appointmentId) {
  const appointment = appointmentById(appointmentId);

  if (!appointment) {
    toast("Der Termin wurde nicht gefunden.");
    return;
  }

  const customer = customerById(appointment.customerId);

  if (customer?.archived === true) {
    toast(
      "Für einen archivierten Kunden kann kein neuer Kontakt erfasst werden.",
    );
    return;
  }

  const noteParts = [
    appointment.subject
      ? `Termin: ${appointment.subject}`
      : "",
    appointment.note
      ? `Terminnotiz: ${appointment.note}`
      : "",
  ].filter(Boolean);

  openForm(
    "activity",
    {
      customerId: appointment.customerId,
      date: appointment.date,
      owner: appointment.owner,
      type: "Vor-Ort-Besuch",
      result: "Termin durchgeführt",
      note: noteParts.join("\n\n"),
      sourceAppointmentId: appointment.id,
    },
    {
      sourceAppointmentId: appointment.id,
    },
  );
}

function openAppointmentEditForm(appointmentId) {
  const appointment = appointmentById(appointmentId);

  if (!appointment) {
    toast("Der Termin wurde nicht gefunden.");
    return;
  }

  openForm(
    "appointment",
    {
      ...appointment,
    },
    {
      mode: "edit",
      recordId: appointment.id,
    },
  );
}

async function deleteAppointment(appointmentId) {
  const appointment = appointmentById(appointmentId);

  if (!appointment) {
    toast("Der Termin wurde nicht gefunden.");
    return;
  }

  const customer = customerById(appointment.customerId);
  const customerName = customer?.name || "Unbekannter Kunde";

  const confirmed = window.confirm(
    `Soll der Termin „${appointment.subject}“ bei ${customerName} am ` +
      `${formatDate(appointment.date)} um ${appointment.time} Uhr wirklich gelöscht werden?`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await window.crmFirestore.deleteAppointmentRecord(appointment, {
      appointments: data.appointments,
      customers: data.customers,
    });

    toast("Der Termin wurde gelöscht.");
  } catch (error) {
    console.error("Appointment deletion failed:", error);
    toast("Der Termin konnte nicht gelöscht werden.");
  }
}

function appointmentById(appointmentId) {
  return data.appointments.find(
    (appointment) => appointment.id === appointmentId,
  );
}

function syncCustomerNextAppointment(customerId) {
  const customer = customerById(customerId);

  if (!customer) {
    return;
  }

  const nextAppointment = data.appointments
    .filter(
      (appointment) =>
        appointment.customerId === customerId &&
        appointment.date >= iso(new Date()),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

  customer.nextAppointment = nextAppointment?.date || "";
}
