-- PostGIS can convert any geometry to a GeoJSON view
DROP VIEW tnc.taz_total;
CREATE VIEW tnc.taz_total (taz,day_of_week,avail_trips,accpt_trips) AS 
SELECT 
  taz,day_of_week,SUM(avail_trips),SUM(accpt_trips)
FROM 
  tnc.tnc_trip_stats
GROUP BY day_of_week,taz
ORDER BY taz,day_of_week;

ALTER VIEW tnc.taz_total OWNER to anon;
GRANT SELECT ON TABLE tnc.taz_total TO anon;

