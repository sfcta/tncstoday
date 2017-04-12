/* DORA -- the fast-trips EXPLORAH. */
'use strict';

// Use npm and babel to support IE11/Safari
import 'babel-polyfill';
import 'isomorphic-fetch';

var mymap = L.map('sfmap').setView([37.75, -122.3], 11);
var url = 'https://api.mapbox.com/styles/v1/mapbox/dark-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}';
var token = 'pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ';
var attribution ='<a href="http://openstreetmap.org">OpenStreetMap</a> | ' +
                 '<a href="http://mapbox.com">Mapbox</a> | ' +
                 '<a href="http://www.sfcta.org">SFCTA</a>';
L.tileLayer(url, {
  attribution:attribution,
  maxZoom: 18,
  accessToken:token,
}).addTo(mymap);

var personJson;
var segmentLayer;

var options = {
  typeName: 'mappoints:segments',
  service:'WFS',
  version:'1.1.0',
  request:'GetFeature',
  outputFormat: 'json',
};

function addSegmentLayer(segments, options={}) {
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
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      var details = `<b>${p.mode}</b>`+
                    `<hr/>`+
                    `${p.route_id || ''}<br/>`;
      layer.bindPopup(details);
    },
  });
  segmentLayer.addTo(mymap);
}

function highlightTrip() {
  if (app.selectedTrips.length==0) return;

  app.selectedPaths = [];

  let thisTrip = personJson.features.filter(function(trip) {
    return trip.properties.person_trip_id == app.selectedTrips;
  });

  // Sort by linknum so origin and dest are correct -- DB doesn't guarantee feature order
  thisTrip.sort(function(a,b) {return a.properties.linknum - b.properties.linknum});

  if (segmentLayer) segmentLayer.remove();
  addSegmentLayer(thisTrip);
  updatePathList(thisTrip);

  // first point in first polyline is always origin
  originMarker = addODMarker(thisTrip[0].geometry.coordinates[0], true);

  // determine destination -- last point of last polyline
  let finalSegment = thisTrip[thisTrip.length - 1].geometry;
  let dest = finalSegment.coordinates[finalSegment.coordinates.length - 1];
  destMarker = addODMarker(dest, false);
}

let destMarker, originMarker;

function addODMarker(lnglat, isOrigin) {
  var marker = isOrigin ? originMarker : destMarker;
  if (marker) marker.remove();

  var iconOrig = L.AwesomeMarkers.icon({
    prefix: 'ion',
    icon: 'star',
    markerColor:'green',
  });

  var iconDest = L.AwesomeMarkers.icon({
    prefix: 'ion',
    icon: 'flag',
    markerColor:'red',
  });

  marker = new L.marker([lnglat[1], lnglat[0]], {
    icon: isOrigin ? iconOrig : iconDest
  }).addTo(mymap);

  return marker;
}

function highlightPath() {
  if (app.selectedPaths.length==0) return;

  let thisPath = personJson.features.filter(function(trip) {
    return trip.properties.person_trip_id == app.selectedTrips &&
           trip.properties.pathnum == app.selectedPaths;
  });

  if (segmentLayer) segmentLayer.remove()
  addSegmentLayer(thisPath, {popup: true});

  app.pathitems = [];
  for (let segment of thisPath) {
    let mode = segment.properties.mode;
    let icon = mode == 'local_bus' ? 'ion-bus' :
               mode == 'light_rail' ? 'ion-rail' :
                       'ion-walk';

    app.pathitems.push({
      mode: segment.properties.mode,
      route: segment.properties.route_id,
      icon: icon,
    });
  }
}

function updateTripList(segments) {
    let tripset = {};
    for (let feature of segments.features) {
        let tripId = feature.properties.person_trip_id;
        tripset[feature.properties.person_trip_id] = null;
    }
    let tripArray = Object.keys(tripset);
    tripArray.sort(function(a, b) {return a-b});
    app.trips = []
    app.pathitems = [];

    for (let t of tripArray) {
        app.trips.push({trip_id:t});
    }
}

function updatePathList(segments) {
    let pathset = {};
    for (let feature of segments) {
        let path = feature.properties.pathnum;
        pathset[feature.properties.pathnum] = null;
    }
    let pathArray = Object.keys(pathset);
    pathArray.sort(function(a, b) {return a-b});
    app.pathitems = [];
    app.paths=[];
    app.paths.value='';
    for (let p of pathArray) {
        app.paths.push({pathnum:p});
    }
}

function queryServer() {
  const geoserverUrl = 'http://dwdev:8080/geoserver/ows?';

  if (originMarker) originMarker.remove();
  if (destMarker) destMarker.remove();

  // convert option list into a url parameter string
  var esc = encodeURIComponent;
  var params = [];
  for (let key in options) params.push(esc(key) + '=' + esc(options[key]));

  let finalUrl = geoserverUrl + params.join('&');

  // Fetch the segments
  fetch(finalUrl)
    .then((resp) => resp.json())
    .then(function(jsonData) {
      personJson = jsonData;
      addSegmentLayer(jsonData);
      updateTripList(jsonData);
      mymap.fitBounds(segmentLayer.getBounds());
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

function runFilter() {
  if (segmentLayer) segmentLayer.remove();

  if (app.person) options['cql_filter'] = `person_id='${app.person}'`;
  else return;

  queryServer();
}

let app = new Vue({
  el: '#panel',
  data: {
    person: '',
    trips: [],
    paths: [],
    selectedTrips: [],
    selectedPaths: [],
    pathitems: [],
  },
  methods: {
    queryServer: queryServer,
    runFilter: runFilter,
  },
  watch: {
    selectedTrips: highlightTrip,
    selectedPaths: highlightPath,
  },
});
