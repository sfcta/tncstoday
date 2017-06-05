-- Create table of tnc trips by hour from Drew's CSV file
CREATE TABLE tnc.tnc_trip_stats
(taz integer, day_of_week integer, time char(8), pickups double precision, dropoffs double precision);

COPY tnc.tnc_trip_stats FROM 'tnc_trip_stats.csv' DELIMITER ',' CSV HEADER;

ALTER TABLE tnc.tnc_trip_stats ADD COLUMN id SERIAL PRIMARY KEY;

CREATE INDEX ix_tnc_trip_stats_taz
  ON tnc.tnc_trip_stats
  USING btree
  (taz);

CREATE INDEX ix_tnc_trip_stats_time
  ON tnc.tnc_trip_stats
  USING btree
  (time);


GRANT SELECT ON TABLE tnc.tnc_trip_stats TO anon;


-- Create summary view too
CREATE VIEW tnc.taz_total (taz, day_of_week, dropoffs, pickups) AS
SELECT
  taz,day_of_week,SUM(dropoffs),SUM(pickups)
FROM
  tnc.tnc_trip_stats
GROUP BY day_of_week,taz
ORDER BY taz,day_of_week;

ALTER VIEW tnc.taz_total OWNER to anon;
GRANT SELECT ON TABLE tnc.taz_total TO anon;
