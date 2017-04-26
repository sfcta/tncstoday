#!/bin/bash
# BACKUP DATABASES
# ================
for each in `sudo -u postgres psql --tuples-only -P format=unaligned -c "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'";`; do 
	sudo -u postgres pg_dump -Fc $each > ~/$each.dump;
done

