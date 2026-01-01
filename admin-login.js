document.addEventListener("DOMContentLoaded", () => {
  const eyeBtn = document.getElementById("eyeBtn");
  const pass = document.getElementById("adminPass");
  const loginBtn = document.getElementById("loginBtn");
  const errorMsg = document.getElementById("errorMsg");
  const adminUser = document.getElementById("adminUser");

  eyeBtn.onclick = () => {
    pass.type = pass.type === "password" ? "text" : "password";
  };

  loginBtn.onclick = () => {
    const user = adminUser.value.trim();
    const pwd = pass.value.trim();

    if (user === "admin" && pwd === "admin123") {
      sessionStorage.setItem("adminLoggedIn", "true");
      window.location.href = "admin.html";
    } else {
      errorMsg.textContent = "Username or password is wrong";
    }
  };
});

