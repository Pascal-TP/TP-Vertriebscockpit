"use strict";

function renderActivities() {
  $("#activityTableBody").innerHTML = [...data.activities]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (a) =>
        `<tr><td>${formatDate(a.date)}</td><td><strong>${customerById(a.customerId)?.name || "–"}</strong></td><td>${a.owner}</td><td>${a.type}</td><td><span class="status-pill">${a.result}</span></td><td>${a.next || "–"}${a.due ? `<br><small>${formatDate(a.due)}</small>` : ""}</td><td>${a.note || "–"}${a.handNote ? '<br><span class="tag">Handnotiz vorhanden</span>' : ""}</td></tr>`,
    )
    .join("");
}
