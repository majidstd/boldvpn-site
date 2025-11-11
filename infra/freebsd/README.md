# BoldVPN Configuration Backups

**Last updated:** $(date)

## Directory Structure

```
infra/freebsd/
├── freeradius/
│   ├── radiusd.conf       # Main FreeRADIUS config
│   ├── sites-default      # Default site config (auth/accounting)
│   ├── sql-module         # SQL module config (PostgreSQL)
│   └── clients.conf       # RADIUS clients (OPNsense)
├── postgresql/
│   ├── postgresql.conf    # PostgreSQL server config
│   └── pg_hba.conf        # PostgreSQL authentication config
└── api/
    └── env-example        # API environment variables (sanitized)
```

## Usage

### Restore FreeRADIUS Config
```bash
sudo cp infra/freebsd/freeradius/sites-default /usr/local/etc/raddb/sites-available/default
sudo cp infra/freebsd/freeradius/sql-module /usr/local/etc/raddb/mods-available/sql
sudo cp infra/freebsd/freeradius/clients.conf /usr/local/etc/raddb/
sudo service radiusd restart
```

### Restore PostgreSQL Config
```bash
PG_VERSION=$(ls /var/db/postgres/ | grep data | head -1)
sudo cp infra/freebsd/postgresql/postgresql.conf /var/db/postgres/$PG_VERSION/
sudo cp infra/freebsd/postgresql/pg_hba.conf /var/db/postgres/$PG_VERSION/
sudo service postgresql restart
```

### Restore API Config
```bash
cp infra/freebsd/api/env-example api/.env
# Edit api/.env and add real passwords
```

## Security Notes

- Passwords are REDACTED in backups
- Do NOT commit real passwords to git
- Keep .env file secure (not in git)
