#!/bin/sh

echo "--- FreeRADIUS Accounting Diagnostics ---"

# 1. Check radiusd service status
echo "\n--- 1. Checking radiusd service status ---"
service radiusd status

# 2. Check listening ports
echo "\n--- 2. Checking listening ports for radiusd ---"
sockstat -l | grep radiusd

# 3. Display SQL module configuration
echo "\n--- 3. Displaying SQL module configuration (/usr/local/etc/raddb/mods-available/sql) ---"
if [ -f /usr/local/etc/raddb/mods-available/sql ]; then
    cat /usr/local/etc/raddb/mods-available/sql
else
    echo "File not found: /usr/local/etc/raddb/mods-available/sql"
fi

# 4. Display accounting section from radiusd.conf
echo "\n--- 4. Displaying 'accounting' section from /usr/local/etc/raddb/sites-available/default ---"
if [ -f /usr/local/etc/raddb/sites-available/default ]; then
    awk '/accounting *{/,/}/' /usr/local/etc/raddb/sites-available/default
else
    echo "File not found: /usr/local/etc/raddb/sites-available/default"
fi

# 5. Display radacct table structure in PostgreSQL
echo "\n--- 5. Displaying 'radacct' table structure in PostgreSQL ---"
if su -l postgres -c "psql -d radius -c '\d radacct'"; then
    :
else
    echo "Could not connect to PostgreSQL to describe radacct table."
    echo "Please ensure PostgreSQL is running and the 'radius' database exists."
fi

echo "\n--- Diagnostics Complete ---"
echo "\nPlease save the output of this script and provide it to me."
echo "\nFor live debugging, you should:"
echo "1. Stop the radiusd service: service radiusd stop"
echo "2. Run FreeRADIUS in debug mode: radiusd -X"
echo "3. Send an accounting request from your NAS/router."
echo "4. Look for any errors in the output, especially those related to 'sql' or 'radacct'."
