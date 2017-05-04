'use strict';

// Use npm and babel to support IE11/Safari
import 'babel-polyfill';
import 'isomorphic-fetch';

let theme = "dark";

var mymap = L.map('sfmap').setView([37.77, -122.44], 14);
var url = 'https://api.mapbox.com/styles/v1/mapbox/'+theme+'-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}';
var token = 'pk.eyJ1IjoicHNyYyIsImEiOiJjaXFmc2UxanMwM3F6ZnJtMWp3MjBvZHNrIn0._Dmske9er0ounTbBmdRrRQ';
var attribution ='<a href="http://openstreetmap.org">OpenStreetMap</a> | ' +
                 '<a href="http://mapbox.com">Mapbox</a>';
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

let dark_styles = { normal  : {"color": "#ff7800", "weight":4,  "opacity": 1.0, },
                    selected: {"color": "#39f",    "weight":10, "opacity": 1.0, },
                    popup   : {"color": "#33f",    "weight":10, "opacity": 1.0, },
};

let light_styles = {normal  : {"color": "#3c6", "weight": 4, "opacity": 1.0 },
                    selected: {"color": "#39f", "weight": 10, "opacity": 1.0 },
                    popup   : {"color": "#33f", "weight": 10, "opacity": 1.0 }
};

let losColor = {'A':'#060', 'B':'#9f0', 'C':'#ff3', 'D':'#f90', 'E':'#f60', 'F':'#c00'};

let styles = (theme==='dark' ? dark_styles : light_styles);

function addSegmentLayer(segments, options={}) {
  // TODO: figure out why PostGIS geojson isn't in exactly the right format.
  for (let segment of segments) {
    segment["type"] = "Feature";
    segment["geometry"] = JSON.parse(segment.geometry);
  }

  segmentLayer = L.geoJSON(segments, {
    style: styleByLosColor,
    onEachFeature: function(feature, layer) {
      layer.on({ mouseover: hoverOnSegment,
                 click : clickedOnSegment,
      });
    },
  });
  segmentLayer.addTo(mymap);
}

function styleByLosColor(segment) {
  let cmp_id = segment.segnum2013;
  let los = segmentLos[cmp_id];
  let color = losColor[los];
  if (!color) color = "#f70";
  return {color: color, weight: 4, opacity: 1.0};
}


let selectedSegment, popupSegment, hoverColor, popupColor;

function hoverOnSegment(e) {
      // don't do anything if we just moused over the already-popped up segment
      if (e.target == popupSegment) return;

      let segment = e.target.feature;
      let cmp_id = segment.segnum2013;

      // return previously-hovered segment to its original color
      if (selectedSegment != popupSegment) {
        if (selectedSegment) {
          let cmp_id = selectedSegment.feature.segnum2013;
          let color = losColor[segmentLos[cmp_id]];
          selectedSegment.setStyle({color:color, weight:4, opacity:1.0});
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


let api_server = 'http://ec2-54-67-72-207.us-west-1.compute.amazonaws.com/api/';

function clickedOnSegment(e) {
      let segment = e.target.feature;
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

function queryServer() {
  const geoserverUrl = api_server + 'json_segments?';

  // convert option list into a url parameter string
  var params = [];
  for (let key in options) params.push(esc(key) + '=' + esc(options[key]));
  let finalUrl = geoserverUrl + params.join('&');

  // Fetch the segments
  fetch(finalUrl)
    .then((resp) => resp.json())
    .then(function(jsonData) {
      personJson = jsonData;
      colorByLOS(2015);
    })
    .catch(function(error) {
      console.log("err: "+error);
    });
}

let segmentLos = {};

function colorByLOS(year) {
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
    segmentLos = {};
    for (let segment in data) {
      let thing = data[segment];
      segmentLos[thing.cmp_id] = thing.los_HCM1985;
    }
    addSegmentLayer(personJson);

  }).catch(function(error) {
    console.log(error);
  });

}

let chosenPeriod = 'AM';

function pickAM(thing) {
  app.isAMactive = true;
  app.isPMactive = false;
  chosenPeriod = 'AM';
  queryServer();
}

function pickPM(thing) {
  app.isAMactive = false;
  app.isPMactive = true;
  chosenPeriod = 'PM';
  queryServer();
}

let app = new Vue({
  el: '#panel',
  data: {
    isAMactive: true,
    isPMactive: false,
  },
  methods: {
    pickAM: pickAM,
    pickPM: pickPM,
  },
  watch: {
  },
});

queryServer();
