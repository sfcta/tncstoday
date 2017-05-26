-- PostGIS can convert any geometry to a GeoJSON view
CREATE OR REPLACE VIEW tnc.json_taz AS
SELECT *,
       st_asgeojson(tnc.taz_boundaries.geom) AS geometry
FROM tnc.taz_boundaries;

ALTER VIEW tnc.json_taz OWNER to anon;
GRANT SELECT ON TABLE tnc.json_taz TO anon;
