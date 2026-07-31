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
        .filter((w) => w.status === status)
        .sort((a, b) => a.due.localeCompare(b.due));
      return `<section class="board-column"><div class="board-heading"><strong>${title}</strong><span class="status-pill">${items.length}</span></div>${items
        .map((w) => {
          const over = w.status !== "Erledigt" && w.due < iso(new Date());
          return `<article class="followup-card"><div class="tag-row"><span class="status-pill ${over ? "red" : w.priority === "Hoch" ? "orange" : ""}">${over ? "Überfällig" : w.priority}</span></div><h3>${w.task}</h3><p>${customerById(w.customerId)?.name || ""} · ${w.owner}</p><div class="followup-meta"><span>Fällig: ${formatDate(w.due)}</span>${w.status !== "Erledigt" ? `<button class="text-button complete-followup" data-id="${w.id}">Erledigen</button>` : ""}</div></article>`;
        })
        .join("")}</section>`;
    })
    .join("");
}
