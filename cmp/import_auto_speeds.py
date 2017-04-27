# Import a set of fast-trips outputs into Postgres.
import sys
import pandas as pd
import sqlalchemy
import numpy as np

schema = sys.argv[1]
print(schema)

print('Connecting')
engine = sqlalchemy.create_engine('postgresql://postgres@172.30.1.217:5432/geo')
#engine.execute(sqlalchemy.schema.CreateSchema(schema))

# Mappoints file
print('CMP')
mappoints = pd.read_csv('cmp_initial_import.csv', usecols=range(23))
mappoints.to_sql('auto_speeds', engine, schema=schema, chunksize=100)

