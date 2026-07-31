import { crmAuth } from "./firebase.js";
import { loadCurrentUserProfile, startAllDataSync } from "./firestore.js";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const rememberLogin = document.querySelector("#rememberLogin");
const loginMessage = document.querySelector("#loginMessage");
const loginButton = document.querySelector("#loginButton");
const passwordResetButton = document.querySelector("#passwordResetButton");
const logoutButton = document.querySelector("#logoutButton");
const currentUserName = document.querySelector("#currentUserName");
const currentUserEmail = document.querySelector("#currentUserEmail");
const userAvatar = document.querySelector("#userAvatar");
const loadingOverlay = document.querySelector("#loadingOverlay");
const connectionStatus = document.querySelector("#connectionStatus");

let authStateResolved = false;

function setLoginBusy(isBusy) {
  loginButton.disabled = isBusy;
  loginEmail.disabled = isBusy;
  loginPassword.disabled = isBusy;
  rememberLogin.disabled = isBusy;

  loginButton.textContent = isBusy ? "Anmeldung läuft …" : "Anmelden";
}

function showLoginMessage(message, type = "error") {
  loginMessage.textContent = message;
  loginMessage.dataset.type = type;
}

function clearLoginMessage() {
  loginMessage.textContent = "";
  delete loginMessage.dataset.type;
}

function friendlyAuthMessage(error) {
  const knownMessages = {
    "auth/invalid-credential":
      "E-Mail-Adresse oder Passwort ist nicht korrekt.",
    "auth/invalid-email":
      "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    "auth/missing-password":
      "Bitte geben Sie Ihr Passwort ein.",
    "auth/too-many-requests":
      "Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.",
    "auth/network-request-failed":
      "Die Verbindung zu Firebase konnte nicht hergestellt werden.",
    "auth/user-disabled":
      "Dieses Benutzerkonto wurde deaktiviert.",
  };

  return (
    knownMessages[error?.code] ||
    "Die Anmeldung ist fehlgeschlagen. Bitte prüfen Sie Ihre Eingaben."
  );
}

function userDisplayName(user) {
  if (user.displayName) {
    return user.displayName;
  }

  const emailName = String(user.email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  return emailName
    ? emailName.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Angemeldeter Benutzer";
}

function initials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "TP";
}

async function showAuthenticatedApp(user) {
  const displayName = userDisplayName(user);

  currentUserName.textContent = displayName;
  currentUserEmail.textContent = user.email || "";
  userAvatar.textContent = initials(displayName);

  loginScreen.classList.add("auth-hidden");
  appShell.classList.remove("auth-hidden");
  loadingOverlay.classList.remove("auth-hidden");

  try {
    const profile = await loadCurrentUserProfile(user.uid);

    if (profile.active === false) {
      throw new Error("Dieses Benutzerprofil wurde deaktiviert.");
    }

    window.crmCurrentUserProfile = profile;
    window.dispatchEvent(
      new CustomEvent("crm-role-ready", { detail: { user, profile } }),
    );

    await startAllDataSync();

    loadingOverlay.classList.add("auth-hidden");
    window.dispatchEvent(
      new CustomEvent("crm-auth-ready", { detail: { user } }),
    );
  } catch (error) {
    loadingOverlay.classList.add("auth-hidden");
    console.error("Firestore initialization failed:", error);
    appShell.classList.add("auth-hidden");
    loginScreen.classList.remove("auth-hidden");
    showLoginMessage(
      error?.message ||
      "Die zentrale CRM-Datenbank konnte nicht geladen werden. Bitte prüfen Sie das Rollenprofil, die Firestore-Regeln und die Internetverbindung.",
    );
  }
}

function showLogin() {
  appShell.classList.add("auth-hidden");
  loginScreen.classList.remove("auth-hidden");

  loginPassword.value = "";
  setLoginBusy(false);

  if (authStateResolved) {
    loginEmail.focus();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginMessage();
  setLoginBusy(true);

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  const persistence = rememberLogin.checked
    ? browserLocalPersistence
    : browserSessionPersistence;

  try {
    await setPersistence(crmAuth, persistence);
    await signInWithEmailAndPassword(crmAuth, email, password);
  } catch (error) {
    console.error("Firebase login failed:", error);
    showLoginMessage(friendlyAuthMessage(error));
    setLoginBusy(false);
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await signOut(crmAuth);
  } catch (error) {
    console.error("Firebase logout failed:", error);
    window.alert("Die Abmeldung konnte nicht abgeschlossen werden.");
  } finally {
    logoutButton.disabled = false;
  }
});

passwordResetButton.addEventListener("click", async () => {
  clearLoginMessage();

  const email = loginEmail.value.trim();

  if (!email) {
    showLoginMessage(
      "Bitte tragen Sie zuerst Ihre E-Mail-Adresse ein.",
    );
    loginEmail.focus();
    return;
  }

  passwordResetButton.disabled = true;

  try {
    await sendPasswordResetEmail(crmAuth, email);

    showLoginMessage(
      "Die E-Mail zum Zurücksetzen des Passworts wurde versendet.",
      "success",
    );
  } catch (error) {
    console.error("Password reset failed:", error);

    if (error?.code === "auth/invalid-email") {
      showLoginMessage("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
    } else {
      /*
       * Bewusst neutral formuliert, damit nicht erkennbar ist,
       * ob eine Adresse als Benutzer registriert ist.
       */
      showLoginMessage(
        "Die Anfrage konnte nicht abgeschlossen werden. Bitte versuchen Sie es später erneut.",
      );
    }
  } finally {
    passwordResetButton.disabled = false;
  }
});


function updateConnectionStatus() {
  const online = navigator.onLine;

  if (!connectionStatus) return;

  connectionStatus.dataset.state = online ? "online" : "offline";
  connectionStatus.querySelector("strong").textContent =
    online ? "Online" : "Offline";

  if (!online) {
    toast?.("Keine Internetverbindung. Änderungen sind derzeit nicht möglich.");
  }
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
window.addEventListener("crm-connection-error", () => {
  if (!connectionStatus) return;
  connectionStatus.dataset.state = "error";
  connectionStatus.querySelector("strong").textContent = "Verbindungsfehler";
});
updateConnectionStatus();

onAuthStateChanged(crmAuth, (user) => {
  authStateResolved = true;

  if (user) {
    clearLoginMessage();
    showAuthenticatedApp(user);
    return;
  }

  showLogin();
});
