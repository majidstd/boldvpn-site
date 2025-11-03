# BoldVPN Site (Standalone)

Static marketing + portal login UI for BoldVPN. Ready for GitHub Pages from the repository root.

## Files
- `index.html` — Landing page
- `login.html` — Portal login page (posts to OPNsense)
- `status.html` — Post-login status page
- `styles.css` — Styles
- `script.js` — Small JS + config
- `assets/` — Logos/Favicon

## Configure Captive Portal Endpoint
Edit `script.js` and set:

```js
window.BOLDVPN_CONFIG = {
  captivePortalLoginUrl: 'https://login.boldvpn.net/captiveportal/index.php?zone=YourZone'
};
```

## Publish on GitHub Pages
1. Create a new GitHub repository (e.g., `boldvpn-site`).
2. Copy these files into the repo root and push.
3. In the repo: Settings → Pages → Build and deployment → Source: Deploy from branch → main → /(root).
4. Add Custom domain(s): `www.boldvpn.net` (and/or `login.boldvpn.net`).

## DNS (Registrar)
- `CNAME www` → `<your-username>.github.io`
- `CNAME login` → `<your-username>.github.io`
- Optional Apex: `boldvpn.net` → ALIAS/ANAME to `<your-username>.github.io` (or GitHub Pages A records)


