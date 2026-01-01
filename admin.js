// 🔹 FIRESTORE IMPORTS (TOP)
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import { db } from "./firebase.js";

// 🔐 AUTH CHECK
if (sessionStorage.getItem("adminLoggedIn") !== "true") {
  window.location.replace("admin-login.html");
}

// 📋 TABLE
const table = document.getElementById("appTable");

// 🔄 LOAD DATA FROM FIREBASE
async function loadApplications() {
  const snapshot = await getDocs(collection(db, "applications"));

  if (snapshot.empty) {
    table.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center; padding:20px;">
          ❌ No applications found
        </td>
      </tr>
    `;
    return;
  }

  snapshot.forEach(docSnap => {
    const app = docSnap.data();
    const row = document.createElement("tr");

   row.innerHTML = `
  <td>${app.name}</td>
  <td>${app.email}</td>
  <td>${app.collegeName}</td>
  <td>${app.contact}</td>
  <td>${app.linkedin}</td>
  <td>${app.branch}</td>
  <td>${app.year}</td>
  <td>${app.cgpa}</td>
  <td>${app.role}</td>
  <td>${app.date}</td>
  <td>${app.status || "pending"}</td>

  <td style="display:flex;flex-direction:column;gap:6px;">
    <button class="resume-btn" onclick="viewResume()">
      📄 View Resume
    </button>

    <button onclick="updateStatus('${docSnap.id}','approved')"
      style="background:#22c55e;color:white;">
      ✅ Approve
    </button>

    <button onclick="updateStatus('${docSnap.id}','rejected')"
      style="background:#ef4444;color:white;">
      ❌ Reject
    </button>
  </td>
`;

    

    table.appendChild(row);
  });
}

loadApplications();

// 🗑 CLEAR ALL FROM FIREBASE
window.clearApplications = function () {
  showPopup(
    "⚠️ Confirm Action",
    "Are you sure you want to delete all applications?",
    async () => {
      const snapshot = await getDocs(collection(db, "applications"));
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, "applications", docSnap.id));
      }
      location.reload();
    },
    true
  );
};



window.logoutAdmin = function () {
  sessionStorage.removeItem("adminLoggedIn");
  window.location.href = "admin-login.html";
};

window.updateStatus = async function (docId, newStatus) {
  await updateDoc(doc(db, "applications", docId), {
    status: newStatus
  });

  showPopup(
    "✅ Status Updated",
    `Application marked as ${newStatus.toUpperCase()}`
  );
};

window.viewResume = function () {
  showPopup(
    "📄 Resume Viewer",
    "Resume preview feature will come in a future update 🚀"
  );
};
window.showPopup = function (title, message, onOk, showCancel = false) {
  const modal = document.getElementById("globalModal");
  const titleEl = document.getElementById("modalTitle");
  const msgEl = document.getElementById("modalMessage");
  const okBtn = document.getElementById("modalOk");
  const cancelBtn = document.getElementById("modalCancel");

  titleEl.textContent = title;
  msgEl.textContent = message;

  modal.style.display = "flex";

  cancelBtn.style.display = showCancel ? "inline-block" : "none";

  okBtn.onclick = () => {
    modal.style.display = "none";
    if (onOk) onOk();
  };

  cancelBtn.onclick = () => {
    modal.style.display = "none";
  };
};


