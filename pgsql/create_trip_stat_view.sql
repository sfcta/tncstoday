-- Just mirror the table in the API view
CREATE OR REPLACE VIEW api.tnc_trip_stats AS
SELECT *
FROM tnc.tnc_trip_stats;

ALTER VIEW api.tnc_trip_stats OWNER to postgres;
GRANT SELECT ON TABLE api.tnc_trip_stats TO anon;
