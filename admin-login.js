document.addEventListener('DOMContentLoaded', () => {
  const userEl   = document.getElementById('adminUser');
  const passEl   = document.getElementById('adminPass');
  const loginBtn = document.getElementById('loginBtn');
  const eyeBtn   = document.getElementById('eyeBtn');
  const errEl    = document.getElementById('errorMsg');

  eyeBtn.addEventListener('click', () => {
    passEl.type = passEl.type === 'password' ? 'text' : 'password';
  });
  [userEl, passEl].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') login(); })
  );
  loginBtn.addEventListener('click', login);

  function login() {
    errEl.textContent = '';
    const u = userEl.value.trim();
    const p = passEl.value.trim();
    if (!u || !p) { errEl.textContent = 'Please enter username and password.'; return; }
    if (u === 'admin' && p === 'admin123') {
      sessionStorage.setItem('adminLoggedIn', 'true');
      window.location.href = 'admin.html';
    } else {
      errEl.textContent = 'Invalid username or password.';
      passEl.value = '';
      passEl.focus();
    }
  }
});
