import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";

/*
 * Hauptprojekt des Vertriebscockpits
 * Verwendung in diesem Ausbauschritt:
 * - Firebase Authentication
 *
 * Später:
 * - Cloud Firestore
 */
const crmConfig = {
  apiKey: "AIzaSyDNXS9eyD6L-krRc6zRRYn51EVbYgytajE",
  authDomain: "tp-vertriebscockpit.firebaseapp.com",
  projectId: "tp-vertriebscockpit",
  storageBucket: "tp-vertriebscockpit.firebasestorage.app",
  messagingSenderId: "90653631173",
  appId: "1:90653631173:web:9223a7e4fcca6529cf06ac",
  measurementId: "G-69JSZ1FKLS",
};

/*
 * Zentrales Blaze-Projekt
 *
 * Dieses Projekt wird später ausschließlich für Funktionen und Dateien genutzt.
 * Im CRM-Projekt selbst wird kein Firebase Storage verwendet.
 */
const blazeConfig = {
  apiKey: "AIzaSyCcHI5sGR7sFwrWRpo2uQ3Plm0HpTvqr30",
  authDomain: "kalkpro-4cc29.firebaseapp.com",
  projectId: "kalkpro-4cc29",
  storageBucket: "kalkpro-4cc29.firebasestorage.app",
  messagingSenderId: "185447466021",
  appId: "1:185447466021:web:e0d0720fae971b4ab52bcc",
  measurementId: "G-V4SF92V16K",
};

const crmApp = initializeApp(crmConfig);
const crmAuth = getAuth(crmApp);
const crmDb = getFirestore(crmApp);

/*
 * Benannte zweite App. Noch werden weder Storage noch Functions importiert.
 * Damit entstehen in diesem Schritt keine Zugriffe auf den Blaze-Storage.
 */
const blazeApp = initializeApp(blazeConfig, "kalkproBlaze");
const blazeFunctions = getFunctions(blazeApp, "europe-west1");

export {
  crmApp,
  crmAuth,
  crmDb,
  blazeApp,
  blazeFunctions,
};
