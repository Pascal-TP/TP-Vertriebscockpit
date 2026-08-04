import { crmAuth, blazeFunctions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";

const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods", "odp"
]);

let pendingDocuments = [];

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileExtension(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

function resetPendingDocuments() {
  pendingDocuments = [];
}

function getPendingDocuments() {
  return [...pendingDocuments];
}

function removePendingDocument(documentId) {
  pendingDocuments = pendingDocuments.filter((item) => item.id !== documentId);
}

function addDocumentFiles(fileList) {
  const files = [...(fileList || [])];
  const available = MAX_DOCUMENTS - pendingDocuments.length;
  if (files.length > available) {
    throw new Error(`Pro Speichervorgang sind maximal ${MAX_DOCUMENTS} neue Dokumente möglich.`);
  }

  files.forEach((file) => {
    const extension = fileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error(`${file.name}: Dieser Dateityp ist nicht erlaubt.`);
    }
    if (!file.size || file.size > MAX_FILE_SIZE) {
      throw new Error(`${file.name}: Die Datei ist leer oder größer als 10 MB.`);
    }

    pendingDocuments.push({
      id: `PENDING-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
    });
  });

  return getPendingDocuments();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error(`Die Datei ${file.name} konnte nicht gelesen werden.`));
    reader.readAsDataURL(file);
  });
}

async function currentIdToken() {
  const user = crmAuth.currentUser;
  if (!user) throw new Error("Für den Dokumentenupload ist eine Anmeldung erforderlich.");
  return user.getIdToken();
}

async function uploadPendingDocuments(activityId, onProgress = () => {}) {
  if (!pendingDocuments.length) return [];

  const uploadDocument = httpsCallable(blazeFunctions, "uploadCrmActivityDocument");
  const idToken = await currentIdToken();
  const uploaded = [];

  try {
    for (let index = 0; index < pendingDocuments.length; index += 1) {
      const item = pendingDocuments[index];
      onProgress(index + 1, pendingDocuments.length, item.file.name);
      const base64Data = await fileToBase64(item.file);
      const result = await uploadDocument({
        idToken,
        activityId,
        fileName: item.file.name,
        contentType: item.file.type || "application/octet-stream",
        base64Data,
      });
      uploaded.push(result.data.document);
    }
    resetPendingDocuments();
    return uploaded;
  } catch (error) {
    console.error("CRM document upload failed:", error);
    throw new Error(error?.message || "Mindestens ein Dokument konnte nicht hochgeladen werden.");
  }
}

async function getDocumentUrls(documents) {
  if (!Array.isArray(documents) || !documents.length) return [];
  const getUrls = httpsCallable(blazeFunctions, "getCrmActivityDocumentUrls");
  const idToken = await currentIdToken();
  const result = await getUrls({
    idToken,
    paths: documents.map((document) => document.path).filter(Boolean),
  });
  const filesByPath = new Map((result.data.files || []).map((file) => [file.path, file]));
  return documents.map((document) => ({
    ...document,
    url: filesByPath.get(document.path)?.url || "",
    downloadName: filesByPath.get(document.path)?.fileName || document.name || "Dokument",
  }));
}

window.crmDocumentStorage = {
  MAX_DOCUMENTS,
  addDocumentFiles,
  formatBytes,
  getDocumentUrls,
  getPendingDocuments,
  removePendingDocument,
  resetPendingDocuments,
  uploadPendingDocuments,
};
