#!/bin/bash

# Database server setup for portal/warehouse project
# --------------------------------------------------------------------
# This script assumes you are setting up an Ubuntu 16.04 from scratch.
# Reference material:
# - https://gist.github.com/akkerman/6834282
# - https://help.ubuntu.com/lts/serverguide/postgresql.html
# - http://www.digital-geography.com/postgresql-postgis-brief-introduction/
# - http://workshops.boundlessgeo.com/postgis-intro/tuning.html

export SFCTA_NETWORK_MASK=172.30.0.0/16

# Must set PASSWORD env var
: ${PASSWORD:?"not set. Usage:  sudo PASSWORD=xxx ./`basename $0`"}

# Must be run as root/sudo.
if [ `whoami` != root ]; then
	printf 'must run using sudo\n'
	printf "e.g. sudo PASSWORD=xxx ./`basename $0`\n"
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
	borgbackup \
	build-essential \
	pgxnclient \
	postgis \
	postgresql-9.6 \
	postgresql-9.6-postgis-2.3 \
	postgresql-server-dev-9.6 \
	unzip \

# Set postgres user password - same PW in linux system and in postgres db
printf "\n---\nSETTING POSTGRES DB USER PASSWORD\n"
chpasswd <<< "postgres:$PASSWORD"
sudo -u postgres psql -d template1 -c "ALTER USER postgres WITH PASSWORD '$PASSWORD';"

# Add postgres network config and tuning settings
echo "host all all ${SFCTA_NETWORK_MASK} md5" >> /etc/postgresql/9.6/main/pg_hba.conf
cat << EOF >> /etc/postgresql/9.6/main/postgresql.conf
# -------------------------------------------
# SFCTA Data Warehouse Configuration Settings
listen_addresses = '*'
port = 5432

# PostGIS-optimized tuning parameters from http://workshops.boundlessgeo.com/postgis-intro/tuning.html 
shared_buffers = 1024MB
work_mem = 16MB
maintenance_work_mem = 64MB
wal_buffers = 1MB
max_wal_size = 256MB
random_page_cost = 2.0

# Don't allow UPDATE or DELETE to erase tables without specifying conditions
# shared_preload_libraries = 'safeupdate'
EOF

# Harden Postgresql to prevent UPDATE and DELETES that hose entire table
# I am baffled why pgxn uses 'gmake' which is in no package in Ubuntu
# -- and is really just 'make'
ln -s /usr/bin/make /usr/bin/gmake
sudo -E pgxn install safeupdate

# Set up roles - postgREST depends on db roles for authorization
sudo -u postgres psql -f roles.sql
sudo -u postgres psql -d template1 -c "ALTER USER gatekeeper WITH PASSWORD 'gk-$PASSWORD';"

# Add CKAN database and user: 'ckan'
printf "\nCKAN DB USER PASSWORD:\n"
sudo -u postgres createuser -S -D -R -P ckan
sudo -u postgres createdb -O ckan ckan -E utf-8

printf "\n\nDONE! You should definitely reboot now.\n"
 
