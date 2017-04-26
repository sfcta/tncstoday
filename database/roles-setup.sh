#!/bin/bash
# PostgREST API uses postgres ROLES to handle security: who can read/write, etc.
sudo -u postgres psql -f db-setup-roles.sql
 
