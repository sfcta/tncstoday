# Import a set of fast-trips outputs into Postgres.
import sys
import pandas as pd
import sqlalchemy
import numpy as np

schema = sys.argv[1]
print(schema)

print('Connecting')
engine = sqlalchemy.create_engine('postgresql://postgres:blackcherry7a@prospector-db:5432/geo')
#engine.execute(sqlalchemy.schema.CreateSchema(schema))

print('reading')
trips = pd.read_csv('trip_stats_taz.csv', usecols=range(5))
print('to_sql')
trips.to_sql('tnc_trip_stats', engine, schema=schema, chunksize=10000)
print('done')
