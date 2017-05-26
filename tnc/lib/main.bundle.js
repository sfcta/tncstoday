/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// Use npm and babel to support IE11/Safari
//import 'babel-polyfill';
//import 'isomorphic-fetch';
//import vueSlider from 'vue-slider-component';

var theme = "dark";

var api_server = 'http://api.sfcta.org/tnc/';

var mymap = L.map('sfmap').setView([37.79, -122.44], 14);
var url = 'https://api.mapbox.com/styles/v1/mapbox/' + theme + '-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}';
var token = 'pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ';
var attribution = '<a href="http://openstreetmap.org">OpenStreetMap</a> | ' + '<a href="http://mapbox.com">Mapbox</a>';
L.tileLayer(url, {
  attribution: attribution,
  maxZoom: 18,
  accessToken: token
}).addTo(mymap);

var segmentLayer = void 0;
var selectedSegment = void 0,
    popupSegment = void 0,
    hoverColor = void 0,
    popupColor = void 0;

var speedCache = {};
var tripTotals = {};

var taz_fields = {
  select: 'taz,geometry'
};

var dark_styles = { normal: { fillOpacity: 0.8, opacity: 0.0 },
  selected: { fillOpacity: 0.4, color: "#fff", opacity: 1.0 },
  popup: { color: "#fff", weight: 5, opacity: 1.0, fillOpacity: 0.8 }
};

var light_styles = { normal: { "color": "#3c6", "weight": 4, "opacity": 1.0 },
  selected: { "color": "#39f", "weight": 10, "opacity": 1.0 },
  popup: { "color": "#33f", "weight": 10, "opacity": 1.0 }
};

var losColor = { 'A': '#060', 'B': '#9f0', 'C': '#ff3', 'D': '#f90', 'E': '#f60', 'F': '#c00' };

var styles = theme === 'dark' ? dark_styles : light_styles;

var totalColors = ['#208', '#44c', '#4a4', '#ee4', '#F46', '#c00'];
var totalColorCutoffs = [60.0, 150.0, 350.0, 700.0, 1200.0];

function getColor(numTrips) {
  var i = void 0;
  for (i = 0; i < totalColorCutoffs.length; i++) {
    if (numTrips < totalColorCutoffs[i]) return totalColors[i];
  }
  return totalColors[i];
}

function addTazLayer(tazs) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = tazs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var taz = _step.value;

      if (taz.taz > 981) continue;
      var json = JSON.parse(taz.geometry);
      json['taz'] = taz.taz;

      var shade = '#222';

      if (taz.taz in tripTotals) {
        var mine = tripTotals[parseInt(taz.taz)][5];
        shade = getColor(mine['avail_trips']);
        if (!shade) shade = '#222';
      }

      L.geoJSON(json, {
        style: {
          opacity: 0.0,
          fillColor: shade,
          fillOpacity: 0.8
        },

        onEachFeature: function onEachFeature(feature, layer) {
          layer.on({ mouseover: hoverOnTaz,
            click: clickedOnTaz
          });
        }
      }).addTo(mymap);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }
}

function addSegmentLayer(segments) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  return;
  // TODO: figure out why PostGIS geojson isn't in exactly the right format.
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = segments[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var segment = _step2.value;

      segment["type"] = "Feature";
      segment["geometry"] = JSON.parse(segment.geometry);
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  segmentLayer = L.geoJSON(segments, {
    style: { color: 'red' },
    onEachFeature: function onEachFeature(feature, layer) {
      layer.on({ mouseover: hoverOnSegment,
        click: clickedOnSegment
      });
    }
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

  return { opacity: 0.0, fillColor: "red", fillOpacity: thing };
}

function hoverOnTaz(e) {
  // don't do anything if we just moused over the already-popped up segment
  if (e.target == popupSegment) return;

  var segment = e.target.feature;
  var taz = segment.geometry.taz;

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
  var byYear = {};
  var data = [];

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = json[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var entry = _step3.value;

      var speed = Number(entry.avg_speed).toFixed(1);
      if (speed === 'NaN') continue;
      if (!byYear[entry.year]) byYear[entry.year] = {};
      byYear[entry.year][entry.period] = speed;
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  for (var year in byYear) {
    data.push({ year: year, am: byYear[year]['AM'], pm: byYear[year]['PM'] });
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
    lineColors: ["#f66", "#44f"],
    xLabels: "year",
    xLabelAngle: 45
  });
}

function clickedOnTaz(e) {
  var segment = e.target.feature;
  var cmp_id = segment.segnum2013;

  // highlight it
  if (popupSegment) {
    var _cmp_id = popupSegment.feature.segnum2013;
    var color = losColor[segmentLos[_cmp_id]];
    popupSegment.setStyle({ color: color, weight: 4, opacity: 1.0 });
  }
  e.target.setStyle(styles.popup);
  popupSegment = e.target;

  // delete old chart
  var chart = document.getElementById("chart");
  if (chart) chart.parentNode.removeChild(chart);

  // fetch the CMP details
  var finalUrl = api_server + 'auto_speeds?cmp_id=eq.' + cmp_id;
  fetch(finalUrl).then(function (resp) {
    return resp.json();
  }).then(function (jsonData) {
    var popupText = "<b>" + segment.cmp_name + " " + segment.cmp_dir + "-bound</b><br/>" + segment.cmp_from + " to " + segment.cmp_to + "<hr/>" + "<div id=\"chart\" style=\"width: 300px; height:250px;\"></div>";

    var popup = L.popup().setLatLng(e.latlng).setContent(popupText).openOn(mymap);

    popup.on("remove", function (e) {
      var cmp_id = popupSegment.feature.segnum2013;
      var color = losColor[segmentLos[cmp_id]];
      popupSegment.setStyle({ color: color, weight: 4, opacity: 1.0 });
      popupSegment = null;
    });

    var chartHtml = buildChartHtmlFromCmpData(jsonData);
  }).catch(function (error) {
    console.log("err: " + error);
  });
}

var esc = encodeURIComponent;

function calculateTripTotals(jsonData) {
  var totals = [];
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = jsonData[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var record = _step4.value;

      var taz = 0 + record.taz;
      if (!(taz in totals)) totals[taz] = {};
      totals[taz][record.day_of_week] = record;
    }
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4.return) {
        _iterator4.return();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  return totals;
}

function fetchTripTotals() {
  var url = api_server + 'taz_total?';

  var fields = {}; //day_of_week: 'eq.4',};

  // convert option list into a url parameter string
  var params = [];
  for (var key in fields) {
    params.push(esc(key) + '=' + esc(fields[key]));
  }var finalUrl = url + params.join('&');
  console.log(finalUrl);

  // Fetch the segments
  fetch(finalUrl).then(function (resp) {
    return resp.json();
  }).then(function (jsonData) {
    tripTotals = calculateTripTotals(jsonData);
    queryServer();
  }).catch(function (error) {
    console.log("err: " + error);
  });
}

function queryServer() {
  var segmentUrl = api_server + 'json_taz?';

  // convert option list into a url parameter string
  var params = [];
  for (var key in taz_fields) {
    params.push(esc(key) + '=' + esc(taz_fields[key]));
  }var finalUrl = segmentUrl + params.join('&');
  console.log(finalUrl);

  // Fetch the segments
  fetch(finalUrl).then(function (resp) {
    return resp.json();
  }).then(function (jsonData) {
    var personJson = jsonData;
    addTazLayer(personJson);
    //colorByLOS(personJson, app.sliderValue);
  }).catch(function (error) {
    console.log("err: " + error);
  });
}

var segmentLos = {};

function colorByLOS(personJson, year) {

  // Don't re-fetch if we already have the color data
  if (year in speedCache) {
    segmentLos = speedCache[year];
    segmentLayer.clearLayers();
    addSegmentLayer(personJson);
    return;
  }

  var options = {
    year: 'eq.' + year,
    period: 'eq.' + chosenPeriod,
    select: 'cmp_id,name_HCM1985,from,to,dir,avg_speed,year,period,los_HCM1985'
  };
  var speedUrl = api_server + 'auto_speeds?';
  var params = [];
  for (var key in options) {
    params.push(esc(key) + '=' + esc(options[key]));
  }var finalUrl = speedUrl + params.join('&');

  fetch(finalUrl).then(function (resp) {
    return resp.json();
  }).then(function (data) {
    var losData = {};
    for (var segment in data) {
      var _thing = data[segment];
      losData[_thing.cmp_id] = _thing.los_HCM1985;
    }
    // save it for later
    speedCache[year] = losData;
    segmentLos = losData;

    // add it to the map
    if (segmentLayer) segmentLayer.clearLayers();
    addSegmentLayer(personJson);
  }).catch(function (error) {
    console.log(error);
  });
}

var chosenPeriod = 'AM';

function pickAM(thing) {
  app.isAMactive = true;
  app.isPMactive = false;
  chosenPeriod = 'AM';
  //queryServer();
}

function pickPM(thing) {
  app.isAMactive = false;
  app.isPMactive = true;
  chosenPeriod = 'PM';
  //queryServer();
}

// SLIDER ----
var timeSlider = {
  data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  sliderValue: "Fri",
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
  piecewiseLabel: false,
  lazy: false,
  reverse: false,
  labelActiveStyle: { "color": "#fff" },
  piecewiseStyle: {
    "backgroundColor": "#888",
    "visibility": "visible",
    "width": "14px",
    "height": "14px"
  }
};
// ------

function sliderChanged(thing) {
  console.log(thing);
  //queryServer();
}

var app = new Vue({
  el: '#panel',
  data: {
    isAMactive: true,
    isPMactive: false,
    sliderValue: 2015,
    timeSlider: timeSlider
  },
  methods: {
    pickAM: pickAM,
    pickPM: pickPM
  },
  watch: {
    sliderValue: sliderChanged
  },
  components: {
    //vueSlider,
  }
});

fetchTripTotals();

/***/ })
/******/ ]);