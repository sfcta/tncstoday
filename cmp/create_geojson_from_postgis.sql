-- PostGIS can convert any geometry to a GeoJSON view
DROP VIEW cmp.json_segments;
CREATE VIEW cmp.json_segments AS
SELECT *,ST_AsGeoJSON(cmp_segments.geom) as geometry
  FROM cmp.cmp_segments;

ALTER VIEW cmp.json_segments OWNER to anon;
GRANT SELECT ON TABLE cmp.json_segments TO anon;

