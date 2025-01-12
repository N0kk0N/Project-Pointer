<script>
  import { onMount } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  // GeoJSON importeren
  import geojsonData from '../data/bedrijven.json';

  let map;
  let satelliteLayer, grayLayer, labelsLayer;
  let isZoomKeyPressed = false;
  let geoJsonLayer;

  onMount(async () => {
    if (typeof window !== 'undefined') {
      const L = await import('leaflet');

      // Initialiseer de kaart
      map = L.map('map', {
        attributionControl: false, // Verwijder de standaard attributie
      }).setView([52.1326, 5.2913], 7);

      // Voeg lagen toe
      satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
          maxZoom: 18,
        }
      );

      grayLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 18,
        }
      );

      labelsLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
        {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 18,
        }
      );

      // Voeg de aangepaste attributie toe rechtsboven
      L.control
        .attribution({
          position: 'topright',
        })
        .addAttribution(
          'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
        )
        .addTo(map);

      // Voeg de lagen toe
      satelliteLayer.addTo(map);
      labelsLayer.addTo(map); // Voeg de labelsLayer toe

      // Disable scroll zoom by default
      map.scrollWheelZoom.disable();

      // Event Listeners
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      map.on('mouseover', handleMouseOver);
      map.on('mouseout', handleMouseOut);
      map.on('zoomend', handleZoomChange);

      // Voeg de GeoJSON-data toe aan de kaart met aangepaste markers
      geoJsonLayer = L.geoJSON(geojsonData, {
        pointToLayer: function (feature, latlng) {
          let fillColor;
          let fillOpacity;

          // Bepaal de kleur en de opacity op basis van schadekosten
          const schadekosten = feature.properties.schadekosten_2022;

          // Verdeel de schadekosten in vaste categorieën en wijs kleuren en opacity toe
          if (schadekosten > 100000000) {
            fillColor = '#0000FF'; // Felblauw voor de hoogste schadekosten
            fillOpacity = 1; // Maximaal opacity voor blauw
          } else if (schadekosten > 50000000) {
            fillColor = '#FF0000'; // Rood voor middelhoge schadekosten
            fillOpacity = 0.8; // Iets lagere opacity voor rood
          } else if (schadekosten > 10000000) {
            fillColor = '#FFA500'; // Oranje voor lagere schadekosten
            fillOpacity = 0.6; // Nog lagere opacity voor oranje
          } else {
            fillColor = '#FFFF00'; // Geel voor de laagste schadekosten
            fillOpacity = 0.4; // Laagste opacity voor geel
          }

          return L.circleMarker(latlng, {
            radius: 2,  // Begin met een klein formaat
            fillColor: fillColor,
            color: fillColor, // Randkleur instellen op dezelfde kleur als de vulling
            weight: 1, // Dikte van de rand
            opacity: 1,
            fillOpacity: fillOpacity, // Dynamische opacity ingesteld hier
          });
        },
        onEachFeature: function (feature, layer) {
          if (feature.properties && feature.properties.bedrijf) {
            // Formatteer de schadekosten met komma's als duizendtallen scheidingstekens
            const formattedCosts = feature.properties.schadekosten_2022.toLocaleString('nl-NL');
            
            layer.bindPopup(
              `<b>${feature.properties.bedrijf}</b><br>Schadekosten 2022: €${formattedCosts}`
            );
          }
        },
      }).addTo(map);
    }
  });

  // Functies voor zoom-controle
  function handleKeyDown(event) {
    if (event.key === 'Control' || event.key === 'Meta') {
      isZoomKeyPressed = true;
      map.scrollWheelZoom.enable();
    }
  }

  function handleKeyUp(event) {
    if (event.key === 'Control' || event.key === 'Meta') {
      isZoomKeyPressed = false;
      map.scrollWheelZoom.disable();
    }
  }

  function handleMouseOver() {
    if (isZoomKeyPressed) {
      map.scrollWheelZoom.enable();
    }
  }

  function handleMouseOut() {
    map.scrollWheelZoom.disable();
  }

  // Wissel lagen afhankelijk van zoomniveau
  function handleZoomChange() {
    const zoom = map.getZoom();
    geoJsonLayer.eachLayer(function(layer) {
      let radius = 2; // Begin met een radius van 2

      // Pas de radius aan afhankelijk van het zoomniveau
      if (zoom < 10) {
        radius = 2;  // Grotere stippen bij ver weg
      } else if (zoom < 12) {
        radius = 6;  // Grotere stippen bij iets dichterbij
      } else if (zoom < 14) {
        radius = 8;  // Nog grotere stippen bij verder inzoomen
      } else {
        radius = 12;  // Het grootste formaat bij hoog inzoomen
      }

      // Pas de radius dynamisch aan voor alle bestaande markers
      layer.setRadius(radius);
    });
  }
</script>

<style>
  #map {
    height: 600px; /* Pas de hoogte van de kaart aan */
    width: 100%; /* Zorg ervoor dat de kaart de volledige breedte inneemt */
  }

  .button-container {
    position: absolute;
    bottom: -25px; /* Pas deze waarde aan om de knop te verschuiven */
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000; /* Zorg ervoor dat de knop boven de kaart staat */
  }
</style>

<div class="relative w-full h-full">
  <!-- Map -->
  <div id="map" class="w-full h-full"></div>

  <!-- Button Container -->
  <div class="button-container">
    <button
      class="inline-flex gap-2 items-center rounded-full text-xl bg-[#DEFF9C] px-6 py-4"
    >
      Start interactive
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
      >
        <path stroke="none" d="M0 0h24V24H0z" fill="none" />
        <path d="M5 12l14 0" />
        <path d="M13 18l6 -6" />
        <path d="M13 6l6 6" />
      </svg>
    </button>
  </div>
</div>
