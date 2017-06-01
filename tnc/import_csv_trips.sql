CREATE TABLE tnc.tnc_trip_stats
(id serial primary key, taz integer, day_of_week integer, time char(8), pickups double precision, dropoffs double precision);
COPY tnc.tnc_trip_stats FROM 'tnc_trip_stats.csv' DELIMITER ',' CSV HEADER;

