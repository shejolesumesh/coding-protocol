
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiaDI9s9YyOpkqwf66zJ-vgtuhI9yoFD4",
  authDomain: "coding-protocol-edf72.firebaseapp.com",
  projectId: "coding-protocol-edf72",
  storageBucket: "coding-protocol-edf72.firebasestorage.app",
  messagingSenderId: "545264613326",
  appId: "1:545264613326:web:b05ebb7b67dcbb73c51d9f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
