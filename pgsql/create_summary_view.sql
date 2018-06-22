-- PostGIS can convert any geometry to a GeoJSON view
-- DROP VIEW tnc.taz_total;
CREATE VIEW api.tnc_taz_totals (taz, day_of_week, dropoffs, pickups) AS 
SELECT 
  taz,day_of_week,SUM(dropoffs),SUM(pickups)
FROM 
  tnc.tnc_trip_stats
GROUP BY day_of_week,taz
ORDER BY taz,day_of_week;

ALTER VIEW api.tnc_taz_totals OWNER to postgres;
GRANT SELECT ON TABLE api.tnc_taz_totals TO anon;
