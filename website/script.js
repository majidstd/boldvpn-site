window.BOLDVPN_CONFIG = Object.assign(
  {
    captivePortalLoginUrl: ''
  },
  window.BOLDVPN_CONFIG || {}
);

(function () {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var toggle = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
  }
})();


