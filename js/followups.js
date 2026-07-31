"use strict";

function renderFollowups() {
  const groups = [
    ["Offen", "Offen"],
    ["In Bearbeitung", "In Bearbeitung"],
    ["Erledigt", "Erledigt"],
  ];

  $("#followupBoard").innerHTML = groups
    .map(([title, status]) => {
      const items = data.followups
        .filter((followup) => followup.status === status)
        .sort((a, b) => a.due.localeCompare(b.due));

      return `
        <section class="board-column">
          <div class="board-heading">
            <strong>${title}</strong>
            <span class="status-pill">${items.length}</span>
          </div>

          ${
            items.length
              ? items.map((followup) => followupCard(followup)).join("")
              : `
                <div class="board-empty">
                  Keine Wiedervorlagen in diesem Bereich.
                </div>
              `
          }
        </section>
      `;
    })
    .join("");
}

function followupCard(followup) {
  const isCompleted = followup.status === "Erledigt";
  const isOverdue =
    !isCompleted && followup.due && followup.due < iso(new Date());

  const priorityClass = isOverdue
    ? "red"
    : followup.priority === "Hoch"
      ? "orange"
      : "";

  const priorityLabel = isOverdue ? "Überfällig" : followup.priority;

  return `
    <article class="followup-card">
      <div class="tag-row">
        <span class="status-pill ${priorityClass}">
          ${priorityLabel}
        </span>

        ${
          followup.status === "In Bearbeitung"
            ? '<span class="status-pill">In Bearbeitung</span>'
            : ""
        }
      </div>

      <h3>${followup.task}</h3>

      <p>
        ${customerById(followup.customerId)?.name || "Unbekannter Kunde"}
        · ${followup.owner}
      </p>

      <div class="followup-meta">
        <span>Fällig: ${formatDate(followup.due)}</span>
      </div>

      <div class="followup-actions">
        <button
          class="text-button"
          data-action="edit-followup"
          data-id="${followup.id}"
        >
          Bearbeiten
        </button>

        ${
          isCompleted
            ? `
              <button
                class="text-button"
                data-action="reopen-followup"
                data-id="${followup.id}"
              >
                Wieder öffnen
              </button>
            `
            : `
              <button
                class="text-button"
                data-action="complete-followup"
                data-id="${followup.id}"
              >
                Erledigen
              </button>
            `
        }

        <button
          class="text-button danger-text-button"
          data-action="delete-followup"
          data-id="${followup.id}"
        >
          Löschen
        </button>
      </div>
    </article>
  `;
}

function followupById(followupId) {
  return data.followups.find((followup) => followup.id === followupId);
}

function openFollowupEditForm(followupId) {
  const followup = followupById(followupId);

  if (!followup) {
    toast("Die Wiedervorlage wurde nicht gefunden.");
    return;
  }

  openForm(
    "followup",
    {
      ...followup,
    },
    {
      mode: "edit",
      recordId: followup.id,
    },
  );
}

function completeFollowup(followupId) {
  const followup = followupById(followupId);

  if (!followup) {
    toast("Die Wiedervorlage wurde nicht gefunden.");
    return;
  }

  followup.status = "Erledigt";
  saveData();

  toast("Die Wiedervorlage wurde erledigt.");
}

function reopenFollowup(followupId) {
  const followup = followupById(followupId);

  if (!followup) {
    toast("Die Wiedervorlage wurde nicht gefunden.");
    return;
  }

  followup.status = "Offen";
  saveData();

  toast("Die Wiedervorlage wurde wieder geöffnet.");
}

function deleteFollowup(followupId) {
  const followup = followupById(followupId);

  if (!followup) {
    toast("Die Wiedervorlage wurde nicht gefunden.");
    return;
  }

  const customerName =
    customerById(followup.customerId)?.name || "Unbekannter Kunde";

  const confirmed = window.confirm(
    `Soll die Wiedervorlage „${followup.task}“ bei ${customerName} ` +
      `mit Fälligkeit am ${formatDate(followup.due)} wirklich gelöscht werden?`,
  );

  if (!confirmed) {
    return;
  }

  data.followups = data.followups.filter(
    (item) => item.id !== followupId,
  );

  saveData();

  toast("Die Wiedervorlage wurde gelöscht.");
}
