
function find_limits(data) {
  var min = Infinity;
  var max = -Infinity;
  var first_sample = data[0];
  var last_sample = data[data.length - 1];
  for (var feature in data) {
    var properties = data[feature].properties;
    if (properties.p25 < min) {
      min = properties.p25;
    }
    else if (properties.p25 > max) {
      max = properties.p25;
    }
  }

  return {
    min: min,
    max: max,
    first: first_sample,
    last: last_sample
  };
}

function linear_interpolation(ar, ag, ab, br, bg, bb, t) {
  return 'rgb(' +
    Math.round(ar + (br - ar) * t) + ',' +
    Math.round(ag + (bg - ag) * t) + ',' +
    Math.round(ab + (bb - ab) * t) + ')';
}

function pick_color(value) {
  if (value <= 12) {
    return linear_interpolation(5, 141, 5, 30, 161, 15, value / 12);
  }
  else if (value <= 35.4) {
    return linear_interpolation(250, 250, 1, 247, 240, 16, value / 35.4);
  }
  else if (value <= 55.4) {
    return linear_interpolation(250, 150, 0, 255, 69, 0, value / 55);
  }
  else if (value <= 150.4) {
    return linear_interpolation(255, 51, 51, 204, 0, 0, value / 150);
  }
  else if (value <= 250) {
    return linear_interpolation(153, 76, 0, 56, 44, 30, value / 250);
  }
  return linear_interpolation(56, 44, 30, 0, 0, 0, Math.min(1, value / 500));
}

function track_duration(original_duration) {
  var duration = original_duration

  var result = '';
  if (duration > 3600) {
    duration = Math.round(duration / 3600);
    result = duration + ' hora' + (duration === 1 ? '' : 's');
  }
  else if (duration > 60) {
    duration = Math.round(duration / 60);
    result = duration + ' minuto' + (duration === 1 ? '' : 's');
  }
  else {
    result = duration + ' segundo' + (duration === 1 ? '' : 's');
  }
  return result
}

function date_text(initial, end) {
  the_date = new Date(initial * 1000);
  duration = Math.abs(initial - end);
  return the_date + ' ' + ' con ' + track_duration(duration) + ' de recorrido';
}

function name_day(the_date) {
  var day_names = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
  ];
  return day_names[the_date.getDay()];
}

function show_info(prop) {
  return prop.p25 + ' ' + new Date(prop.timestamp * 1000).toLocaleTimeString()
}

function configure_map(mapsample, layerGroup, travelGroup, data) {

  info = find_limits(data);
  $('#interval').text('Entre ' + info.min + ' y ' + info.max);
  $('#date').text(date_text(info.first.properties.timestamp, info.last.properties.timestamp));
  colors = []
  geojsonLayer = L.geoJSON(data,
    {
      pointToLayer: function (feature, latlng) {
        var color = pick_color(feature.properties.p25);
        colors.push(color);
        return L.circleMarker(latlng, {
          fillColor: color,
          color: color,
          weight: 1,
          fillOpacity: 0.6,
          radius: 3 + Math.min(20, 20 * feature.properties.p25 / (info.max - info.min))
        }).on({
          mouseover: function (e) {
            $('#pm25_holder').text(show_info(feature.properties));
            $(".sample").css('background', color);
          },
          mouseout: function (e) {
            $('#pm25_holder').text('Pasa sobre el recorrido');
          }
        });
      }
    }
  );
  routeLine = L.polyline(data.map(function(val) { return val.geometry.coordinates.slice().reverse(); }));
  var bikeIcon = L.icon({
    iconUrl: '../images/marker-bike-green-shadowed.png',
    iconSize: [25, 39],
    iconAnchor: [12, 39],
    shadowUrl: null
  });
  var marker = L.animatedMarker(routeLine.getLatLngs(), {
    icon: bikeIcon,
    autoStart: true,
    onEnd: function() {
      $(this._shadow).fadeOut();
      $(this._icon).fadeOut(3000, function(){
        map.removeLayer(this);
        $(".sample").css('background', 'white');
      });
    },
    onTick: function(index) {
      $('#pm25_holder').text(show_info(data[this._i].properties));
      $(".sample").css('background', colors[this._i]);
    },
  });
  color = pick_color(info.first.properties.p25);

  marker.addTo(travelGroup);
  geojsonLayer.addTo(layerGroup);
  return geojsonLayer;
}

function load_canairio_layer(mapsample, layerGroup, travelGroup, filename) {
  $('.loader').show();
  var reference = 'data/' + filename + '.json';
  layerGroup.clearLayers();
  travelGroup.clearLayers();
  $('#filename').attr('href', reference);
  $.getJSON(reference)
    .done(function (data) {
      layer = configure_map(mapsample, layerGroup, travelGroup, data);
      mapsample.fitBounds(layer.getBounds());
      $('.loader').hide();
      mapsample.data = data;
    })
    .fail(function () { alert('No pudimos obtener los puntos, déjanos saber info@canair.io') });
}

function conventions_map(map) {
  var legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend'),
      grades = [0, 12, 35.4, 55.4, 150.4, 250.4],
      labels = [],
      from, to;
    for (var i = 0; i < grades.length; i++) {
      from = grades[i];
      to = grades[i + 1];

      labels.push(
        '<i style="background:' + pick_color(from + 1) + '"></i> ' +
        from + (to ? '&ndash;' + to : '+'));
    }
    labels.push('<i><a href="https://blissair.com/what-is-pm-2-5.htm">Meaning</a></i>');
    div.innerHTML = labels.join('<br>');
    return div;
  };
  legend.addTo(map);

  var info = L.control();

	info.onAdd = function (map) {
		this._div = L.DomUtil.create('div', 'info data');
		this._div.innerHTML = '<h4>Particulado</h4><i class="sample"></i><span id="pm25_holder">Pasa sobre el recorrido</span>';
		return this._div;
	};

  info.addTo(map);
  return info;
}

function getUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

  for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');

      if (sParameterName[0] === sParam) {
          return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
      }
  }
};

function init_controls() {
  var data_references = [
    '20190502185441',
    '20190407191913',
    '20190403124450',
    '20190402112323',
    '20190327153956',
    '20190327141715',
    '20190323085459',
    '20190308180811',
    '20190227192004',
    '20190211183737',
  ];
  $('#select_map').html(function () {
    inner_data = '';
    data_references.forEach(element => {
      inner_data += '<option value="' + element + '">' + element.substr(0, 8) + '</option>'
    });
    return inner_data
  });

  var measurements = L.layerGroup();
  var travel = L.layerGroup();

  var base_layer = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiY2FuYWlyaW8iLCJhIjoiY2p2OXo3Y3VxMHlndjQ0bjMwajE4b2w2ZiJ9.ZfwXi-3Ald0O0AfpVvvm1g', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
  });
  var mapsample = L.map('mapid', {
    center: [4.60, -74.13],
    zoom: 14,
    layers: [base_layer, measurements, travel],
  });

  var info = conventions_map(mapsample);
  $('#select_map').change(function () {
    load_canairio_layer(mapsample, measurements, travel, $(this).val());
  });

  track_name = getUrlParameter('track_name') || data_references[0]
  load_canairio_layer(mapsample, measurements, travel, track_name);
  L.control.layers(null, {"Recorrido": measurements, "Animación": travel}).addTo(mapsample);

}