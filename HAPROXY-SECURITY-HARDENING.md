# HAProxy Security Hardening Guide

Advanced TLS/SSL security configuration for HAProxy on OPNsense.

## 🔒 Maximum TLS Security

This guide shows how to configure HAProxy with the most secure TLS settings for production use.

---

## 📋 Prerequisites

- [x] HAProxy installed and working
- [x] SSL certificate configured
- [x] Basic HAProxy configuration complete
- [x] API accessible via HTTPS

---

## 🛡️ Secure TLS Configuration

### Option 1: Maximum Security (Recommended for Production)

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services → `api_https`

**Advanced settings → Option pass-through:**

Add these lines (in addition to existing options):

```
ssl-min-ver TLSv1.2
ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384
ssl-default-bind-ciphersuites TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256
ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets
```

**Complete option pass-through should now have:**
```
http-request set-header X-Forwarded-Proto https
ssl-min-ver TLSv1.2
ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384
ssl-default-bind-ciphersuites TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256
ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets
```

Click **Save** → **Apply Changes**

---

### Option 2: Simplified Secure (Good Balance)

If the above is too complex, use this simpler version:

**Advanced settings → Option pass-through:**

```
http-request set-header X-Forwarded-Proto https
ssl-min-ver TLSv1.2
```

This:
- ✅ Blocks insecure TLS 1.0 and 1.1
- ✅ Allows secure TLS 1.2 and 1.3
- ✅ Uses HAProxy's default strong ciphers
- ✅ Good for most production use cases

Click **Save** → **Apply Changes**

---

## 📖 What Each Setting Does

### `ssl-min-ver TLSv1.2`

**Purpose:** Minimum TLS version allowed

**Effect:**
- ✅ Allows: TLS 1.2, TLS 1.3
- ❌ Blocks: TLS 1.0, TLS 1.1, SSLv3

**Why:**
- TLS 1.0/1.1 have known vulnerabilities
- PCI DSS requires TLS 1.2 minimum
- Modern standard

**Compatibility:**
- ✅ All modern browsers (2015+)
- ✅ iOS 5+, Android 4.4+
- ❌ IE 10 and older, Android 4.3 and older

---

### `ssl-default-bind-ciphers`

**Purpose:** Cipher suites for TLS 1.2

**Effect:** Only allows strong, modern ciphers with:
- ✅ ECDHE (Elliptic Curve Diffie-Hellman Ephemeral) - Perfect Forward Secrecy
- ✅ AES-GCM (Authenticated Encryption)
- ✅ ChaCha20-Poly1305 (Modern, fast cipher)
- ❌ No RC4, DES, 3DES, MD5 (weak ciphers)

**Why:**
- Perfect Forward Secrecy (PFS) - past sessions can't be decrypted even if private key is compromised
- Authenticated encryption prevents tampering
- Fast and secure

---

### `ssl-default-bind-ciphersuites`

**Purpose:** Cipher suites for TLS 1.3

**Effect:** Only allows TLS 1.3 strong ciphers:
- AES-128-GCM
- AES-256-GCM
- ChaCha20-Poly1305

**Why:**
- TLS 1.3 is the latest, most secure version
- Built-in Perfect Forward Secrecy
- Faster handshake
- Removes legacy cipher support

---

### `no-tls-tickets`

**Purpose:** Disable TLS session tickets

**Effect:** 
- ✅ Better Perfect Forward Secrecy
- ✅ Prevents session resumption attacks
- ❌ Slightly slower (clients must do full handshake)

**Why:**
- TLS tickets can weaken PFS if not rotated properly
- More secure to disable for sensitive applications
- Small performance tradeoff for better security

---

## 🧪 Testing Secure TLS

### Test 1: Force TLS 1.2

```bash
curl --tlsv1.2 https://api.boldvpn.net/api/health
```

**Should work:** ✅

### Test 2: Try Old TLS 1.0 (Should Fail!)

```bash
curl --tlsv1.0 https://api.boldvpn.net/api/health
```

**Should fail with:** `protocol version` error ✅ (This is good! Old TLS blocked!)

### Test 3: Browser Test

Open browser: `https://api.boldvpn.net/api/health`

**Should work fine!** All modern browsers support TLS 1.2+

### Test 4: SSL Labs Test

Visit: https://www.ssllabs.com/ssltest/

Enter: `api.boldvpn.net`

**Expected results with secure config:**
- **Grade: A or A+**
- Protocol Support: TLS 1.2, TLS 1.3 only
- Cipher Strength: Strong (256-bit or 128-bit AES-GCM)
- Perfect Forward Secrecy: Yes
- Certificate: Valid

**This verifies your TLS configuration is production-ready!**

---

## 📊 Security Comparison

### Default HAProxy TLS

**Without hardening:**
- TLS 1.0, 1.1, 1.2, 1.3 all allowed
- Some weak ciphers allowed
- TLS tickets enabled
- Grade: B or C on SSL Labs

**Risk:**
- Vulnerable to downgrade attacks
- Older protocols have known vulnerabilities
- Not PCI DSS compliant

### Hardened TLS (What We Configure)

**With hardening:**
- TLS 1.2 and 1.3 only
- Strong ciphers only (AES-GCM, ChaCha20)
- Perfect Forward Secrecy
- TLS tickets disabled
- Grade: A or A+ on SSL Labs

**Benefits:**
- ✅ PCI DSS compliant
- ✅ HIPAA compliant
- ✅ Prevents known attacks
- ✅ Future-proof
- ✅ Industry best practices

---

## 🎯 Recommended Configuration

### For Production (Recommended)

Use **Option 2 (Simplified Secure)**:

```
ssl-min-ver TLSv1.2
```

**Why:**
- ✅ Blocks insecure TLS 1.0/1.1
- ✅ Simple to implement
- ✅ Good compatibility
- ✅ Sufficient for most use cases

### For Maximum Security

Use **Option 1 (Maximum Security)** if you need:
- PCI DSS compliance
- HIPAA compliance
- Maximum security rating
- Custom cipher selection

---

## 🔧 Troubleshooting TLS Issues

### Old Clients Can't Connect

**Error:** Protocol version mismatch

**Cause:** Client only supports TLS 1.0/1.1

**Solutions:**
1. Update client software (recommended)
2. Temporarily allow TLS 1.1: `ssl-min-ver TLSv1.1` (not recommended)
3. Check if client is actually that old (most aren't)

### curl Shows TLS Error

**Error:** `error:1404B42E:SSL routines:ST_CONNECT:tlsv1 alert protocol version`

**This is a curl issue, not your API!**

**Solutions:**
```bash
# Force TLS 1.2
curl --tlsv1.2 https://api.boldvpn.net/api/health

# Update curl
brew install curl

# Use browser instead (always works)
```

### Browser Shows Security Warning

**Cause:** Certificate issue, not TLS version

**Check:**
1. Certificate is valid (not expired)
2. Certificate matches domain (api.boldvpn.net)
3. Certificate chain is complete

---

## ✅ Security Checklist

After hardening TLS:

- [ ] TLS 1.2 minimum enforced
- [ ] Strong ciphers configured
- [ ] Tested with modern browser (works)
- [ ] Tested with old TLS 1.0 (fails - good!)
- [ ] SSL Labs test shows A or A+ grade
- [ ] Customer portal still works
- [ ] Mobile devices can connect

---

## 📚 Additional Security Measures

### 1. HTTP Security Headers

Add to frontend option pass-through:

```
http-response set-header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
http-response set-header X-Frame-Options "SAMEORIGIN"
http-response set-header X-Content-Type-Options "nosniff"
http-response set-header X-XSS-Protection "1; mode=block"
```

**What these do:**
- HSTS: Force HTTPS for 1 year
- X-Frame-Options: Prevent clickjacking
- X-Content-Type-Options: Prevent MIME sniffing
- X-XSS-Protection: XSS protection

### 2. Rate Limiting (Already in API)

Your Node.js API already has:
- 100 requests per 15 minutes (general)
- 5 requests per 15 minutes (auth endpoints)

No additional HAProxy rate limiting needed!

### 3. DDoS Protection

For additional protection, consider:
- Cloudflare (free tier available)
- OPNsense IDS/IPS (Suricata)
- Fail2ban for repeated failed auth

---

## 🎯 Quick Reference

**Minimum secure TLS (add to api_https frontend):**
```
ssl-min-ver TLSv1.2
```

**Maximum secure TLS (add to api_https frontend):**
```
ssl-min-ver TLSv1.2
ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305
ssl-default-bind-ciphersuites TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256
ssl-default-bind-options no-tls-tickets
```

**Test:**
```bash
# Modern clients
curl --tlsv1.2 https://api.boldvpn.net/api/health

# Browser
https://api.boldvpn.net/api/health

# SSL Labs
https://www.ssllabs.com/ssltest/analyze.html?d=api.boldvpn.net
```

---

**Your API is now hardened with industry-standard TLS security!** 🔒

