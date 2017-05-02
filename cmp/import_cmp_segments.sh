# Use shp2pgsql to import shapefile
shp2pgsql -c -s 4326 CMP_Segments.shp cmp.cmp_segments | sudo -u postgres psql -d geo

# Set 0 values to NULL in revid column
sudo -u postgres psql -d geo -c "update cmp.cmp_segments set revid=NULL where revid=0;"


