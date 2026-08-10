"use strict";

let pendingRevenueImport = [];

function normalizeRevenueInput(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "").trim().replace(/\s/g, "").replace(/€/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function formatRevenue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(number);
}

function normalizedCustomerNumberForRevenue(value) {
  return String(value || "").trim().toLowerCase();
}

function mapRevenueImport(rows) {
  return rows.map((row, index) => {
    const customerNumber = importValue(row, ["Kundennummer", "Kunden-Nr", "Kunden-Nr.", "Kdnr"]);
    const csvName = importValue(row, ["Name", "Kundenname", "Kunde", "Firma"]);
    const revenueText = importValue(row, ["Umsatz", "Umsatz EUR", "Umsatz (€)", "Revenue"]);
    const revenue = normalizeRevenueInput(revenueText);
    const normalized = normalizedCustomerNumberForRevenue(customerNumber);
    const matches = data.customers.filter((customer) => normalizedCustomerNumberForRevenue(customer.customerNumber) === normalized);
    return {
      sourceRow: index + 2, customerNumber, csvName, revenueText, revenue,
      customer: matches.length === 1 ? matches[0] : null,
      status: !customerNumber ? "Kundennummer fehlt" : matches.length === 1 ? "Zugeordnet" : matches.length > 1 ? "Mehrfach vorhanden" : "Nicht gefunden",
    };
  }).filter((row) => row.customerNumber || row.csvName || row.revenueText);
}

function renderRevenueImportPreview() {
  const table = $("#revenueImportPreview");
  table.querySelector("thead").innerHTML = "<tr><th>Zeile</th><th>Kundennummer</th><th>Name CSV</th><th>Kunde im CRM</th><th>Umsatz</th><th>Prüfung</th></tr>";
  table.querySelector("tbody").innerHTML = pendingRevenueImport.map((row) => `<tr><td>${row.sourceRow}</td><td>${row.customerNumber || "–"}</td><td>${row.csvName || "–"}</td><td>${row.customer?.name || "–"}</td><td>${formatRevenue(row.revenue)}</td><td><span class="import-status ${row.status === "Zugeordnet" ? "new" : "duplicate"}">${row.status}</span></td></tr>`).join("");
  const matched = pendingRevenueImport.filter((row) => row.customer).length;
  $("#revenueImportSummary").textContent = `${pendingRevenueImport.length} Zeilen geprüft · ${matched} zugeordnet · ${pendingRevenueImport.length - matched} nicht übernommen`;
  $("#confirmRevenueImportButton").classList.toggle("hidden", matched === 0);
}

function bindRevenueImportEvents() {
  const fileInput = $("#revenueCsvFile");
  if (!fileInput) return;
  $("#revenueImportAsOf").value ||= new Date().toISOString().slice(0, 10);
  fileInput.onchange = () => { const file = fileInput.files?.[0]; $("#revenueFileName").textContent = file?.name || "oder hier ablegen"; $("#previewRevenueImportButton").disabled = !file; };
  $("#previewRevenueImportButton").onclick = async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    try { pendingRevenueImport = mapRevenueImport(parseCSV(decodeCSVFile(await file.arrayBuffer()))); renderRevenueImportPreview(); }
    catch (error) { console.error(error); toast("Die Umsatz-CSV konnte nicht verarbeitet werden."); }
  };
  $("#confirmRevenueImportButton").onclick = async () => {
    const updates = pendingRevenueImport.filter((row) => row.customer);
    if (!updates.length) return;
    const button = $("#confirmRevenueImportButton"); button.disabled = true;
    try { await window.crmFirestore.importCustomerRevenues(updates, $("#revenueImportAsOf").value); toast(`${updates.length} Umsatzzahlen wurden aktualisiert.`); pendingRevenueImport=[]; button.classList.add("hidden"); $("#revenueImportSummary").textContent="Umsatzimport abgeschlossen."; $("#revenueImportPreview tbody").innerHTML=""; }
    catch(error){ console.error(error); toast("Der Umsatzimport konnte nicht abgeschlossen werden."); }
    finally { button.disabled=false; }
  };
}

function revenueOwnerOptions() {
  return [...new Set(data.customers.filter(c=>c.archived!==true).map(c=>String(c.owner||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
}
function fillRevenueOwnerSelect() {
  const select=$("#revenueExportOwner"); if(!select) return;
  const previous=select.value; const profile=window.crmCurrentUserProfile||{}; const names=revenueOwnerOptions();
  select.innerHTML=(isAdmin()?'<option value="all">Alle Außendienstmitarbeiter</option>':'')+names.map(n=>`<option value="${n}">${n}</option>`).join("");
  const preferred=names.find(n=>n.toLowerCase()===String(profile.displayName||profile.name||"").toLowerCase());
  select.value = names.includes(previous) ? previous : preferred || (isAdmin()?"all":names[0]||"");
}
function customersForRevenueRanking(){ const owner=$("#revenueExportOwner")?.value||""; return data.customers.filter(c=>c.archived!==true && Number(c.revenue)>0 && (owner==="all" || c.owner===owner)).sort((a,b)=>Number(b.revenue||0)-Number(a.revenue||0) || String(a.name||"").localeCompare(String(b.name||""),"de")); }
function renderRevenueRankingCount(){ const el=$("#revenueExportCount"); if(el) el.textContent=`${customersForRevenueRanking().length} Kunden mit Umsatz`; }
async function exportRevenueRanking(){ const customers=customersForRevenueRanking(); if(!customers.length){toast("Für diese Auswahl sind keine Umsätze vorhanden.");return;} const owner=$("#revenueExportOwner").value; downloadCsvFile(`umsatz-rangliste-${String(owner||"alle").toLowerCase().replace(/[^a-z0-9]+/gi,"-")}-${exportFileDate()}.csv`,["Rang","Kundennummer","Kunde","Straße","PLZ","Ort","Außendienst","Umsatz","Stand"],customers.map((c,i)=>[i+1,c.customerNumber||"",c.name||"",c.street||"",c.zip||"",c.city||"",c.owner||"",Number(c.revenue||0).toFixed(2).replace(".",","),csvExportDate(c.revenueAsOf)])); await logCsvExport("Umsatz-Rangliste",customers.length,{owner}); toast(`${customers.length} Kunden wurden als Umsatz-Rangliste exportiert.`); }

document.addEventListener("DOMContentLoaded", bindRevenueImportEvents);
window.addEventListener("crm-role-ready", ()=>{fillRevenueOwnerSelect();renderRevenueRankingCount();});
window.addEventListener("crm-data-updated", ()=>{fillRevenueOwnerSelect();renderRevenueRankingCount();});
