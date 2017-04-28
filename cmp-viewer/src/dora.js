/* DORA -- the fast-trips EXPLORAH. */
'use strict';

// Use npm and babel to support IE11/Safari
import 'babel-polyfill';
import 'isomorphic-fetch';

var mymap = L.map('sfmap').setView([37.77, -122.44], 13);
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
  select: 'geometry,segnum2013,cmp_name,cmp_from,cmp_to,cmp_dir,cmp_len',
};

let styles = {normal  : {"color": "#ff7800", "weight":4,  "opacity": 0.8, },
              selected: {"color": "#fec",    "weight":10, "opacity": 1.0, },
};

function addSegmentLayer(segments, options={}) {
  // TODO: figure out why PostGIS geojson isn't in exactly the right format.
  for (let segment of segments) {
    segment["type"] = "Feature";
    segment["geometry"] = JSON.parse(segment.geometry);
    console.log(segment);
  }

  segmentLayer = L.geoJSON(segments, {
    style: styles.normal,
    onEachFeature: function(feature, layer) {
      layer.on({ mouseover: highlightSegment,
                 click : clickedOnSegment,
      });
    },
  });
  segmentLayer.addTo(mymap);
}

let selectedSegment;

function highlightSegment(e) {
      let segment = e.target.feature;
      let cmp_id = segment.segnum2013;

      if (selectedSegment) selectedSegment.setStyle(styles.normal);

      selectedSegment = e.target;
      selectedSegment.setStyle(styles.selected);
      selectedSegment.bringToFront();
}

function clickedOnSegment(e) {
      console.log(e);
      let segment = e.target.feature;
      let cmp_id = segment.segnum2013;

      // fetch the CMP details
      let finalUrl = 'http://172.30.1.208/api/auto_speeds?cmp_id=eq.' + cmp_id;
      fetch(finalUrl).then((resp) => resp.json()).then(function(jsonData) {
          let details = "";
          for (let entry of jsonData) {
            details = details + entry.year + ": " + entry.avg_speed + "<br/>";
          }
          let popupText = "<b>"+segment.cmp_name+" "+segment.cmp_dir+"-bound</b><br/>" +
                          segment.cmp_from + " to " + segment.cmp_to +
                          "<hr/>" + details;
          console.log(popupText);

          let popup = L.popup()
            .setLatLng(e.latlng)
            .setContent(popupText)
            .openOn(mymap);
      }).catch(function(error) {
          console.log("err: "+error);
      });
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
  const geoserverUrl = 'http://172.30.1.208/api/json_segments?';

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
//      updateTripList(jsonData);
//      mymap.fitBounds(segmentLayer.getBounds());
      console.log("boom");
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

function runFilter() {
  if (segmentLayer) segmentLayer.remove();

  queryServer();

  // if (app.person) options['cql_filter'] = `person_id='${app.person}'`;
  // else return;

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


