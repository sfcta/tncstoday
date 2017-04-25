#!/bin/bash

# Database server setup for portal/warehouse project
# --------------------------------------------------------------------
# This script assumes you are setting up an Ubuntu 16.04 from scratch.

# Must be run as root/sudo.
if [ `whoami` != root ]; then
	printf 'must run using sudo\n'
	printf "e.g. sudo ./`basename $0`\n"
	exit 1
fi

# Add Postgresql official repo (see https://wiki.postgresql.org/wiki/Apt)
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
sudo apt-get install -y wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Fetch all package updates
apt-get update && apt-get upgrade -y && apt-get install -y linux-generic

# Install Postgresql and Postgis 
apt-get install -y \
	postgis-2.3 \
	postgresql-9.6

# Set postgres user password
printf "\n---\nSETTING POSTGRES DB USER PASSWORD\n"
echo '\password postgres' | sudo -u postgres psql postgres

# Add postgres config settings
cat << EOF >>  /etc/postgresql/9.6/main/postgresql.conf
listen_addresses = '*'
port = 5432
EOF

# Only start postgres 9.6
for each in 9.2 9.3 9.4 9.5; do
	sed -i 's/^auto/disable/' /etc/postgresql/$each/main/start.conf
done;
	
printf "\nDONE! You should probably reboot."
 
