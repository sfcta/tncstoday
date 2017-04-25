#!/bin/bash

# Database server setup for portal/warehouse project
# --------------------------------------------------------------------
# This script assumes you are setting up an Ubuntu 16.04 from scratch.
# Reference material:
# - https://gist.github.com/akkerman/6834282
# - https://help.ubuntu.com/lts/serverguide/postgresql.html
# - http://www.digital-geography.com/postgresql-postgis-brief-introduction/
# - http://workshops.boundlessgeo.com/postgis-intro/tuning.html

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
	postgis-2.3 \
	postgresql-9.6

# Set postgres user password - same PW in linux system and in postgres db
printf "\n---\nSETTING POSTGRES DB USER PASSWORD\n"
chpasswd <<< "postgres:$PASSWORD"
sudo -u postgres psql -d template1 -c "ALTER USER postgres WITH PASSWORD '$PASSWORD';"

# Only start postgres 9.6
for each in 9.2 9.3 9.4 9.5; do
	sed -i 's/^auto/disable/' /etc/postgresql/$each/main/start.conf
done;
# Add postgres network config and tuning settings
echo "host all all 172.30.0.0/16 md5" >> /etc/postgresql/9.6/main/pg_hba.conf
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
EOF

# Now you are ready to create some geospatial databases! e.g.
# DB_NAME=fasttrips
# sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
# sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION postgis;"
# sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION postgis_topology;"

printf "\n\nDONE! You should definitely reboot now.\n"
 
