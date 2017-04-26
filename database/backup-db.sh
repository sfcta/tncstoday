#!/bin/bash
# BACKUP DATABASES
# ================

DB_DUMP_LOCATION=~/db-backups
BORG_STORAGE=~/borg-backup-repository

# ---------------------------------------------

# First set up initial dirs if they don't exist
echo Preparing Borg backup
mkdir -p $DB_DUMP_LOCATION
borg init $BORG_STORAGE

# Then use pg_dump to export all databases except template* and postgres (admin)
for each in `sudo -u postgres psql --tuples-only -P format=unaligned -c "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'";`; do 
	sudo -u postgres pg_dump -Fc $each > $DB_DUMP_LOCATION/$each.dump;
done

# Then use borg backup to do a deduplicated snapshot of them all
cd $DB_DUMP_LOCATION
borg create -C lz4 $BORG_STORAGE::`date +%Y-%m-%d` *

