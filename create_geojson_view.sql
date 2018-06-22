-- PostGIS can convert any geometry to a GeoJSON view
CREATE OR REPLACE VIEW api.taz_boundaries AS
SELECT *,
       st_asgeojson(tnc.taz_boundaries.geom) AS geometry
FROM tnc.taz_boundaries;

ALTER VIEW api.taz_boundaries OWNER to postgres;
GRANT SELECT ON TABLE api.taz_boundaries TO anon;
