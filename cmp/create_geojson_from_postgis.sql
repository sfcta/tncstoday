-- PostGIS can convert any geometry to a GeoJSON view
CREATE VIEW cmp.json_segments AS
SELECT *, ST_AsGeoJSON(cmp_segments.geom) as shape
  FROM cmp.cmp_segments
