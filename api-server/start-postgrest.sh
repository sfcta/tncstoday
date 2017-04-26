#!/bin/bash
for each in $(ls /etc/postgREST); do
    echo postgrest /etc/postgREST/$each &
done;

