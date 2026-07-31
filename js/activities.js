"use strict";

function renderActivities() {
  $("#activityTableBody").innerHTML = [...data.activities]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((activity) => {
      const customer = customerById(activity.customerId);

      return `
        <tr>
          <td>${formatDate(activity.date)}</td>

          <td>
            <strong>${customer?.name || "–"}</strong>
          </td>

          <td>${activity.owner}</td>
          <td>${activity.type}</td>

          <td>
            <span class="status-pill">${activity.result}</span>
          </td>

          <td>
            ${activity.next || "–"}
            ${
              activity.due
                ? `<br><small>${formatDate(activity.due)}</small>`
                : ""
            }
          </td>

          <td>
            ${activity.note || "–"}
            ${
              activity.handNote
                ? '<br><span class="tag">Handnotiz vorhanden</span>'
                : ""
            }
            <div class="record-audit">
              Zuletzt: ${formatDateTime(activity.updatedAt)}
              · ${activity.updatedByEmail || "–"}
            </div>
          </td>

          <td>
            <div class="table-actions">
              <button
                class="text-button"
                data-action="edit-activity"
                data-id="${activity.id}"
              >
                Bearbeiten
              </button>

              <button
                class="text-button danger-text-button"
                data-action="delete-activity"
                data-id="${activity.id}"
              >
                Löschen
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function activityById(activityId) {
  return data.activities.find((activity) => activity.id === activityId);
}

function openActivityEditForm(activityId) {
  const activity = activityById(activityId);

  if (!activity) {
    toast("Die Aktivität wurde nicht gefunden.");
    return;
  }

  openForm(
    "activity",
    {
      ...activity,
    },
    {
      mode: "edit",
      recordId: activity.id,
    },
  );
}

async function deleteActivity(activityId) {
  const activity = activityById(activityId);

  if (!activity) {
    toast("Die Aktivität wurde nicht gefunden.");
    return;
  }

  const customerName =
    customerById(activity.customerId)?.name || "Unbekannter Kunde";

  const confirmed = window.confirm(
    `Soll die Aktivität „${activity.type}“ bei ${customerName} ` +
      `vom ${formatDate(activity.date)} wirklich gelöscht werden?`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await window.crmFirestore.deleteActivityRecord(activity, {
      activities: data.activities,
      customers: data.customers,
    });

    toast("Die Aktivität wurde gelöscht.");
  } catch (error) {
    console.error("Activity deletion failed:", error);
    toast("Die Aktivität konnte nicht gelöscht werden.");
  }
}

function syncCustomerLastContact(customerId) {
  const customer = customerById(customerId);

  if (!customer) {
    return;
  }

  const latestActivity = data.activities
    .filter((activity) => activity.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  customer.lastContact = latestActivity?.date || "";
}

function applyActivityResultToCustomer(customer, result) {
  if (!customer) {
    return;
  }

  if (result === "Termin vereinbart") {
    customer.pipeline = "04 Termin vereinbart";
  }

  if (result === "Bedarf erkannt") {
    customer.pipeline = "05 Bedarf qualifiziert";
  }

  if (result === "Angebot erstellt") {
    customer.pipeline = "06 Angebot";
  }

  if (result === "Auftrag erhalten") {
    customer.pipeline = "08 Gewonnen";
  }

  if (result === "Verloren") {
    customer.pipeline = "09 Verloren";
  }
}
