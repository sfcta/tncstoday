'use strict';

// Must use npm and babel to support IE11/Safari
import 'babel-polyfill';
import 'isomorphic-fetch';
import 'lodash';
import vueSlider from 'vue-slider-component';
import Cookies from 'js-cookie';
import JSZip from 'jszip';

let api_server = 'http://api/api/';

// some important global variables.
let tripTotals = null;
let day = 0;
let chosenDir = 'pickups';
let cachedHourlyData = {};
let jsonByDay = {'dropoffs':{}, 'pickups':{} };
let chosenTaz = 0;
let currentChart = null;
let currentTotal = 0;
let cachedTazData = null;

mapboxgl.accessToken = "pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ";

let mymap = new mapboxgl.Map({
    container: 'sfmap',
    style: 'mapbox://styles/mapbox/light-v9',
    center: [-122.43, 37.78],
    zoom: 12,
    bearing: 0,
    pitch: 20,
    attributionControl: true,
    logoPosition: 'bottom-left',
});

// no ubers on the farallon islands (at least, not yet)
let skipTazs = new Set([384, 385, 313, 305 ]);
let weekdays = ['Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays','Sundays'];

let colorRamp1 = [
       [10,'#FBFCBD'],
       [20, '#FCE3A7'],
       [30, '#FFCD8F'],
       [40, '#FFB57D'],
       [50,'#FF9C6B'],
       [75,'#FA815F'],
       [100, '#F5695F'],
       [125, '#E85462'],
       [150, '#D6456B'],
       [175, '#C23C76'],
       [200, '#AB337D'],
       [225, '#942B7F'],
       [250, '#802482'],
       [300, '#6A1C80'],
       [350, '#55157D'],
       [400, '#401073'],
       [500, '#291057'],
       [750, '#160D38'],
       [1000, '#0A081F'],
       [1800, '#000005'],
];

let colorRamp2=[];
for (let zz=2; zz<colorRamp1.length;zz++) {
  colorRamp2[zz-2] = [colorRamp1[zz][0], colorRamp1[colorRamp1.length-zz-1][1]];
}

let colorRamp3 = [[0,'#208'],[60,'#44c'],[150,'#4a4'],[350,'#ee4'],[700,'#f46'],[1200,'#c00']];

let taColorRamp = colorRamp1;

// totals by day of week
let totalPickups =  [0,0,0,0,0,0,0];
let totalDropoffs = [0,0,0,0,0,0,0];

// ----------------------------------------------------------------------------
// PITCH TOGGLE Button
// See https://github.com/tobinbradley/mapbox-gl-pitch-toggle-control
export default class PitchToggle {
    constructor({bearing = 0, pitch = 20, minpitchzoom = null}) {
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
  for (i=0; i< taColorRamp.length; i++) {
    if (numTrips < taColorRamp[i][0]) return taColorRamp[i][1];
  }
  return taColorRamp[i-1][1];
}

let neighborhood = [];

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

        neighborhood[taz.taz] = taz.nhood;

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
            taz: taz.taz,
            shade: shade,
            trips: numTrips,
        }
        fulljson['features'].push(json);
      }
      jsonByDay[direction][d] = fulljson;
      cachedTazData = fulljson;
    }
  }
  return jsonByDay;
}

function addTazLayer(tazs, options={}) {
  buildTazDataFromJson(tazs);

  if (mymap.getLayer('taz')) mymap.removeLayer('taz');
  if (mymap.getSource('taz-source')) mymap.removeSource('taz-source');

  mymap.addSource('taz-source', {
      type: 'geojson',
      data: jsonByDay[chosenDir][day],
  });

  mymap.addLayer({
        id: 'taz',
        source: 'taz-source',
        type: 'fill-extrusion',
        paint: {
            'fill-extrusion-opacity':0.75,
            'fill-extrusion-color': {
                property: 'trips',
                stops: taColorRamp,
            },
            'fill-extrusion-height': {
                property: 'trips',
                type:'identity',
            },
        }
    }
  );

  //highlighted TAZ:
   mymap.addLayer({
       id: "taz-selected",
       type: 'fill-extrusion',
       source: 'taz-source',
       paint: {
            'fill-extrusion-opacity':1.0,
            'fill-extrusion-color': '#fff',
            'fill-extrusion-height': {
                property: 'trips',
                type:'identity',
            },
       },
       filter: ["==", "taz", ""]
   });

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
  if (first) {
    mymap.addControl(new PitchToggle({bearing: 0, pitch:20, minpitchzoom:14}), 'top-left');
    mymap.addControl(new mapboxgl.NavigationControl(), 'top-left');
    first = false;
  }
}

let first = true;

function buildChartDataFromJson(json) {
  let data = [];

  for (let h=0; h<24; h++) {
    let record = json[(h+3) % 24]; // %3 to start at 3AM
    let hour = Number(record.time.substring(0,2));
    let picks = Number(record.pickups);
    let drops = Number(record.dropoffs);

    data.push({hour:hour, pickups:picks, dropoffs:drops});
  }
  return data;
}

function createChart(data) {
  // do some weird rounding to get y-axis scale to the 20s
  let ymax = 0;
  for (let entry of data) {
    for (let key in entry) {
      if (key==='hour') continue;
      ymax = Math.max(ymax,entry[key]);
    }
  }
  let z= Math.round(ymax/20)*20 + 20;

  currentChart = new Morris.Line({
    // ID of the element in which to draw the chart.
    element: 'chart',
    data: data,
    // The name of the data record attribute that contains x-values.
    xkey: 'hour',
    // A list of names of data record attributes that contain y-values.
    ykeys: ['pickups', 'dropoffs'],
    ymax: z,
    labels: ['Pickups', 'Dropoffs'],
    lineColors: ["#44f","#f66"],
    xLabels: "Hour",
    xLabelAngle: 45,
    xLabelFormat: dateFmt,
    yLabelFormat: yFmt,
    hideHover: 'true',
    parseTime: false,
  });
}

function yFmt(y) { return Math.round(y).toLocaleString() }

const hourLabels = ['3 AM','4 AM','5 AM','6 AM','7 AM',
                  '8 AM','9 AM','10 AM','11 AM',
                  'Noon','1 PM','2 PM','3 PM',
                  '4 PM','5 PM','6 PM','7 PM',
                  '8 PM','9 PM','10 PM','11 PM',
                  '12 AM','1 AM','2 AM'];

function dateFmt(x) {
  return hourLabels[x.x];
}

// update the chart when user selects a new day
function updateChart() {
  let chart = document.getElementById("chart");
  if (!chart) return;

  let trips = Math.round(tripTotals[chosenTaz][day][chosenDir]);
  let title = buildPopupTitle(trips);

  let element = document.getElementById("popup-title");
  element.innerHTML = title;

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

let popup = null;

function buildPopupTitle(trips) {
  let title = "<h3 id=\"popup-title\">" +
              weekdays[day] + " in selected area:<br/>" + trips + " daily "+chosenDir+"</h3>"
  return title;
}

function clickedOnTaz(e) {
  chosenTaz = e.features[0].properties.taz;
  let taz = chosenTaz;
  let trips = Math.round(tripTotals[taz][day][chosenDir]);
  if (trips) {
    currentTotal = trips;
  } else {
    return;
  }

  // highlight the TAZ
  mymap.setFilter("taz-selected", ["==", "taz", chosenTaz]);

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
      let popupText = buildPopupTitle(trips) +
              "<hr/>" +
              "<div id=\"chart\" style=\"width: 300px; height:250px;\"></div>" +
              "<p text-align=\"right\" class=\"hint\"><i>"+ neighborhood[chosenTaz] +
              ": TAZ code "+ chosenTaz + "</i></p>";

      popup = new mapboxgl.Popup({closeOnClick: true})
        .setLngLat(e.lngLat)
        .setHTML(popupText);

      popup.on('close', function(p) {
        mymap.setFilter("taz-selected", ["==", "taz", '']);
      });

      // highlight the TAZ (again)
      mymap.setFilter("taz-selected", ["==", "taz", chosenTaz]);

      popup.addTo(mymap);

      let data = buildChartDataFromJson(jsonData);
      createChart(data);
  }).catch(function(error) {
      console.log("err: "+error);
  });
}

let esc = encodeURIComponent;

function calculateTripTotals(jsonData) {
  totalPickups =  [0,0,0,0,0,0,0];
  totalDropoffs = [0,0,0,0,0,0,0];

  let totals = [];
  for (let record of jsonData) {
    let taz = parseInt(record.taz);
    if (!(taz in totals)) totals[taz] = {};
    totals[taz][record.day_of_week] = record;

    // big sum total, too
    totalPickups[record.day_of_week] += record.pickups;
    totalDropoffs[record.day_of_week] += record.dropoffs;
  }

  displayDetails();  // display daily total now that we have it
  return totals;
}

function fetchTripTotals() {
  if (tripTotals) return;

  const url = api_server + 'tnc_taz_totals';

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
  const segmentUrl = api_server + 'taz_boundaries?';

  // convert option list into a url parameter string
  var taz_fields = {select: 'taz,geometry,nhood' };
  var params = [];
  for (let key in taz_fields) params.push(esc(key) + '=' + esc(taz_fields[key]));
  let finalUrl = segmentUrl + params.join('&');

  // Fetch the segments
  fetch(finalUrl)
    .then((resp) => resp.json()).then(function(jsonData) {
      addTazLayer(jsonData);
      fetchDailyDetails();
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

let dailyChart = null;

function showDailyChart() {
  let data = [];

  for (let h=0; h<24; h++) {
    let timeper = (h+3) % 24 // %3 to start at 3AM

    let picks = dailyTotals[day][timeper]['pickups'];
    let drops = dailyTotals[day][timeper]['dropoffs'];

    data.push({hour:h, pickups:picks, dropoffs:drops});
  }

  if (dailyChart) {
    dailyChart.options.labels = [ app.isPickupActive ? 'Pickups':'Dropoffs'];
    dailyChart.options.lineColors = [day < 5 ? '#1fc231':'#ffe21f']; //,["#44f","#f66"],
    dailyChart.options.ykeys = [app.isPickupActive ? 'pickups': 'dropoffs'];

    dailyChart.setData(data);

  } else {
    dailyChart = new Morris.Area({
      // ID of the element in which to draw the chart.
      element: 'daily-chart',
      data: data,
      // The name of the data record attribute that contains x-values.
      xkey: 'hour',
      // A list of names of data record attributes that contain y-values.
      ykeys: [app.isPickupActive ? 'pickups': 'dropoffs'],
      ymax: maxHourlyTrips,
      labels: [ app.isPickupActive ? 'Pickups':'Dropoffs'],
      lineColors: [day < 5 ? '#1fc231':'#ffe21f'],
      xLabels: "Hour",
      xLabelAngle: 60,
      xLabelFormat: dateFmt,
      yLabelFormat: yFmt,
      hideHover: true,
      parseTime: false,
      fillOpacity: 0.4,
      pointSize: 1,
      behaveLikeLine: true,
      eventStrokeWidth: 2,
      eventLineColors: ['#ccc'],
    });
  }

  app.nowMoloading = false;
}

function pickPickup(thing) {
  app.isPickupActive = true;
  app.isDropoffActive = false;
  chosenDir = 'pickups';

  displayDetails();
  updateColors();
  updateChart();
  showDailyChart();
}

function pickDropoff(thing) {
  app.isPickupActive = false;
  app.isDropoffActive = true;
  chosenDir = 'dropoffs';

  displayDetails();
  updateColors();
  updateChart();
  showDailyChart();
}

// SLIDER ----
let timeSlider = {
          min: 0,
          max: 24,
          disabled: true,
					width: 'auto',
					height: 3,
					direction: 'horizontal',
					dotSize: 16,
					eventType: 'auto',
					show: true,
					realTime: false,
					tooltip: 'always',
					clickable: true,
					tooltipDir: 'bottom',
					piecewise: true,
          piecewiseLabel: false,
					lazy: false,
					reverse: false,
          speed: 0.25,
          piecewiseStyle: {
            "backgroundColor": "#ccc",
            "visibility": "visible",
            "width": "6px",
            "height": "6px"
          },
          piecewiseActiveStyle: {
            "backgroundColor": "#ccc",
            "visibility": "visible",
            "width": "6px",
            "height": "6px"
          },
          labelStyle: {  "color": "#ccc"},
          labelActiveStyle: {  "color": "#ccc"},
          processStyle: {
            "backgroundColor": "#ffc"
          },
          formatter: function(index) {
            return (index==0 ? 'All Day >>' : hourLabels[index-1]);
          },
          style: {"marginTop":"-25px","marginBottom":"30px","marginLeft":"46px","marginRight":"18px"},
};

function sliderChanged(index) {
  app.isAllDay = (index==0);

  dailyChart.options.events = (index ? [index-1] : []);
  showDailyChart();

  switchToHourlyView(index);
  displayDetails();
}

function switchToHourlyView(index) {
  let hourData = loadHourlyData(index);
  mymap.getSource('taz-source').setData(hourData);
}

// update map with values for specific hour
function loadHourlyData(hour) {
  for (let item of cachedTazData.features) {

    let taz = item.properties.taz;

    let trips = cachedHourlyData[day][hour][chosenDir][taz];
    let shade = getColor(trips);
    if (!shade) shade = '#444';

    item.properties = {
        taz: taz,
        shade: shade,
        trips: trips,
    }
  }
  return cachedTazData;
}


function displayDetails() {
  try {
    let index = app.sliderValue;
    let hour = (index-1+3) % 24
    let trips = 0;

    if (index) {
      trips = dailyTotals[day][hour][chosenDir];
    } else {
      hour = 0;
      trips = app.isPickupActive ? totalPickups[day] : totalDropoffs[day];
    }

    trips = Math.round(trips/100)*100;

    if (!trips) return;

    // Build 1st line
    app.details1 = weekdays[day]
                 + (index ? (' at ' + hourLabels[index-1]) : '')
                 + ':';
    // Build 2nd line
    app.details2 = trips.toLocaleString() + " citywide " + chosenDir;
  }
  catch (error) {
    //eh, no big deal //console.log(error);
  }
}

function clickDay(chosenDay) {
  day = parseInt(chosenDay);
  app.day = day;

  displayDetails();
  updateColors();
  updateChart();
  showDailyChart();
}

function clickAllDay(e) {
  app.sliderValue = 0;
}

function clickToggleHelp() {
  helpPanel.showHelp = !helpPanel.showHelp;

  // and save it for next time
  if (helpPanel.showHelp) {
    Cookies.remove('showHelp');
  } else {
    Cookies.set('showHelp','false', {expires:365});
  }
}

// Update all colors based on trip totals
function updateColors() {
  mymap.setPaintProperty('taz','fill-extrusion-height',
    {property: 'trips',type:'identity'});

  if (app.sliderValue==0) {
    mymap.getSource('taz-source').setData(jsonByDay[chosenDir][day]);
  } else {
    switchToHourlyView(app.sliderValue);
  }
}

function flattenBuildings() {
  mymap.setPaintProperty('taz','fill-extrusion-height',0);
}

let dailyTotals = {};
let maxHourlyTrips = 0;

function fetchDailyDetails() {
  const url = api_server + 'tnc_trip_stats?select=taz,day_of_week,time,dropoffs,pickups';
  fetch(url).then((resp) => resp.json()).then(function(json) {
    buildDailyDetails(json);
  })
  .catch(function(error) {
    console.log("err: "+error);
  });
}

function buildDailyDetails(json) {
    cachedHourlyData = {};
    dailyTotals = {};
    for (let record of json) {
      let taz = record.taz;
      let pickup = record.pickups;
      let dropoff = record.dropoffs;
      let day = record.day_of_week;
      let time = parseInt(record.time.substring(0,2));

      let time_index = (time+24-3) % 24 + 1

      if (!dailyTotals[day]) dailyTotals[day] = [];

      if (!cachedHourlyData[day]) cachedHourlyData[day] = [];
      if (!cachedHourlyData[day][time_index]) cachedHourlyData[day][time_index] = {'dropoffs':{}, 'pickups':{}};
      if (!cachedHourlyData[day][0]) cachedHourlyData[day][0] = {'dropoffs':{}, 'pickups':{}};
      if (!cachedHourlyData[day][0]['dropoffs'][taz]) {
        cachedHourlyData[day][0]['dropoffs'][taz] = 0;
        cachedHourlyData[day][0]['pickups'][taz] = 0;
      }

      if (!dailyTotals[day][time]) {
        dailyTotals[day][time] = {};
        dailyTotals[day][time]['dropoffs'] = 0;
        dailyTotals[day][time]['pickups'] = 0;
      }

      // save values -- using 3hr index offset
      cachedHourlyData[day][time_index]['dropoffs'][taz] = 8*dropoff;  // 8*cheating to make colors pop
      cachedHourlyData[day][time_index]['pickups'][taz] = 8*pickup;

      // save summary daily values
      dailyTotals[day][time]['dropoffs'] += dropoff;
      dailyTotals[day][time]['pickups'] += pickup;
      cachedHourlyData[day][0]['dropoffs'][taz] += dropoff;
      cachedHourlyData[day][0]['pickups'][taz] += pickup;
    }

    app.timeSlider.disabled = false;
    maxHourlyTrips = 20000;
    showDailyChart();

    return dailyTotals;
}

function fetchZipFile() {
  const url = '/db-files.zip';

  fetch(url)
  .then((resp) => resp.blob())
  .then((content) => new JSZip().loadAsync(content))
  .then((zzip) => {
    zzip.file('tnc_taz_totals.json').async('string').then((text) => {
      let json = JSON.parse(text);
      tripTotals = calculateTripTotals(json);

      zzip.file('taz_boundaries.json').async('string').then((text) => {
        let json = JSON.parse(text);
        addTazLayer(json);

        zzip.file('tnc_trip_stats.json').async('string').then((text) => {
          let json = JSON.parse(text);
          buildDailyDetails(json);
        });
      });
    });
  })
	.catch(function(error) {
       console.log("err: failed loading .zipfile, trying API instead; "+error);
       fetchTripTotals();
  });
}

// eat some cookies -- so we can hide the help permanently
let cookieShowHelp = Cookies.get('showHelp');

let app = new Vue({
  el: '#panel',
  data: {
    isPickupActive: true,
    isDropoffActive: false,
    sliderValue: 0,
    timeSlider: timeSlider,
    day: 0,
    days: ['Mo','Tu','We','Th','Fr','Sa','Su'],
    details1: '',
    details2: '',
    nowMoloading: true,
    isAllDay: true,
  },
  watch: {
    sliderValue: function(value) {
      this.getSliderValue();
    }
  },
  methods: {
    pickPickup: pickPickup,
    pickDropoff: pickDropoff,
    clickDay: clickDay,
    clickAllDay: clickAllDay,
    clickToggleHelp: clickToggleHelp,
    getSliderValue: _.debounce(
      function() {
        sliderChanged(this.sliderValue);
      }, 30
    ),
  },
  components: {
    vueSlider,
  }
});

let helpPanel = new Vue({
  el: '#helpbox',
  data: {
    showHelp: (cookieShowHelp==undefined),
  },
  methods: {
    clickToggleHelp: clickToggleHelp,
  },
});

//fetchZipFile();
fetchTripTotals();
