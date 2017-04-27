#!/bin/bash

# API server setup for portal/warehouse project 
# Installs GeoServer, GeoWebCache, and PostgREST
# --------------------------------------------------------------------
# This script assumes you are setting up an Ubuntu 16.04 from scratch.
#
# Reference material:
# - https://gist.github.com/akkerman/6834282

export INSTALL_GEOSERVER_VERSION=2.11.0
export INSTALL_POSTGREST_VERSION=0.4.0.0

# Must be run as root/sudo.
if [ `whoami` != root ]; then
	printf 'must run using sudo\n'
	printf "e.g. sudo ./`basename $0`\n"
	exit 1
fi

# Fetch latest package updates
apt update && apt-get upgrade -y && apt-get install -y linux-generic

# Install Oracle Java 8 JRE
add-apt-repository -y ppa:webupd8team/java
apt update
apt install oracle-java8-installer
rm /usr/lib/jvm/default-java
ln -s /usr/lib/jvm/java-8-oracle /usr/lib/jvm/default-java

# Install nginx tomcat and other required packages
apt install -y \
	libpq5 \
	nginx \
	tomcat7 \
	tomcat7-admin \
	unzip \
	wget \

# Install GeoServer
wget http://sourceforge.net/projects/geoserver/files/GeoServer/$INSTALL_GEOSERVER_VERSION/geoserver-$INSTALL_GEOSERVER_VERSION-war.zip
unzip geoserver-$INSTALL_GEOSERVER_VERSION-war.zip geoserver.war
mv geoserver.war /var/lib/tomcat7/webapps
echo "#!/bin/bash" > /usr/share/tomcat7/bin/setenv.sh
echo "CATALINA_OPTS=\"-server -Xmx800m\"" >> /usr/share/tomcat7/bin/setenv.sh

# Install PostgREST
mkdir -p /etc/postgREST/
cp postgrest.conf /etc/postgREST
cp start-postgrest.sh /usr/local/bin
cp postgrest.service /etc/systemd/system
wget https://github.com/begriffs/postgrest/releases/download/v${INSTALL_POSTGREST_VERSION}/postgrest-${INSTALL_POSTGREST_VERSION}-ubuntu.tar.xz
tar xf postgrest-${INSTALL_POSTGREST_VERSION}-ubuntu.tar.xz
mv postgrest /usr/local/bin

# Set up NGINX reverse proxy
rm /etc/nginx/sites-enabled/default
cp nginx.conf /etc/nginx/sites-available/data-warehouse.conf
ln -s /etc/nginx/sites-available/data-warehouse.conf /etc/nginx/sites-enabled

# Start everything up!
systemctl enable tomcat7
systemctl start  tomcat7

systemctl enable postgrest
systemctl start  postgrest

systemctl enable nginx
systemctl start  nginx

printf "\n\n"
printf '====================================================\n'
printf "Done. You MUST \e[37m\e[41mCHANGE THE GEOSERVER PASSWORD!!!!\e[0m\n"
printf "\e[33mhttp://hostname/geoserver\e[0m -- Security ; Users/Groups\n"
printf "====================================================\n\n"
 
