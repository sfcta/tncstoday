-- PostgREST API uses postgresql roles to handle all its authentication
-- See https://www.postgresql.org/docs/9.6/static/user-manag.html 
CREATE ROLE admin LOGIN CREATEDB CREATEROLE;
CREATE ROLE gatekeeper LOGIN;
CREATE ROLE staff LOGIN;
CREATE ROLE anon;

GRANT staff,anon TO gatekeeper;
 
