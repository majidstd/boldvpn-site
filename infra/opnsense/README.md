# OPNsense Configuration Backups

This directory contains OPNsense configuration backups.

## ⚠️ IMPORTANT: Git Setup for OPNsense

**DO NOT configure OPNsense to push directly to the main branch!**

### Problem

OPNsense's Git backup feature does a force push of only `config.xml`, which overwrites ALL other files in the repository.

### Solution

**Option 1: Use a Separate Repository (RECOMMENDED)**

1. Create a new repository just for OPNsense configs:
   ```bash
   # On GitHub, create: boldvpn-opnsense-backup
   ```

2. Configure OPNsense to push to that repo instead

**Option 2: Use a Dedicated Branch**

1. Create a dedicated branch for OPNsense:
   ```bash
   git checkout -b opnsense-config
   git push -u origin opnsense-config
   ```

2. Configure OPNsense to push to `opnsense-config` branch (not `main`)

3. Manually copy config when needed:
   ```bash
   git checkout main
   git show opnsense-config:config.xml > infra/opnsense/config-$(date +%Y-%m-%d-%H-%M).xml
   git add infra/opnsense/config-*.xml
   git commit -m "feat: Update OPNsense config backup"
   git push
   ```

**Option 3: Manual Backup Only**

1. Disable Git backup in OPNsense
2. Manually download config from OPNsense web interface
3. Copy to this directory with timestamp:
   ```bash
   cp ~/Downloads/config.xml infra/opnsense/config-$(date +%Y-%m-%d-%H-%M).xml
   git add infra/opnsense/config-*.xml
   git commit -m "feat: OPNsense config backup"
   git push
   ```

## Recovery Instructions

If OPNsense accidentally overwrites the repository:

```bash
# 1. Find the last good commit (before OPNsense overwrote)
git reflog | grep -v "diag_backup.php"

# 2. Reset to that commit (example: 76740b4)
git reset --hard 76740b4

# 3. Save the OPNsense config from the backup branch
git show opnsense-backup:config.xml > infra/opnsense/config-$(date +%Y-%m-%d-%H-%M).xml

# 4. Commit and force push
git add infra/opnsense/config-*.xml
git commit -m "feat: Recover from OPNsense overwrite + save config"
git push origin main --force
```

## Current Backups

- `config-2025-11-10-20-47.xml` - Backup from Nov 10, 2025 20:47 UTC

## Notes

- OPNsense configs are large (5-6 MB)
- Git works best with dedicated branches for automated systems
- Consider using OPNsense's built-in config history instead
