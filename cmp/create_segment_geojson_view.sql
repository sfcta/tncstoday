-- PostGIS can convert any geometry to a GeoJSON view
-- Use ST_OffsetCurve to get the two sides of the roads to separate
CREATE OR REPLACE VIEW cmp.json_segments AS
SELECT *,
       st_asgeojson(st_offsetcurve(st_linemerge(cmp_segments.geom), -.0002)) AS geometry
FROM cmp.cmp_segments;

ALTER VIEW cmp.json_segments OWNER to anon;
GRANT SELECT ON TABLE cmp.json_segments TO anon;
