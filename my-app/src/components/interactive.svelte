<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";

  // GeoJSON importeren
  import geojsonData from "../data/bedrijven.json";

  let map;
  let colorLayer, labelsLayer;
  let isZoomKeyPressed = false;
  let geoJsonLayer;
  let imageOverlay;

  // Definieer de bounds voor de afbeeldingoverlay
  const overlayBounds = [
    [53.555, 3.35], // [North-West corner latitude, longitude]
    [50.71, 7.15]  // [South-East corner latitude, longitude]
  ];

  onMount(async () => {
    if (typeof window !== "undefined") {
      const L = await import("leaflet");

      // Initialiseer de kaart
      map = L.map("map", {
        attributionControl: false, // Verwijder de standaard attributie
        minZoom: 2, // Stel het minimale zoomniveau in zodat de hele wereld zichtbaar blijft
        maxBounds: [
          [-90, -180], // Zuidwest grens (breedtegraad, lengtegraad)
          [90, 180], // Noordoost grens (breedtegraad, lengtegraad)
        ], // Beperk de kaart tot de hele wereld
      }).setView([52.1326, 5.2913], 7);

      // Voeg de afbeeldingoverlay toe aan de kaart
      imageOverlay = L.imageOverlay(
        '/data/QGisTest2.png', // Pad naar de PNG-afbeelding
        overlayBounds,          // De bounds waarin de afbeelding wordt geplaatst
        { opacity: 0.5 }        // Optionele instellingen zoals de opacity
      ).addTo(map);

      // Voeg lagen toe
      colorLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 18,
        },
      );

      labelsLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 18,
        },
      );

      // Voeg de aangepaste attributie toe rechtsboven
      L.control
        .attribution({
          position: "topright",
        })
        .addAttribution(
          "Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012",
        )
        .addTo(map);

      // Voeg de lagen toe
      colorLayer.addTo(map);
      labelsLayer.addTo(map); // Voeg de labelsLayer toe

      // Disable scroll zoom by default
      map.scrollWheelZoom.disable();

      // Event Listeners
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      map.on("mouseover", handleMouseOver);
      map.on("mouseout", handleMouseOut);

      // Bereken de maximale schadekosten om te gebruiken voor schaalverdeling
      const maxSchadekosten = Math.max(
        ...geojsonData.features.map(
          (feature) => feature.properties.schadekosten_2022,
        ),
      );

      // Voeg de GeoJSON-data toe aan de kaart met aangepaste markers
      geoJsonLayer = L.geoJSON(geojsonData, {
        pointToLayer: function (feature, latlng) {
          const schadekosten = feature.properties.schadekosten_2022;
          // Schaal de radius op basis van de schadekosten met een minimum en maximum grootte
          const minRadius = 5;
          const maxRadius = 20;
          const radius =
            (schadekosten / maxSchadekosten) * (maxRadius - minRadius) +
            minRadius;

          return L.circleMarker(latlng, {
            radius: radius, // Dynamische grootte voor alle markers
            fillColor: "#FF0000", // Rood voor alle markers
            color: "#FF0000", // Randkleur instellen op dezelfde kleur als de vulling
            weight: 0, // Dikte van de rand
            opacity: 1,
            fillOpacity: 0.6, // Statische opacity
          });
        },
        onEachFeature: function (feature, layer) {
          if (feature.properties && feature.properties.bedrijf) {
            // Formatteer de schadekosten met komma's als duizendtallen scheidingstekens
            const formattedCosts =
              feature.properties.schadekosten_2022.toLocaleString("nl-NL");

            layer.bindPopup(
              `<b>${feature.properties.bedrijf}</b><br>Schadekosten 2022: €${formattedCosts}`,
            );
          }
        },
      }).addTo(map);
    }
  });

  // Functies voor zoom-controle
  function handleKeyDown(event) {
    if (event.key === "Control" || event.key === "Meta") {
      isZoomKeyPressed = true;
      map.scrollWheelZoom.enable();
    }
  }

  function handleKeyUp(event) {
    if (event.key === "Control" || event.key === "Meta") {
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
</script>

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