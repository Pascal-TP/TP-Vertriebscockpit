"use strict";

function bindEvents() {
  $$(".nav-button").forEach(
    (b) => (b.onclick = () => showView(b.dataset.view)),
  );
  $$("[data-go]").forEach((b) => (b.onclick = () => showView(b.dataset.go)));
  $("#menuButton").onclick = () => $("#sidebar").classList.toggle("open");
  $("#dashboardOwner").onchange = renderDashboard;
  $("#dashboardPeriod").onchange = renderDashboard;
  $("#customerOwnerFilter").onchange = renderCustomers;
  $("#customerSearch").oninput = renderCustomers;
  $("#customerTypeFilter").onclick = (e) => {
    if (e.target.tagName === "BUTTON") {
      $$("#customerTypeFilter button").forEach((b) =>
        b.classList.remove("active"),
      );
      e.target.classList.add("active");
      renderCustomers();
    }
  };
  $("#customerList").onclick = (e) => {
    const row = e.target.closest(".customer-row");
    if (row) {
      currentCustomerId = row.dataset.id;
      renderCustomerDetail(currentCustomerId);
    }
  };
  document.addEventListener("click", (e) => {
    const map = e.target.closest(".map-link");
    if (map) openMaps(map.dataset.customer);
    const action = e.target.closest("[data-action]");
    if (action)
      openForm(action.dataset.action, { customerId: action.dataset.id });
    const complete = e.target.closest(".complete-followup");
    if (complete) {
      const w = data.followups.find((x) => x.id === complete.dataset.id);
      w.status = "Erledigt";
      saveData();
      toast("Wiedervorlage erledigt.");
    }
  });
  $("#quickActivityButton").onclick = $("#newActivityButton").onclick = () =>
    openForm("activity");
  $("#newCustomerButton").onclick = () => openForm("customer");
  $("#newAppointmentButton").onclick = () => openForm("appointment");
  $("#newFollowupButton").onclick = () => openForm("followup");
  $("#prevWeek").onclick = () => {
    calendarOffset--;
    renderAppointments();
  };
  $("#nextWeek").onclick = () => {
    calendarOffset++;
    renderAppointments();
  };
  $("#dynamicForm").addEventListener("click", (e) => {
    if (e.target.classList.contains("open-note")) {
      activeNoteTarget =
        e.target.parentElement.querySelector("input[type=hidden]");
      const canvas = $("#noteCanvas"),
        ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (activeNoteTarget.value) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = activeNoteTarget.value;
      }
      $("#noteDialog").showModal();
    }
  });
  $("#dynamicForm").addEventListener("submit", (e) => {
    if (e.submitter?.value === "cancel") return;
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    saveForm(e.currentTarget.dataset.type, values);
    $("#formDialog").close();
  });
  $("#resetDemoButton").onclick = () => {
    data = structuredClone(seedData);
    saveData();
    toast("Demodaten wurden zurückgesetzt.");
  };
  $("#globalSearch").onkeydown = (e) => {
    if (e.key === "Enter") {
      showView("customers");
      $("#customerSearch").value = e.target.value;
      renderCustomers();
    }
  };
  $("#csvFile").onchange = (e) => {
    const file = e.target.files[0];
    $("#fileName").textContent = file ? file.name : "oder hier ablegen";
    $("#importButton").disabled = !file;
  };
  $("#importButton").onclick = () => {
    const file = $("#csvFile").files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = parseCSV(reader.result);
      pendingImport = mapImport(raw, $("#importType").value);
      const cols = [
        "name",
        "street",
        "zip",
        "city",
        "contact",
        "phone",
        "email",
      ];
      $("#importPreview thead").innerHTML =
        "<tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>";
      $("#importPreview tbody").innerHTML = pendingImport
        .slice(0, 8)
        .map(
          (r) =>
            "<tr>" +
            cols.map((c) => `<td>${r[c] || ""}</td>`).join("") +
            "</tr>",
        )
        .join("");
      $("#importSummary").textContent =
        `${pendingImport.length} Datensätze erkannt`;
      $("#confirmImportButton").classList.remove("hidden");
    };
    reader.readAsText(file, "utf-8");
  };
  $("#confirmImportButton").onclick = () => {
    data.customers.push(...pendingImport);
    pendingImport = [];
    saveData();
    toast("CSV-Datensätze wurden übernommen.");
    showView("customers");
  };
}
