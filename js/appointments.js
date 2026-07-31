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
    .map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = iso(d);
      const appts = data.appointments
        .filter((a) => a.date === date)
        .sort((a, b) => a.time.localeCompare(b.time));
      return `<div class="day-column"><div class="day-heading">${d.toLocaleDateString("de-DE", { weekday: "short" })}<strong>${d.getDate()}</strong></div>${appts.map((a) => `<div class="appointment-card"><strong>${a.time} · ${customerById(a.customerId)?.name || ""}</strong><span>${a.subject}</span></div>`).join("")}</div>`;
    })
    .join("");
  $("#appointmentList").innerHTML = [...data.appointments]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map(appointmentCompact)
    .join("");
}
