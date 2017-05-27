'use strict';

// Use npm and babel to support IE11/Safari
import 'babel-polyfill';
import 'isomorphic-fetch';
import vueSlider from 'vue-slider-component';

let theme = "dark";

let api_server = 'http://172.30.1.135/tnc/';

var mymap = L.map('sfmap').setView([37.77, -122.44], 13);
var url = 'https://api.mapbox.com/styles/v1/mapbox/'+theme+'-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}';
var token = 'pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ';
var attribution ='<a href="http://openstreetmap.org">OpenStreetMap</a> | ' +
                 '<a href="http://mapbox.com">Mapbox</a>';
L.tileLayer(url, {
  attribution:attribution,
  maxZoom: 18,
  accessToken:token,
}).addTo(mymap);

let segmentLayer;
let selectedSegment, popupSegment, hoverColor, popupColor;

let speedCache = {};
let tripTotals = {};

let day = 0;

let chosenPeriod = 'avail_trips';

var taz_fields = {
  select: 'taz,geometry',
};

// no ubers on the farallon islands
let skipTazs = new Set([384, 385, 313, 305 ]);

let dark_styles = { normal  : {fillOpacity: 0.8, opacity: 0.0},
                    selected: {fillOpacity: 0.4, color: "#fff", opacity: 1.0},
                    popup   : {color: "#fff",    weight:5, opacity: 1.0, fillOpacity: 0.8},
};

let light_styles = {normal  : {"color": "#3c6", "weight": 4, "opacity": 1.0 },
                    selected: {"color": "#39f", "weight": 10, "opacity": 1.0 },
                    popup   : {"color": "#33f", "weight": 10, "opacity": 1.0 }
};

let losColor = {'A':'#060', 'B':'#9f0', 'C':'#ff3', 'D':'#f90', 'E':'#f60', 'F':'#c00'};

let styles = (theme==='dark' ? dark_styles : light_styles);


let totalColors =       [ '#208', '#44c', '#4a4', '#ee4' , '#F46', '#c00'];
let totalColorCutoffs = [   60.0 ,   150.0 ,   350.0 ,  700.0, 1200.0];

function getColor(numTrips) {
  let i;
  for (i=0; i< totalColorCutoffs.length; i++) {
    if (numTrips < totalColorCutoffs[i]) return totalColors[i];
  }
  return totalColors[i]
}


let tazLayers = {};

function addTazLayer(tazs, options={}) {
  for (let taz of tazs) {
    if (taz.taz > 981) continue;
    if (skipTazs.has(taz.taz)) continue;

    let json = JSON.parse(taz.geometry);
    json['taz'] = taz.taz;

    let shade = '#222';

    if (taz.taz in tripTotals) {
      let mine = tripTotals[parseInt(taz.taz)][day];
      shade = getColor(mine[chosenPeriod]);
      if (!shade) shade = '#222';
    }

    let layer = L.geoJSON(json, {
      style: {
        opacity:0.0,
        fillColor: shade,
        fillOpacity: 0.8,
      },

      onEachFeature: function(feature, layer) {
        layer.on({ mouseover: hoverOnTaz,
                   click : clickedOnTaz,
        });
      },
    });

    // hang onto this layer so we can do stuff to it later
    tazLayers[parseInt(taz.taz)] = layer;
    layer.addTo(mymap);
  }
}

function addSegmentLayer(segments, options={}) {
  return;
  // TODO: figure out why PostGIS geojson isn't in exactly the right format.
  for (let segment of segments) {
    segment["type"] = "Feature";
    segment["geometry"] = JSON.parse(segment.geometry);
  }

  segmentLayer = L.geoJSON(segments, {
    style: {color: 'red'},
    onEachFeature: function(feature, layer) {
      layer.on({ mouseover: hoverOnSegment,
                 click : clickedOnSegment,
      });
    },
  });

  if (mymap.segmentLayer) {
    selectedSegment = popupSegment = hoverColor = popupColor = null;
    mymap.removeLayer(segmentLayer);
    segmentLayer = null;
  }
  segmentLayer.addTo(mymap);
}

function styleByTotalTrips(feature) {
  console.log("BOOP:");
  console.log(feature);
  return;
  //let avail_trips = totalTrips[
  //let shade =

  return {opacity: 0.0, fillColor: "red", fillOpacity: thing};
}


function hoverOnTaz(e) {
      // don't do anything if we just moused over the already-popped up segment
      if (e.target == popupSegment) return;

      let segment = e.target.feature;
      let taz = segment.geometry.taz;

      // return previously-hovered segment to its original color
      if (selectedSegment != popupSegment) {
        if (selectedSegment) {
          selectedSegment.setStyle(styles.normal);
        }
      }

      selectedSegment = e.target;
      selectedSegment.setStyle(styles.selected);
      selectedSegment.bringToFront();
}

function buildChartHtmlFromCmpData(json) {
  let byYear = {}
  let data = [];

  for (let entry of json) {
    let speed = Number(entry.avg_speed).toFixed(1);
    if (speed === 'NaN') continue;
    if (!byYear[entry.year]) byYear[entry.year] = {};
    byYear[entry.year][entry.period] = speed;
  }

  for (let year in byYear) {
    data.push({year:year, am: byYear[year]['AM'], pm: byYear[year]['PM']});
  }

  new Morris.Line({
    // ID of the element in which to draw the chart.
    element: 'chart',
    // Chart data records -- each entry in this array corresponds to a point on
    // the chart.
    data: data,
    // The name of the data record attribute that contains x-values.
    xkey: 'year',
    // A list of names of data record attributes that contain y-values.
    ykeys: ['am', 'pm'],
    // Labels for the ykeys -- will be displayed when you hover over the
    // chart.
    labels: ['AM', 'PM'],
    lineColors: ["#f66","#44f"],
    xLabels: "year",
    xLabelAngle: 45,
  });
}

function clickedOnTaz(e) {
      let segment = e.target.feature;

      console.log(segment);
      let cmp_id = segment.segnum2013;

      // highlight it
      if (popupSegment) {
        let cmp_id = popupSegment.feature.segnum2013;
        let color = losColor[segmentLos[cmp_id]];
        popupSegment.setStyle({color:color, weight:4, opacity:1.0});
      }
      e.target.setStyle(styles.popup);
      popupSegment = e.target;

      // delete old chart
      let chart = document.getElementById("chart");
      if (chart) chart.parentNode.removeChild(chart);

      // fetch the CMP details
      let finalUrl = api_server + 'auto_speeds?cmp_id=eq.' + cmp_id;
      fetch(finalUrl).then((resp) => resp.json()).then(function(jsonData) {
          let popupText = "<b>"+segment.cmp_name+" "+segment.cmp_dir+"-bound</b><br/>" +
                          segment.cmp_from + " to " + segment.cmp_to +
                          "<hr/>" +
                          "<div id=\"chart\" style=\"width: 300px; height:250px;\"></div>";

          let popup = L.popup()
              .setLatLng(e.latlng)
              .setContent(popupText)
              .openOn(mymap);

          popup.on("remove", function(e) {
            let cmp_id = popupSegment.feature.segnum2013;
            let color = losColor[segmentLos[cmp_id]];
            popupSegment.setStyle({color:color, weight:4, opacity:1.0});
            popupSegment = null;
          });

          let chartHtml = buildChartHtmlFromCmpData(jsonData);
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
  const url = api_server + 'taz_total?';

  var fields = {}; //day_of_week: 'eq.4',};

  // convert option list into a url parameter string
  var params = [];
  for (let key in fields) params.push(esc(key) + '=' + esc(fields[key]));
  let finalUrl = url + params.join('&');
  console.log(finalUrl);

  // Fetch the segments
  fetch(finalUrl)
    .then((resp) => resp.json())
    .then(function(jsonData) {
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
  var params = [];
  for (let key in taz_fields) params.push(esc(key) + '=' + esc(taz_fields[key]));
  let finalUrl = segmentUrl + params.join('&');
  console.log(finalUrl);

  // Fetch the segments
  fetch(finalUrl)
    .then((resp) => resp.json())
    .then(function(jsonData) {
      let personJson = jsonData;
      addTazLayer(personJson);
      //colorByLOS(personJson, app.sliderValue);
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

let segmentLos = {};


function colorByLOS(personJson, year) {

  // Don't re-fetch if we already have the color data
  if (year in speedCache) {
    segmentLos = speedCache[year];
    segmentLayer.clearLayers();
    addSegmentLayer(personJson);
    return;
  }

  let options = {
    year: 'eq.'+ year,
    period: 'eq.' + chosenPeriod,
    select: 'cmp_id,name_HCM1985,from,to,dir,avg_speed,year,period,los_HCM1985',
  };
  const speedUrl = api_server + 'auto_speeds?';
  var params = [];
  for (let key in options) params.push(esc(key) + '=' + esc(options[key]));
  let finalUrl = speedUrl + params.join('&');

  fetch(finalUrl).then((resp) => resp.json()).then(function(data) {
    let losData = {};
    for (let segment in data) {
      let thing = data[segment];
      losData[thing.cmp_id] = thing.los_HCM1985;
    }
    // save it for later
    speedCache[year] = losData;
    segmentLos = losData;

    // add it to the map
    if (segmentLayer) segmentLayer.clearLayers();
    addSegmentLayer(personJson);
  }).catch(function(error) {
    console.log(error);
  });

}

function pickAM(thing) {
  app.isAMactive = true;
  app.isPMactive = false;
  chosenPeriod = 'avail_trips';
  updateColors();
}

function pickPM(thing) {
  app.isAMactive = false;
  app.isPMactive = true;
  chosenPeriod = 'accpt_trips';
  updateColors();
}

// SLIDER ----
let timeSlider = {
          data: [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", ],
          sliderValue: "Mon",
					width: 'auto',
					height: 6,
					direction: 'horizontal',
					dotSize: 16,
					eventType: 'auto',
					disabled: false,
					show: true,
					realTime: false,
					tooltip: 'always',
					clickable: true,
					tooltipDir: 'bottom',
					piecewise: true,
          piecewiseLabel: true,
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
// ------

function sliderChanged(thing) {
  let newDay = timeSlider.data.indexOf(thing);
  day = parseInt(newDay);

  updateColors();
}

// Update all colors based on trip totals
function updateColors() {
  for (let taz in tazLayers) {
    let shade = '#222';
    let layer = tazLayers[taz];

    let tazData = tripTotals[parseInt(taz)];
    if (tazData) {
      let dayData = tazData[day];
      shade = getColor(dayData[chosenPeriod]);
      if (!shade) shade = '#222';
    }
    layer.setStyle({fillColor: shade});
  }
}

let app = new Vue({
  el: '#panel',
  data: {
    isAMactive: true,
    isPMactive: false,
    sliderValue: 2015,
    timeSlider: timeSlider,
  },
  methods: {
    pickAM: pickAM,
    pickPM: pickPM,
  },
  watch: {
    sliderValue: sliderChanged,
  },
  components: {
    vueSlider,
  }
});

fetchTripTotals();
