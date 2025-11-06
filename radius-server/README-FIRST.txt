╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  📦 BoldVPN FreeBSD RADIUS Server Setup Package             ║
║     Complete AAA (Authentication, Authorization, Accounting) ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

🎯 WHAT THIS IS:

Complete automated setup for FreeRADIUS AAA server on FreeBSD 14,
integrated with your OPNsense captive portal (v1.0G).

Provides:
  ✅ User authentication (login credentials)
  ✅ Authorization (quotas, speed limits, device limits)
  ✅ Accounting (track usage, bandwidth, session time)
  ✅ PostgreSQL database (store user data)
  ✅ Multi-tier plans (Premium, Basic, Family)

═══════════════════════════════════════════════════════════════

📁 FILES IN THIS PACKAGE:

1. QUICK-START.txt (START HERE!)
   └─ 7-step quick setup guide
   └─ Copy/paste commands
   └─ What to expect

2. README.md
   └─ Complete documentation
   └─ Testing guide
   └─ Troubleshooting
   └─ SQL queries for reporting

3. freebsd-radius-setup.sh ⭐ MAIN INSTALLER
   └─ Automated installation script
   └─ Run on FreeBSD server
   └─ 10-15 minutes to complete
   └─ Auto-detects package versions

4. check-packages.sh (optional)
   └─ Check available packages
   └─ Run before setup if unsure
   └─ Shows FreeRADIUS/PostgreSQL versions

5. PACKAGE-NOTES.md
   └─ FreeBSD package naming guide
   └─ Why packages might not be found
   └─ How script handles it

6. create-sample-users.sql
   └─ Sample users and plans
   └─ Run after setup (optional)
   └─ Creates Premium/Basic/Family plans

7. opnsense-config-guide.md
   └─ Configure OPNsense to use RADIUS
   └─ Step-by-step with screenshots
   └─ Testing and verification

═══════════════════════════════════════════════════════════════

🚀 QUICKEST PATH TO SUCCESS:

1. Read: QUICK-START.txt (3 minutes)
2. Copy: freebsd-radius-setup.sh to FreeBSD
3. Run: sudo ./freebsd-radius-setup.sh
4. Wait: 10-15 minutes
5. Configure: OPNsense (follow opnsense-config-guide.md)
6. Test: Login with testuser / Test@123!
7. Done! ✅

═══════════════════════════════════════════════════════════════

⚡ ONE-LINER INSTALL:

From your Mac:
  scp freebsd-radius-setup.sh admin@[freebsd-ip]:~

From FreeBSD:
  chmod +x freebsd-radius-setup.sh && sudo ./freebsd-radius-setup.sh

═══════════════════════════════════════════════════════════════

🔧 KEY FEATURES:

✅ Auto-detects correct package names (FreeBSD 13/14/15)
✅ No manual configuration needed
✅ Creates test user automatically
✅ Sets up firewall rules
✅ Starts all services
✅ Tests RADIUS authentication
✅ Ready for production

═══════════════════════════════════════════════════════════════

📊 AFTER SETUP, YOU'LL HAVE:

- FreeRADIUS listening on port 1812/1813
- PostgreSQL database with RADIUS schema
- Test user: testuser / Test@123!
- Sample plans (Premium 10GB, Basic 5GB, Family 50GB)
- Full accounting (track every connection)
- Integration with OPNsense captive portal v1.0G

═══════════════════════════════════════════════════════════════

❓ TROUBLESHOOTING:

Package not found?
  → Run: ./check-packages.sh
  → Script auto-detects anyway!

Can't connect?
  → Check: service radiusd status
  → Check: service postgresql status
  → See: README.md troubleshooting section

Need help?
  → Read: README.md (complete docs)
  → Read: PACKAGE-NOTES.md (package issues)

═══════════════════════════════════════════════════════════════

🎯 WHAT YOU ASKED FOR:

✅ FreeRADIUS for AAA
✅ PostgreSQL database
✅ User authentication
✅ Usage tracking (accounting)
✅ Quota management
✅ Speed limits
✅ Device limits
✅ Ready for customer portal integration

═══════════════════════════════════════════════════════════════

📍 NEXT STEPS (After RADIUS is working):

1. Create real users (replace test users)
2. Set up user groups/plans
3. Build Node.js API (customer dashboard backend)
4. Build React customer portal (boldvpn.net/login.html)
5. Integrate Stripe (billing)
6. Add user management (signup/reset password)

═══════════════════════════════════════════════════════════════

🏆 THIS INTEGRATES WITH:

✅ Your OPNsense Captive Portal v1.0G (golden version)
✅ Your BoldVPN website (boldvpn.net)
✅ Your WireGuard VPN setup
✅ Ready for mobile app integration

═══════════════════════════════════════════════════════════════

                    💪 LET'S BUILD THIS! 💪

                  START WITH: QUICK-START.txt

═══════════════════════════════════════════════════════════════
