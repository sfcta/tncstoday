#!/bin/bash

# Database server setup for portal/warehouse project
# --------------------------------------------------------------------
# This script assumes you are setting up an Ubuntu 16.04 from scratch.

# Must be run as root/sudo.
if [ `whoami` != root ]; then echo 'must run using sudo'; exit 1; fi

# Add Postgresql official repo (see https://wiki.postgresql.org/wiki/Apt)
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
sudo apt-get install wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Fetch all package updates
apt-get update && apt-get upgrade && apt-get install linux-generic

# Install Postgresql and Postgis 
apt-get install -y \
	postgis \
	postgresql

