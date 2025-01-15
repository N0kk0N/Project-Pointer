<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";

  import geojsonData from "../data/bedrijven.json";

  let map;
  let colorLayer, labelsLayer;
  let isZoomKeyPressed = false;
  let imageOverlay;
  let postcode = ""; // Postcode die de gebruiker invoert
  let overlayBounds = [
    [53.555, 3.35],
    [50.71, 7.15],
  ];
  let buurtMarkersLayer; // Laag voor de markers in de buurt
  let currentLat = 52.1326;  // Huidige locatie breedtegraad (voorbeeld)
  let currentLon = 5.2913;   // Huidige locatie lengtegraad (voorbeeld)

  onMount(async () => {
    if (typeof window !== "undefined") {
      const L = await import("leaflet");

      map = L.map("map", {
        attributionControl: false,
        minZoom: 2,
        maxBounds: [
          [-90, -180],
          [90, 180],
        ],
      }).setView([currentLat, currentLon], 7);

      imageOverlay = L.imageOverlay("/data/QGisTest2.png", overlayBounds, {
        opacity: 0.5,
      }).addTo(map);

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

      L.control
        .attribution({ position: "topright" })
        .addAttribution("Tiles © OpenStreetMap contributors © CARTO")
        .addTo(map);

      colorLayer.addTo(map);
      labelsLayer.addTo(map);

      map.scrollWheelZoom.disable();

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      map.on("mouseover", handleMouseOver);
      map.on("mouseout", handleMouseOut);
    }
  });

  // Functie om locaties in de buurt van de opgezochte postcode te tonen
  function toonMarkersInDeBuurt() {
    const L = window.L;

    // Verwijder bestaande buurtmarkers (indien eerder toegevoegd)
    if (buurtMarkersLayer) {
      map.removeLayer(buurtMarkersLayer);
    }

    // Definieer een straal in meters voor de zoekfunctie
    const buurtStraal = 25000; // 25 km, pas aan naar wens
    buurtMarkersLayer = L.layerGroup();

    // Bepaal de max schadekosten voor schaal
    const maxSchadekosten = Math.max(
      ...geojsonData.features.map((feature) => feature.properties.schadekosten_2022)
    );

    // Om de grenzen van de markers te berekenen
    const boundsArray = [];

    geojsonData.features.forEach(feature => {
      const lat = feature.geometry.coordinates[1];
      const lon = feature.geometry.coordinates[0];

      // Bereken de afstand tussen de huidige locatie en de locatie van de marker
      const afstand = L.latLng(currentLat, currentLon).distanceTo([lat, lon]);

      // Voeg markers toe als ze binnen de straal vallen
      if (afstand <= buurtStraal) {
        const schadekosten = feature.properties.schadekosten_2022;
        const minRadius = 5;
        const maxRadius = 20;
        const radius = (schadekosten / maxSchadekosten) * (maxRadius - minRadius) + minRadius;

        const marker = L.circleMarker([lat, lon], {
          radius: radius, // Dynamisch bepalen van de grootte op basis van schadekosten
          fillColor: "red", // Maak de marker rood
          color: "red", // Kleur van de rand ook rood
          weight: 0,
          opacity: 1,
          fillOpacity: 0.7,
        }).bindPopup(`
          <b>${feature.properties.bedrijf}</b><br>
          Sector: ${feature.properties.aangepaste_sector}<br>
          Schadekosten 2022: €${feature.properties.schadekosten_2022.toLocaleString()}
        `);

        buurtMarkersLayer.addLayer(marker);

        // Voeg de marker toe aan de array voor het berekenen van de bounds
        boundsArray.push(marker.getLatLng());
      }
    });

    // Voeg de buurtmarkers toe aan de kaart
    buurtMarkersLayer.addTo(map);

    // Zoom niet in op de markers, laat ze gewoon zien in de buurt
    if (boundsArray.length > 0) {
      // We willen niet opnieuw inzoomen, dus we slaan deze stap over.
    }
  }

  async function zoekPostcode() {
    const apiUrl = `https://nominatim.openstreetmap.org/search?postalcode=${postcode}&country=Netherlands&format=json`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.length > 0) {
        const { lat, lon } = data[0];

        // Verwijder oude marker (als die bestaat)
        if (map._purpleMarker) {
          map.removeLayer(map._purpleMarker);
        }

        // Voeg een nieuwe paarse stip toe
        map._purpleMarker = L.circleMarker([lat, lon], {
          radius: 10, // Pas de grootte van de stip aan
          fillColor: "purple",
          color: "purple",
          weight: 1,
          opacity: 1, // Volledige opacity
          fillOpacity: 1, // Volledige opacity voor de vulling
          zIndexOffset: 1000, // Zorg ervoor dat de stip boven alles komt
        }).addTo(map);

        // Zoom direct in op de locatie van de gebruiker zonder markers
        map.setView([lat, lon], 18); // Verhoog de zoomfactor naar 13 voor meer inzoomen
        
        // Update de huidige locatie voor de buurtmarkers
        currentLat = lat;
        currentLon = lon;

        // Toon de markers in de buurt van de nieuwe locatie
        toonMarkersInDeBuurt();
      } else {
        alert("Geen locatie gevonden voor de ingevoerde postcode.");
      }
    } catch (error) {
      console.error("Fout bij ophalen van gegevens:", error);
      alert("Er ging iets mis bij het zoeken naar de locatie.");
    }
  }

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
  <!-- Postcode Input -->
  <div class="postcode-container">
    <input
      type="text"
      placeholder="Voer postcode in (bv. 1234AB)"
      bind:value={postcode}
    />
    <button on:click={zoekPostcode}>Zoek</button>
  </div>

  <!-- Map -->
  <div id="map" class="w-full h-full"></div>
</div>

<style>
  #map {
    height: 600px;
    width: 100%;
  }

  .postcode-container {
    position: absolute;
    top: 20px;
    left: 50px; /* Verplaatst het inputveld iets naar rechts */
    z-index: 1000;
    background: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  .postcode-container input {
    margin-right: 10px;
    padding: 5px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .postcode-container button {
    padding: 6px 12px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .postcode-container button:hover {
    background-color: #0056b3;
  }
</style>
