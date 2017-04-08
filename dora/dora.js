/* DORA -- the fast-trips EXPLORAH. */
'use strict';

var mymap = L.map('sfmap').setView([37.75, -122.3], 11);
var url = 'https://api.mapbox.com/styles/v1/mapbox/dark-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}';
var token = 'pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ';
var attribution ='<a href="http://openstreetmap.org">OpenStreetMap</a> | '+
                 '<a href="http://mapbox.com">Mapbox</a>';
L.tileLayer(url, {
  attribution:attribution,
  maxZoom: 18,
  accessToken:token,
}).addTo(mymap);

var segmentLayer;

var options = {
  typeName: 'mappoints:segments0',
  service:'WFS',
  version:'1.1.0',
  request:'GetFeature',
  outputFormat: 'json',
}

function addSegmentLayer(segments) {
  segmentLayer = L.geoJSON(segments, {
    style: function(feature) {
      switch (feature.properties.mode) {
        case 'heavy_rail': return {color: "#ffff00"};
        case 'commuter_rail': return {color: "#ff6666"};
        case 'light_rail': return {color: "red"};
        case 'local_bus': return {color: "#00ccff", "z-index":"20"};
        case 'premium_bus': return {color: "#44ffaa"};
        case 'express_bus': return {color: "#44ffaa"};
        case 'ferry': return {color: "#ff8800"};
        case 'transfer': return {color: "#446600", "z-index":"-1"};
        default: return {color: "#446600", "z-index":"-1"};
      }
    }
  });
  segmentLayer.addTo(mymap);
  updateTripList(segments);
}

function updateTripList(segments) {
    console.log(segments);
    let tripset = {};
    for (var feature of segments.features) {
        let tripId = feature.properties.person_trip_id;
        console.log(tripId);
        tripset[feature.properties.person_trip_id]=null;
    }
    let tripArray = Object.keys(tripset);
    tripArray.sort(function(a, b) {return a-b});
    console.log(tripArray);
    app.trips = []
    for (var t of tripArray) {
        app.trips.push({trip_id:t});
    }
}

function queryServer() {
  const geoserverUrl = 'http://dwdev:8080/geoserver/ows?';

  var esc = encodeURIComponent;
  var queryparams = Object.keys(options)
            .map(k => esc(k) + '=' + esc(options[k]))
            .join('&');

  // Fetch the segments
  fetch(geoserverUrl + queryparams, options)
    .then((resp) => resp.json())
    .then(function(jsonData) {
      addSegmentLayer(jsonData);
    }).catch(function(error) {
      console.log("err: "+error);
    });
}

function runFilter() {
  if (segmentLayer) segmentLayer.remove()

  if (this.person) options['cql_filter'] = `person_id='${this.person}'`
  else return;

  this.queryServer();
}

var app = new Vue({
  el: '#panel',
  data: {
	person: '',
    selected_trips: [],
    trips: [],
  },
  methods: {
    queryServer: queryServer,
    runFilter: runFilter,
  },
});

