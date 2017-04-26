#!/bin/bash

# CKAN server setup for portal/warehouse project
# --------------------------------------------------------------------
# This script assumes you are setting up an Ubuntu 14.04 from scratch.
# Reference material:
# - http://docs.ckan.org/en/latest/maintaining/installing/install-from-package.html

export CKAN_PACKAGE=python-ckan_2.6-trusty_amd64.deb

# Must set CKAN_DB_URL env var
#: ${CKAN_DB_URL:?"not set. Usage:  sudo CKAN_DB_URL=xxx ./`basename $0`"}

# Must be run as root/sudo.
if [ `whoami` != root ]; then
	printf 'must run using sudo\n'
	printf "e.g. sudo PASSWORD=xxx ./`basename $0`\n"
	exit 1
fi

# Fetch all package updates
apt-get update && apt-get upgrade -y
#apt-get install -y linux-generic

# Install CKAN and requirements
apt-get install -y \
	apache2 \
	git-core \
	libapache2-mod-wsgi \
	libpq5 \
	nginx \
	redis-server \
	wget \

wget http://packaging.ckan.org/$CKAN_PACKAGE
dpkg -i $CKAN_PACKAGE

# Update CKAN DB settings
sed -i "/^sqlalchemy/c sqlalchemy.url = $CKAN_DB_URL" \
	/etc/ckan/default/production.ini

# Solr-tomcat search
apt-get install -y solr-tomcat
mv /etc/solr/conf/schema.xml /etc/solr/conf/schema.xml.bak
sudo ln -s /usr/lib/ckan/default/src/ckan/ckan/config/solr/schema.xml /etc/solr/conf/schema.xml

# Set postgres user password - same PW in linux system and in postgres db
#printf "\n---\nSETTING POSTGRES DB USER PASSWORD\n"
#chpasswd <<< "postgres:$PASSWORD"
#sudo -u postgres psql -d template1 -c "ALTER USER postgres WITH PASSWORD '$PASSWORD';"


printf "\n\nDONE! You should definitely reboot now.\n"
 
