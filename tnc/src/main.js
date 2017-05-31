'use strict';

// Must use npm and babel to support IE11/Safari
import 'babel-polyfill';
import 'isomorphic-fetch';
import vueSlider from 'vue-slider-component';

let theme = "dark";

let api_server = 'http://api/tnc/';

// some important global variables.
let tripTotals = {};
let day = 0;
let chosenDir = 'accpt_trips';
let jsonByDay = {'avail_trips':{}, 'accpt_trips':{} };
let chosenTaz = 0;
let currentChart = null;
let currentTotal = 0;

mapboxgl.accessToken = "pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ";

let mymap = new mapboxgl.Map({
    container: 'sfmap',
    style: 'mapbox://styles/mapbox/dark-v9',
    center: [-122.43, 37.78],
    zoom: 12,
    bearing: -30,
    pitch: 50,
    attributionControl: true,
    logoPosition: 'bottom-left',
});

// no ubers on the farallon islands (at least, not yet)
let skipTazs = new Set([384, 385, 313, 305 ]);

let dark_styles = { normal  : {fillOpacity: 0.8, opacity: 0.0},
                    selected: {fillOpacity: 0.4, color: "#fff", opacity: 1.0},
                    popup   : {color: "#fff",    weight:5, opacity: 1.0, fillOpacity: 0.8},
};
let styles = dark_styles; // (theme==='dark' ? dark_styles : darklight_styles);

let colorStops = [[0,'#208'],[60,'#44c'],[150,'#4a4'],[350,'#ee4'],[700,'#f46'],[1200,'#c00']];
let totalColors =       [ '#208', '#44c', '#4a4', '#ee4' , '#F46', '#c00'];
let totalColorCutoffs = [   60.0 ,   150.0 ,   350.0 ,  700.0, 1200.0];

// ----------------------------------------------------------------------------
// PITCH TOGGLE Button
// See https://github.com/tobinbradley/mapbox-gl-pitch-toggle-control
export default class PitchToggle {
    constructor({bearing = -20, pitch = 50, minpitchzoom = null}) {
        this._bearing = bearing;
        this._pitch = pitch;
        this._minpitchzoom = minpitchzoom;
    }
    onAdd(map) {
        this._map = map;
        let _this = this;

        this._btn = document.createElement('button');
        this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-pitchtoggle-2d';
        this._btn.type = 'button';
        this._btn['aria-label'] = 'Toggle Pitch';
        this._btn.onclick = function() {
            if (map.getPitch() === 0) {
                updateColors();
                let options = {pitch: _this._pitch, bearing: _this._bearing};
                if (_this._minpitchzoom && map.getZoom() > _this._minpitchzoom) {
                    options.zoom = _this._minpitchzoom;
                }
                map.easeTo(options);
                _this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-pitchtoggle-2d';
            } else {
                flattenBuildings();
                map.easeTo({pitch: 0, bearing: 0});
                _this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-pitchtoggle-3d';
            }
        };
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.appendChild(this._btn);

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

function getColor(numTrips) {
  let i;
  for (i=0; i< totalColorCutoffs.length; i++) {
    if (numTrips < totalColorCutoffs[i]) return totalColors[i];
  }
  return totalColors[i]
}

// Create one giant GeoJSON layer. This should really be done in PostGIS, but I'm rushing.
// See http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html
function buildTazDataFromJson(tazs, options) {
  // loop for the two directions
  for (let direction in jsonByDay) {
    // loop for each day of week
    for (let d=0; d<7; d++) {
      let fulljson = {};
      fulljson['type'] = 'FeatureCollection';
      fulljson['features'] = [];

      for (let taz of tazs) {
        if (taz.taz > 981) continue;
        if (skipTazs.has(taz.taz)) continue;

        let json = {};
        json['type'] = 'Feature';
        json['geometry'] = JSON.parse(taz.geometry);
        let shade = '#222';
        let numTrips = 0;
        if (taz.taz in tripTotals) {
            let trips = tripTotals[parseInt(taz.taz)][d];
            numTrips = trips[direction];
            shade = getColor(numTrips);
            if (!shade) shade = '#222';
        }
        json['properties'] = {
            taz: 0+taz.taz,
            shade: shade,
            trips: numTrips,
        }
        fulljson['features'].push(json);
      }
      jsonByDay[direction][d] = fulljson;
    }
  }
  return jsonByDay;
}

function addTazLayer(tazs, options={}) {
  buildTazDataFromJson(tazs);

  mymap.addSource('taz', {
      type: 'geojson',
      data: jsonByDay[chosenDir][day],
  });

  mymap.addLayer({
        source: 'taz',
        id: 'taz',
        type: 'fill-extrusion',
        paint: {
            'fill-extrusion-opacity':0.6,
            'fill-extrusion-color': {
                property: 'trips',
                stops: colorStops,
            },
            'fill-extrusion-height': {
                property: 'trips',
                type:'identity',
            },
        }
    }
  );

  // make taz hover cursor a pointer so user knows they can click.
  mymap.on("mousemove", "taz", function(e) {
      mymap.getCanvas().style.cursor = e ? 'pointer' : '-webkit-grab';
  });

  mymap.on("mouseleave", "taz", function() {
      mymap.getCanvas().style.cursor = '-webkit-grab';
  });

  mymap.on("click", "taz", function(e) {
    clickedOnTaz(e);
  });

  // Add nav controls
  mymap.addControl(new PitchToggle({bearing: -30, pitch:50, minpitchzoom:14}), 'top-left');
  mymap.addControl(new mapboxgl.NavigationControl(), 'top-left');
}

function buildChartDataFromJson(json) {
  let data = [];

  for (let h=0; h<24; h++) {
    let hour = json[(h+3) % 24]; // %3 to start at 3AM
    let picks = Number(hour.accpt_trips);
    let drops = Number(hour.avail_trips);

    data.push({hour:h, pickups:picks, dropoffs:drops});
  }
  return data;
}

function createChart(data) {
  currentChart = new Morris.Line({
    // ID of the element in which to draw the chart.
    element: 'chart',
    // Chart data records -- each entry in this array corresponds to a point on
    // the chart.
    data: data,
    // The name of the data record attribute that contains x-values.
    xkey: 'hour',
    // A list of names of data record attributes that contain y-values.
    ykeys: ['pickups', 'dropoffs'],
    ymax: 'auto '+ Math.round(currentTotal/5),
    // Labels for the ykeys -- will be displayed when you hover over the
    // chart.
    labels: ['Pickups', 'Dropoffs'],
    lineColors: ["#44f","#f66"],
    xLabels: "Hour",
    xLabelAngle: 45,
    xLabelFormat: dateFmt,
    hideHover: 'true',
    parseTime: false,
  });
}

function dateFmt(x) {
  const hourLabels = ['3 AM','4 AM','5 AM','6 AM','7 AM',
                  '8 AM','9 AM','10 AM','11 AM',
                  'Noon','1 PM','2 PM','3 PM',
                  '4 PM','5 PM','6 PM','7 PM',
                  '8 PM','9 PM','10 PM','11 PM',
                  '12 AM','1 AM','2 AM'];
  return hourLabels[x.x];
}

// update the chart when user selects a new day
function updateChart() {
  let chart = document.getElementById("chart");
  if (!chart) return;

  // fetch the details
  let finalUrl = api_server + 'tnc_trip_stats?taz=eq.' + chosenTaz
                            + '&day_of_week=eq.' + day

  fetch(finalUrl).then((resp) => resp.json()).then(function(jsonData) {
      let data = buildChartDataFromJson(jsonData);
      if (currentChart) currentChart.setData(data);
  }).catch(function(error) {
      console.log("err: "+error);
  });
}

function clickedOnTaz(e) {
  chosenTaz = e.features[0].properties.taz;
  let taz = chosenTaz;
  let trips = Math.round(tripTotals[taz][day][chosenDir]);
  if (trips) {
    currentTotal = trips;
    app.details = ''+ trips + ' Daily trips';
  } else {
    return;
  }

  //TODO highlight it

  // delete old chart
  let chart = document.getElementById("chart");
  if (chart) {
    chart.parentNode.removeChild(chart);
    currentChart = null;
  }

  // fetch the CMP details
  let finalUrl = api_server + 'tnc_trip_stats?taz=eq.' + taz
                            + '&day_of_week=eq.' + day

  fetch(finalUrl).then((resp) => resp.json()).then(function(jsonData) {
      let popupText = "<h2>"+trips+" Daily trips</h2>" +
                      "<hr/>" +
                      "<div id=\"chart\" style=\"width: 300px; height:250px;\"></div>";

      let popup = new mapboxgl.Popup({closeOnClick: true})
        .setLngLat(e.lngLat)
        .setHTML(popupText)
        .addTo(mymap);

      let data = buildChartDataFromJson(jsonData);
      createChart(data);
  }).catch(function(error) {
      console.log("err: "+error);
  });
}

let esc = encodeURIComponent;

function calculateTripTotals(jsonData) {
  let totals = [];
  for (let record of jsonData) {
    let taz = 0+record.taz;
    if (!(taz in totals)) totals[taz] = {};
    totals[taz][record.day_of_week] = record;
  }
  return totals;
}

function fetchTripTotals() {
  const url = api_server + 'taz_total';

  fetch(url)
    .then((resp) => resp.json()).then(function(jsonData) {
      tripTotals = calculateTripTotals(jsonData);
      queryServer();
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

function queryServer() {
  const segmentUrl = api_server + 'json_taz?';

  // convert option list into a url parameter string
  var taz_fields = {select: 'taz,geometry' };
  var params = [];
  for (let key in taz_fields) params.push(esc(key) + '=' + esc(taz_fields[key]));
  let finalUrl = segmentUrl + params.join('&');

  // Fetch the segments
  fetch(finalUrl)
    .then((resp) => resp.json()).then(function(jsonData) {
      addTazLayer(jsonData);
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

function pickPickup(thing) {
  app.isPickupActive = true;
  app.isDropoffActive = false;

  chosenDir = 'accpt_trips';
  updateColors();
}

function pickDropoff(thing) {
  app.isPickupActive = false;
  app.isDropoffActive = true;

  chosenDir = 'avail_trips';
  updateColors();
}

// SLIDER ----
let timeSlider = {
          data: [[...Array(24).keys()]],
					disabled: true,
          sliderValue: "Mon",
					width: 'auto',
					height: 6,
					direction: 'horizontal',
					dotSize: 16,
					eventType: 'auto',
					show: true,
					realTime: false,
					tooltip: 'always',
					clickable: true,
					tooltipDir: 'bottom',
					piecewise: false,
          piecewiseLabel: false,
					lazy: false,
					reverse: false,
          labelActiveStyle: {  "color": "#fff"},
          piecewiseStyle: {
            "backgroundColor": "#fff",
            "visibility": "visible",
            "width": "14px",
            "height": "14px"
          },
};

function sliderChanged(thing) {
  return;
  let newDay = timeSlider.data.indexOf(thing);
  day = parseInt(newDay);
  updateColors();
}

function clickDay(chosenDay) {
  day = parseInt(chosenDay);
  app.day = day;
  updateColors();
  updateChart();
}

// Update all colors based on trip totals
function updateColors() {
  mymap.setPaintProperty('taz','fill-extrusion-height',
    {property: 'trips',type:'identity'});
  mymap.getSource('taz').setData(jsonByDay[chosenDir][day]);
}

function flattenBuildings() {
  mymap.setPaintProperty('taz','fill-extrusion-height',0);
}

let app = new Vue({
  el: '#panel',
  data: {
    isPickupActive: true,
    isDropoffActive: false,
    sliderValue: 2015,
    timeSlider: timeSlider,
    day: 0,
    days: ['Mo','Tu','We','Th','Fr','Saturday','Sunday'],
    details: "",
  },
  methods: {
    pickPickup: pickPickup,
    pickDropoff: pickDropoff,
    clickDay: clickDay,
  },
  watch: {
    sliderValue: sliderChanged,
  },
  components: {
    vueSlider,
  }
});

fetchTripTotals();
