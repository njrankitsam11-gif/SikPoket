// dashboard-init.js — runs before app.js to ensure a user session exists.
// Moved out of dashboard/index.html inline script to comply with Chrome MV3 CSP.
(function () {
  var u = sessionStorage.getItem('sikpoket_user');
  if (!u) {
    sessionStorage.setItem('sikpoket_user', 'guest');
  }
})();
