import { crmAuth, blazeFunctions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";

const MAX_PHOTOS = 8;
const MAX_SOURCE_SIZE = 20 * 1024 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

let pendingPhotos = [];
let objectUrls = [];

function revokeObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function resetPendingPhotos() {
  revokeObjectUrls();
  pendingPhotos = [];
}

function getPendingPhotos() {
  return [...pendingPhotos];
}

function removePendingPhoto(photoId) {
  const photo = pendingPhotos.find((item) => item.id === photoId);
  if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
  pendingPhotos = pendingPhotos.filter((item) => item.id !== photoId);
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Das Foto konnte nicht verarbeitet werden.")),
      type,
      quality,
    );
  });
}

async function loadImage(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Das Foto konnte nicht gelesen werden."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function preparePhoto(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name}: Es sind nur Bilddateien erlaubt.`);
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error(`${file.name}: Das Ausgangsbild ist größer als 20 MB.`);
  }

  const image = await loadImage(file);
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(image, 0, 0, width, height);
  image.close?.();

  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  const baseName = String(file.name || "foto").replace(/\.[^.]+$/, "");
  const uploadFile = new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  const previewUrl = URL.createObjectURL(uploadFile);
  objectUrls.push(previewUrl);

  return {
    id: `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file: uploadFile,
    previewUrl,
    originalName: file.name,
    width,
    height,
  };
}

async function addPhotoFiles(fileList) {
  const files = [...(fileList || [])];
  const available = MAX_PHOTOS - pendingPhotos.length;
  if (files.length > available) {
    throw new Error(`Pro Speichervorgang sind maximal ${MAX_PHOTOS} neue Fotos möglich.`);
  }

  for (const file of files) {
    pendingPhotos.push(await preparePhoto(file));
  }
  return getPendingPhotos();
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
  if (!user) throw new Error("Für den Foto-Upload ist eine Anmeldung erforderlich.");
  return user.getIdToken();
}

async function uploadPendingPhotos(activityId, onProgress = () => {}) {
  if (!pendingPhotos.length) return [];

  const uploadPhoto = httpsCallable(blazeFunctions, "uploadCrmActivityPhoto");
  const idToken = await currentIdToken();
  const uploaded = [];

  try {
    for (let index = 0; index < pendingPhotos.length; index += 1) {
      const item = pendingPhotos[index];
      onProgress(index + 1, pendingPhotos.length, item.file.name);
      const base64Data = await fileToBase64(item.file);
      const result = await uploadPhoto({
        idToken,
        activityId,
        fileName: item.file.name,
        contentType: item.file.type,
        base64Data,
        width: item.width,
        height: item.height,
      });
      uploaded.push(result.data.photo);
    }
    resetPendingPhotos();
    return uploaded;
  } catch (error) {
    console.error("CRM photo upload failed:", error);
    throw new Error(error?.message || "Mindestens ein Foto konnte nicht hochgeladen werden.");
  }
}

async function getPhotoUrls(photos) {
  if (!Array.isArray(photos) || !photos.length) return [];
  const getUrls = httpsCallable(blazeFunctions, "getCrmActivityPhotoUrls");
  const idToken = await currentIdToken();
  const result = await getUrls({
    idToken,
    paths: photos.map((photo) => photo.path).filter(Boolean),
  });
  const urlsByPath = new Map((result.data.files || []).map((file) => [file.path, file.url]));
  return photos.map((photo) => ({ ...photo, url: urlsByPath.get(photo.path) || "" }));
}

window.crmPhotoStorage = {
  MAX_PHOTOS,
  addPhotoFiles,
  formatBytes,
  getPendingPhotos,
  getPhotoUrls,
  removePendingPhoto,
  resetPendingPhotos,
  uploadPendingPhotos,
};
