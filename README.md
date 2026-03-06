#  Coding Protocol

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)

**Coding Protocol** is a full-stack internship and placement platform built for the **Hack'Vento 2026** hackathon. It features a dual-dashboard architecture, providing a seamless application experience for students and a powerful, real-time management system for administrators. 

###  Live Demos
* [Student Portal]_(https://coding-protocol-edf72.web.app/)
* [Admin Portal]_(https://coding-protocol-edf72.web.app/admin-login.html)

> **🔐 Admin Access Credentials (For Evaluation)**
> * **Username:** `admin`
> * **Password:** `admin123`

---

##  Key Features

###  Student Portal
* **Internship Discovery:** Browse and apply for available technical roles.
* **Smart Resume Matcher:** A lightweight, simulated "AI Match" system that calculates a compatibility score before allowing students to apply, ensuring minimum requirements are met.
* **Interactive Career Bot:** An integrated chat interface designed to answer basic student queries and guide them through the platform.
* **Immersive UI:** Built with custom glassmorphism components, CSS grid systems, and animated background orbs for a modern, tech-forward aesthetic.

###  Admin Dashboard
* **Secure Access:** Dedicated login portal to protect sensitive application data.
* **Real-Time Data Sync:** Powered by Firebase Firestore, ensuring applications appear on the dashboard the moment they are submitted.
* **Application Management:** Review candidate details (CGPA, Branch, LinkedIn, etc.) and update statuses to `Approved`, `Rejected`, or `Pending` with a single click.
* **Live Analytics & Search:** Dynamic stat cards track total applications and current statuses. A real-time search bar filters candidates instantly by name, email, or role.
* **Data Export:** Built-in tool to export the entire application database to a CSV file for offline review.

##  Technologies Used

* **Frontend:** HTML5, Custom CSS3 (CSS Variables, Flexbox/Grid, Glassmorphism), JavaScript (ES6+)
* **Backend & Database:** Firebase Firestore (NoSQL Document Database)
* **Architecture:** Modular JS with Firebase v12 SDK

##  Project Structure

* `index.html` & `script.js`: The main student-facing landing page, resume validation logic, and chatbot.
* `admin-login.html` & `admin-login.js`: The authentication gateway for the administrative panel.
* `admin.html` & `admin.js`: The core admin dashboard handling Firestore `getDocs`, `updateDoc`, and `deleteDoc` operations.
* `style.css`: The global design system handling all UI components, responsive media queries, and animations across both portals.
* `firebase.js`: Centralized configuration and initialization for the Firebase backend.

