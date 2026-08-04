"use strict";

function bindEvents() {
  bindNavigationEvents();
  bindDashboardEvents();
  bindCustomerEvents();
  bindGlobalActionEvents();
  bindCreateButtonEvents();
  bindAppointmentEvents();
  bindFormEvents();
  bindSearchEvents();
  bindImportEvents();
  bindExportEvents();
  bindAdminEvents();
}

function bindNavigationEvents() {
  $$(".nav-button").forEach(
    (button) => (button.onclick = () => showView(button.dataset.view)),
  );

  $$("[data-go]").forEach(
    (button) => (button.onclick = () => showView(button.dataset.go)),
  );

  $("#menuButton").onclick = () => $("#sidebar").classList.toggle("open");
}

function bindDashboardEvents() {
  $("#dashboardOwner").onchange = renderDashboard;
  $("#dashboardPeriod").onchange = renderDashboard;
}

function bindCustomerEvents() {
  $("#customerOwnerFilter").onchange = renderCustomers;
  $("#customerSearch").oninput = renderCustomers;

  $("#customerTypeFilter").onclick = (event) => {
    if (event.target.tagName !== "BUTTON") {
      return;
    }

    $$("#customerTypeFilter button").forEach((button) =>
      button.classList.remove("active"),
    );

    event.target.classList.add("active");
    renderCustomers();
  };

  $("#customerList").onclick = (event) => {
    const row = event.target.closest(".customer-row");

    if (!row) {
      return;
    }

    currentCustomerId = row.dataset.id;
    renderCustomerDetail(currentCustomerId);
  };
}

function bindGlobalActionEvents() {
  document.addEventListener("click", (event) => {
    const mapButton = event.target.closest(".map-link");

    if (mapButton) {
      openMaps(mapButton.dataset.customer);
      return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      handleActionButton(actionButton);
      return;
    }

  });
}

function handleActionButton(button) {
  const action = button.dataset.action;
  const recordId = button.dataset.id;

  if (action === "edit-customer") {
    openCustomerEditForm(recordId);
    return;
  }

  if (action === "archive-customer") {
    archiveCustomer(recordId);
    return;
  }

  if (action === "permanently-delete-customer") {
    permanentlyDeleteCustomer(recordId);
    return;
  }

  if (action === "restore-customer") {
    restoreCustomer(recordId);
    return;
  }

  if (action === "toggle-customer-history") {
    toggleCustomerHistory(recordId, button);
    return;
  }

  if (action === "refresh-customer-history") {
    renderCustomerAuditHistory(recordId);
    return;
  }

  if (action === "edit-appointment") {
    openAppointmentEditForm(recordId);
    return;
  }

  if (action === "delete-appointment") {
    deleteAppointment(recordId);
    return;
  }

  if (action === "create-contact-from-appointment") {
    openActivityFromAppointment(recordId);
    return;
  }

  if (action === "create-appointment-from-followup") {
    openAppointmentFromFollowup(recordId);
    return;
  }

  if (action === "edit-followup") {
    openFollowupEditForm(recordId);
    return;
  }

  if (action === "complete-followup") {
    completeFollowup(recordId);
    return;
  }

  if (action === "reopen-followup") {
    reopenFollowup(recordId);
    return;
  }

  if (action === "delete-followup") {
    deleteFollowup(recordId);
    return;
  }

  if (action === "edit-activity") {
    openActivityEditForm(recordId);
    return;
  }

  if (action === "delete-activity") {
    deleteActivity(recordId);
    return;
  }

  if (action === "open-activity-photos") {
    openActivityPhotos(recordId);
    return;
  }

  if (action === "open-activity-documents") {
    openActivityDocuments(recordId);
    return;
  }

  const customer = customerById(recordId);
  const preset = {
    customerId: recordId,
    owner: customer?.owner || "",
  };

  openForm(action, preset);
}

function bindCreateButtonEvents() {
  $("#quickActivityButton").onclick = $("#newActivityButton").onclick = () =>
    openForm("activity");

  $("#newCustomerButton").onclick = () => openForm("customer");
  $("#newAppointmentButton").onclick = () => openForm("appointment");
  $("#newFollowupButton").onclick = () => openForm("followup");
}

function bindAppointmentEvents() {
  $("#prevWeek").onclick = () => {
    calendarOffset--;
    renderAppointments();
  };

  $("#nextWeek").onclick = () => {
    calendarOffset++;
    renderAppointments();
  };
}

function bindFormEvents() {
  $("#dynamicForm").addEventListener("change", async (event) => {
    if (event.target.classList.contains("photo-input")) {
      try {
        await window.crmPhotoStorage.addPhotoFiles(event.target.files);
        renderPendingPhotoPreviews();
      } catch (error) {
        console.error("Photo selection failed:", error);
        toast(error?.message || "Das Foto konnte nicht ausgewählt werden.");
      } finally {
        event.target.value = "";
      }
      return;
    }

    if (event.target.classList.contains("document-input")) {
      try {
        window.crmDocumentStorage.addDocumentFiles(event.target.files);
        renderPendingDocumentPreviews();
      } catch (error) {
        console.error("Document selection failed:", error);
        toast(error?.message || "Das Dokument konnte nicht ausgewählt werden.");
      } finally {
        event.target.value = "";
      }
    }
  });

  $("#dynamicForm").addEventListener("click", (event) => {
    const removePhotoButton = event.target.closest("[data-remove-pending-photo]");
    if (removePhotoButton) {
      window.crmPhotoStorage.removePendingPhoto(removePhotoButton.dataset.removePendingPhoto);
      renderPendingPhotoPreviews();
      return;
    }

    const removeDocumentButton = event.target.closest("[data-remove-pending-document]");
    if (removeDocumentButton) {
      window.crmDocumentStorage.removePendingDocument(removeDocumentButton.dataset.removePendingDocument);
      renderPendingDocumentPreviews();
      return;
    }

    if (!event.target.classList.contains("open-note")) {
      return;
    }

    activeNoteTarget =
      event.target.parentElement.querySelector("input[type=hidden]");

    const canvas = $("#noteCanvas");
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (activeNoteTarget.value) {
      const image = new Image();

      image.onload = () => context.drawImage(image, 0, 0);
      image.src = activeNoteTarget.value;
    }

    $("#noteDialog").showModal();
  });

  $("#dynamicForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") {
      return;
    }

    event.preventDefault();

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    const saveButton = $("#dialogSaveButton");
    saveButton.disabled = true;

    const saved = await saveForm(form.dataset.type, values, {
      mode: form.dataset.mode,
      recordId: form.dataset.recordId,
      sourceAppointmentId: form.dataset.sourceAppointmentId || "",
      sourceFollowupId: form.dataset.sourceFollowupId || "",
    });

    saveButton.disabled = false;
    saveButton.textContent = form.dataset.mode === "edit" ? "Änderungen speichern" : "Speichern";

    if (saved) {
      $("#formDialog").close();
    }
  });
}


function renderPendingPhotoPreviews() {
  const container = $("#activityPhotoPreview");
  if (!container || !window.crmPhotoStorage) return;

  const photos = window.crmPhotoStorage.getPendingPhotos();
  container.innerHTML = photos.map((photo) => `
    <figure class="photo-preview-card">
      <img src="${photo.previewUrl}" alt="Vorschau ${photo.file.name}">
      <figcaption>
        <strong>${photo.file.name}</strong>
        <span>${window.crmPhotoStorage.formatBytes(photo.file.size)}</span>
      </figcaption>
      <button
        type="button"
        class="photo-remove-button"
        data-remove-pending-photo="${photo.id}"
        aria-label="Foto entfernen"
        title="Foto entfernen"
      >×</button>
    </figure>
  `).join("");
}

function renderPendingDocumentPreviews() {
  const container = $("#activityDocumentPreview");
  if (!container || !window.crmDocumentStorage) return;

  const documents = window.crmDocumentStorage.getPendingDocuments();
  container.innerHTML = documents.map((document) => `
    <div class="document-preview-card">
      <span class="document-icon">📄</span>
      <span class="document-details">
        <strong>${document.file.name}</strong>
        <small>${window.crmDocumentStorage.formatBytes(document.file.size)}</small>
      </span>
      <button
        type="button"
        class="document-remove-button"
        data-remove-pending-document="${document.id}"
        aria-label="Dokument entfernen"
        title="Dokument entfernen"
      >×</button>
    </div>
  `).join("");
}

function bindSearchEvents() {
  $("#globalSearch").onkeydown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    showView("customers");
    $("#customerSearch").value = event.target.value;
    renderCustomers();
  };
}

function bindImportEvents() {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const selectedImportRows = () =>
    pendingImport.filter((row) => row.importable && row.selected);

  const updateImportSelection = () => {
    const importableRows = pendingImport.filter((row) => row.importable);
    const selectedRows = selectedImportRows();
    const skippedCount = pendingImport.length - importableRows.length;
    const counts = pendingImport.reduce((result, row) => {
      result[row.importStatus] = (result[row.importStatus] || 0) + 1;
      return result;
    }, {});

    $("#importSummary").innerHTML =
      `<strong>${pendingImport.length}</strong> Datensätze geprüft · ` +
      `<strong>${importableRows.length}</strong> neu · ` +
      `<strong>${selectedRows.length}</strong> ausgewählt · ` +
      `<strong>${skippedCount}</strong> nicht übernehmbar` +
      (Object.keys(counts).length
        ? `<br><small>${Object.entries(counts)
            .map(([status, count]) => `${status}: ${count}`)
            .join(" · ")}</small>`
        : "");

    const confirmButton = $("#confirmImportButton");
    confirmButton.textContent = `${selectedRows.length} ausgewählte Datensätze übernehmen`;
    confirmButton.disabled = selectedRows.length === 0;

    const selectAll = $("#selectAllImportRows");
    if (selectAll) {
      selectAll.checked =
        importableRows.length > 0 && selectedRows.length === importableRows.length;
      selectAll.indeterminate =
        selectedRows.length > 0 && selectedRows.length < importableRows.length;
      selectAll.disabled = importableRows.length === 0;
    }
  };

  const setImportBusy = (isBusy, message = "", progress = 0) => {
    const overlay = $("#importProgressOverlay");
    const progressBar = $("#importProgressBar");
    const progressText = $("#importProgressText");
    const progressPercent = $("#importProgressPercent");

    if (!overlay) return;

    overlay.classList.toggle("hidden", !isBusy);
    overlay.setAttribute("aria-hidden", String(!isBusy));
    document.body.classList.toggle("import-busy", isBusy);

    if (progressBar) {
      progressBar.value = Math.max(0, Math.min(100, progress));
    }

    if (progressText) {
      progressText.textContent = message;
    }

    if (progressPercent) {
      progressPercent.textContent = `${Math.round(progress)} %`;
    }

    $("#confirmImportButton").disabled = isBusy;
    $("#importButton").disabled = isBusy || !$("#csvFile").files[0];
    $("#csvFile").disabled = isBusy;
    $("#importType").disabled = isBusy;
  };

  const nextAnimationFrame = () =>
    new Promise((resolve) => requestAnimationFrame(resolve));

  const waitForBrowserIdle = () =>
    new Promise((resolve) => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(resolve, { timeout: 2500 });
        return;
      }

      setTimeout(resolve, 50);
    });

  const finishImportRendering = async () => {
    /*
     * Zwei Zeichenzyklen und anschließend eine Leerlaufphase abwarten.
     * Damit bleibt die Fortschrittsanzeige sichtbar, bis Edge die große
     * Tabelle tatsächlich neu berechnet und gezeichnet hat.
     */
    await nextAnimationFrame();
    await nextAnimationFrame();
    await waitForBrowserIdle();
    await nextAnimationFrame();
  };

  const updateAllImportSelections = async (shouldSelect) => {
    const rows = pendingImport.filter((row) => row.importable);
    const checkboxes = [
      ...document.querySelectorAll(".import-row-checkbox:not(:disabled)"),
    ];
    const tableBody = $("#importPreview tbody");

    if (!rows.length) {
      updateImportSelection();
      return;
    }

    const actionText = shouldSelect ? "ausgewählt" : "abgewählt";
    const chunkSize = 200;

    setImportBusy(
      true,
      `Datensätze werden ${actionText} …`,
      0,
    );

    await nextAnimationFrame();

    /*
     * Die sehr große Tabelle wird während der Massenänderung unsichtbar
     * geschaltet. Dadurch muss der Browser nicht nach jedem Block Tausende
     * Tabellenzellen neu zeichnen.
     */
    if (tableBody) {
      tableBody.style.visibility = "hidden";
    }

    try {
      for (let start = 0; start < rows.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, rows.length);

        for (let index = start; index < end; index += 1) {
          rows[index].selected = shouldSelect;

          const checkbox = checkboxes[index];

          if (checkbox) {
            checkbox.checked = shouldSelect;
          }
        }

        /*
         * Die Auswahl selbst belegt 90 Prozent. Die letzten 10 Prozent
         * stehen sichtbar für Zusammenfassung, Layout und Neuzeichnung.
         */
        const progress = (end / rows.length) * 90;

        setImportBusy(
          true,
          `${end.toLocaleString("de-DE")} von ${rows.length.toLocaleString(
            "de-DE",
          )} Datensätzen ${actionText}`,
          progress,
        );

        await nextAnimationFrame();
      }

      setImportBusy(
        true,
        "Auswahl wird ausgewertet …",
        92,
      );

      updateImportSelection();

      setImportBusy(
        true,
        "Vorschau wird aktualisiert …",
        96,
      );

      if (tableBody) {
        tableBody.style.visibility = "";
      }

      /*
       * Erst schließen, wenn Edge die Tabellenansicht wirklich verarbeitet
       * und gezeichnet hat. So entsteht keine scheinbar fertige Oberfläche,
       * die anschließend noch mehrere Sekunden blockiert.
       */
      await finishImportRendering();

      setImportBusy(
        true,
        `${rows.length.toLocaleString("de-DE")} Datensätze wurden ${actionText}.`,
        100,
      );

      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      if (tableBody) {
        tableBody.style.visibility = "";
      }

      setImportBusy(false);
    }
  };

  const bindImportSelectionEvents = () => {
    const selectAll = $("#selectAllImportRows");

    if (selectAll) {
      selectAll.onchange = async () => {
        const shouldSelect = selectAll.checked;

        await updateAllImportSelections(shouldSelect);
      };
    }

    $$(".import-row-checkbox").forEach((checkbox) => {
      checkbox.onchange = () => {
        const row = pendingImport.find(
          (item) => item.id === checkbox.dataset.importId,
        );

        if (row?.importable) row.selected = checkbox.checked;
        updateImportSelection();
      };
    });
  };

  const renderImportPreview = () => {
    const columns = [
      "customerNumber",
      "name",
      "street",
      "zip",
      "city",
      "contact",
      "email",
      "phone",
      "mobile",
      "importStatus",
    ];

    $("#importPreview thead").innerHTML =
      `<tr>` +
      `<th class="import-select-column">` +
      `<label class="import-checkbox-label" title="Alle neuen Datensätze auswählen">` +
      `<input type="checkbox" id="selectAllImportRows" aria-label="Alle neuen Datensätze auswählen">` +
      `<span>Alle</span>` +
      `</label>` +
      `</th>` +
      columns
        .map((column) => `<th>${IMPORT_COLUMN_LABELS[column]}</th>`)
        .join("") +
      `</tr>`;

    $("#importPreview tbody").innerHTML = pendingImport
      .map((row) => {
        const reason = row.importReasons.length
          ? ` title="${escapeHtml(row.importReasons.join("; "))}"`
          : "";

        const checkbox = `
          <td class="import-select-column">
            <input
              class="import-row-checkbox"
              type="checkbox"
              data-import-id="${escapeHtml(row.id)}"
              aria-label="${escapeHtml(row.name)} übernehmen"
              ${row.importable && row.selected ? "checked" : ""}
              ${row.importable ? "" : "disabled"}
            >
          </td>
        `;

        return (
          `<tr class="import-row ${row.importable ? "importable" : "skipped"}">` +
          checkbox +
          columns
            .map((column) => {
              if (column === "importStatus") {
                return `<td${reason}><span class="import-status ${importStatusClass(
                  row[column],
                )}">${escapeHtml(row[column])}</span></td>`;
              }

              return `<td>${escapeHtml(row[column])}</td>`;
            })
            .join("") +
          `</tr>`
        );
      })
      .join("");

    bindImportSelectionEvents();
    updateImportSelection();
  };

  const resetPreview = () => {
    pendingImport = [];
    $("#importPreview thead").innerHTML = "";
    $("#importPreview tbody").innerHTML = "";
    $("#confirmImportButton").classList.add("hidden");
  };

  $("#csvFile").onchange = (event) => {
    const file = event.target.files[0];
    resetPreview();
    $("#fileName").textContent = file ? file.name : "oder hier ablegen";
    $("#importButton").disabled = !file;
    $("#importSummary").textContent = file
      ? "Datei ausgewählt – Vorschau noch nicht geprüft"
      : "Noch keine Datei ausgewählt";
  };

  $("#importButton").onclick = async () => {
    const file = $("#csvFile").files[0];
    if (!file) return;

    const button = $("#importButton");
    button.disabled = true;

    try {
      const text = decodeCSVFile(await file.arrayBuffer());
      const rawRows = parseCSV(text);
      pendingImport = classifyImportRows(
        mapImport(rawRows, $("#importType").value),
      );

      renderImportPreview();
      $("#confirmImportButton").classList.remove("hidden");
    } catch (error) {
      console.error("CSV preview failed:", error);
      resetPreview();
      $("#importSummary").textContent =
        "Die Datei konnte nicht gelesen werden.";
      toast("Die CSV-Datei konnte nicht verarbeitet werden.");
    } finally {
      button.disabled = false;
    }
  };

  $("#confirmImportButton").onclick = async () => {
    const selectedCustomers = selectedImportRows().map(
      ({
        sourceRow,
        importStatus,
        importReasons,
        existingCustomerId,
        importable,
        selected,
        ...customer
      }) => customer,
    );

    if (!selectedCustomers.length) return;

    const button = $("#confirmImportButton");
    button.disabled = true;

    try {
      // Direkt vor dem Schreiben nochmals prüfen. Dadurch werden Kunden,
      // die zwischen Vorschau und Import angelegt wurden, sicher ausgelassen.
      const finalRows = classifyImportRows(
        selectedCustomers.map((customer, index) => ({
          ...customer,
          sourceRow: index + 2,
          selected: true,
        })),
      );

      const finalCustomers = finalRows
        .filter((row) => row.importable && row.selected)
        .map(
          ({
            sourceRow,
            importStatus,
            importReasons,
            existingCustomerId,
            importable,
            selected,
            ...customer
          }) => customer,
        );

      if (!finalCustomers.length) {
        $("#importSummary").textContent =
          "Keine ausgewählten neuen Datensätze mehr vorhanden. Bestehende Kunden wurden nicht verändert.";
        toast("Es wurden keine bestehenden Kunden überschrieben.");
        return;
      }

      await window.crmFirestore.importCustomers(finalCustomers, "imported");
      const skippedAtCommit = selectedCustomers.length - finalCustomers.length;
      pendingImport = [];

      $("#confirmImportButton").classList.add("hidden");
      $("#importSummary").textContent =
        `${finalCustomers.length} ausgewählte Kunden importiert` +
        (skippedAtCommit
          ? ` · ${skippedAtCommit} zwischenzeitlich erkannte Dublette(n) ausgelassen`
          : "");

      toast(`${finalCustomers.length} ausgewählte Kundendatensätze wurden ergänzt.`);
      showView("customers");
    } catch (error) {
      console.error("CSV import failed:", error);
      toast("Der CSV-Import konnte nicht abgeschlossen werden.");
    } finally {
      button.disabled = false;
    }
  };
}

