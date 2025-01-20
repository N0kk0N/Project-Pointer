<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";
  import { Chart, registerables } from "chart.js";
  Chart.register(...registerables);

  import geojsonData from "../data/bedrijven.json";
  import stoffenData from "../data/stoffen.json"; // NIEUW JSON-BESTAND IMPORTEREN

  let map;
  let colorLayer, labelsLayer;
  let isZoomKeyPressed = false;
  let imageOverlay;
  let postcode = ""; // POSTCODE DIE DE GEBRUIKER INVOERT
  let overlayBounds = [
    [53.555, 3.35],
    [50.71, 7.15],
  ];
  let buurtMarkersLayer; // LAAG VOOR DE MARKERS IN DE BUURT
  let currentLat = 52.1326;  // HUIDIGE LOCATIE BREEDTEGRAAD (VOORBEELD)
  let currentLon = 5.2913;   // HUIDIGE LOCATIE LENGTEGRAAD (VOORBEELD)

  // Array van sectoren
  const categoryArray = [
    "Alle sectoren",
    "Industrie, Energie en Raffinaderijen",
    "Verkeer en vervoer",
    "Afval, riolering, waterzuivering",
    "Handel/Diensten/Overheid en Bouw",
    "Landbouw"
  ];
  let selectedCategory = categoryArray[0]; // Standaard geselecteerde sector

  // Kleuren toewijzen aan sectoren
  const sectorKleuren = {
    "Industrie, Energie en Raffinaderijen": "#1E90FF",
    "Verkeer en vervoer": "#4D00FF",
    "Afval, riolering, waterzuivering": "#00D9AD",
    "Handel/Diensten/Overheid en Bouw": "#DEFF9C",
    "Landbouw": "#FF8800", // Zelfgekozen kleur voor Landbouw
    "Overig": "#8A2BE2" // Zelfgekozen kleur voor overige sectoren
  };

  // INITIEERT DE KAART NA HET MONTEREN VAN DE COMPONENT
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
        opacity: 0.7,
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

  // FUNCTIE OM TE CONTROLEREN OF DE INGEVOERDE POSTCODE GELDIG IS (NEDERLANDSE POSTCODE)
  function isValidPostcode(postcode) {
    const postcodeRegEx = /^[1-9][0-9]{3}[A-Za-z]{2}$/;
    return postcodeRegEx.test(postcode);
  }

  // FUNCTIE OM UITSTOOTGEGEVENS PER BEDRIJF TE COMBINEREN
  function getTop3UitstootPerBedrijf(bedrijf) {
    const uitstootPerBedrijf = stoffenData.filter(stof => stof.Bedrijf === bedrijf);
    
    if (uitstootPerBedrijf.length === 0) {
      return [];
    }

    const preferredUitstoot = {};

    uitstootPerBedrijf.forEach(stof => {
      if (preferredUitstoot[stof.Stof] && stof.Eenheid === "kg CO₂-eq") {
        preferredUitstoot[stof.Stof] = stof; // VOORKEUR VOOR "KG CO₂-EQ"
      } else if (!preferredUitstoot[stof.Stof]) {
        preferredUitstoot[stof.Stof] = stof;
      }
    });

    return Object.values(preferredUitstoot)
      .sort((a, b) => b.Hoeveelheid - a.Hoeveelheid)
      .slice(0, 3);
  }

  // FUNCTIE OM ALLE LOCATIES TE TONEN
  function toonAlleMarkers() {
    const L = window.L;

    if (buurtMarkersLayer) {
      map.removeLayer(buurtMarkersLayer); // Verwijder bestaande markers
    }

    buurtMarkersLayer = L.layerGroup();

    const maxSchadekosten = Math.max(
      ...geojsonData.features.map((feature) => feature.properties.schadekosten_2022)
    );

    geojsonData.features.forEach(feature => {
      const lat = feature.geometry.coordinates[1];
      const lon = feature.geometry.coordinates[0];
      const sector = feature.properties.aangepaste_sector;

      // Filter op de geselecteerde sector
      if (selectedCategory !== "Alle sectoren" && sector !== selectedCategory) {
        return;
      }

      const schadekosten = feature.properties.schadekosten_2022;
      const minRadius = 5;
      const maxRadius = 20;
      const radius = (schadekosten / maxSchadekosten) * (maxRadius - minRadius) + minRadius;

      const top3Uitstoot = getTop3UitstootPerBedrijf(feature.properties.bedrijf);

      const popupContent = `
        <div class="popup-content">
          <h3>${feature.properties.bedrijf}</h3>
          <p><strong>Sector:</strong> ${sector}</p>
          <p><strong>Schadekosten 2022:</strong> €${feature.properties.schadekosten_2022.toLocaleString('nl-NL')}</p>
          <p><strong>Uitstoot (Top 3):</strong></p>
          ${top3Uitstoot.length > 0 ? `<canvas id="chart-${feature.properties.bedrijf.replace(/\s+/g, '-')}" width="200" height="200"></canvas>` : '<p>Geen gegevens gevonden</p>'}
        </div>
      `;

      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        fillColor: sectorKleuren[sector] || "#8A2BE2", // Gebruik de sector kleur of standaard kleur
        color: sectorKleuren[sector] || "#8A2BE2", // Gebruik de sector kleur of standaard kleur
        weight: 0,
        opacity: 1,
        fillOpacity: 0.7,
      }).bindPopup(popupContent, { maxWidth: 'auto', maxHeight: 'auto' });

      buurtMarkersLayer.addLayer(marker);

      // Create the chart after the popup has been opened, if there is data
      if (top3Uitstoot.length > 0) {
        marker.on('popupopen', () => {
          createChart(`chart-${feature.properties.bedrijf.replace(/\s+/g, '-')}`, top3Uitstoot);
        });
      }
    });

    buurtMarkersLayer.addTo(map);
  }

  // FUNCTIE OM EEN TAARTGRAFIEK TE MAKEN VAN DE TOP 3 UITSTOOT
  function createChart(chartId, data) {
    const ctx = document.getElementById(chartId).getContext('2d');
    const labels = data.map(item => item.Stof);
    const values = data.map(item => item.Hoeveelheid);
    const eenheden = data.map(item => item.Eenheid);

    // Definieer een reeks kleuren om te gebruiken in de pie chart
    const backgroundColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
    ];

    // Minimum waardepercentage om weer te geven
    const minPercentage = 2;

    // Bereken totale hoeveelheid
    const total = values.reduce((a, b) => a + b, 0);

    // Bereken percentage voor elke waarde en zorg ervoor dat elke waarde ten minste het minimum percentage heeft
    const adjustedValues = values.map(value => {
      const percentage = (value / total) * 100;
      return percentage < minPercentage ? (minPercentage / 100) * total : value;
    });

    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Uitstoot',
          data: adjustedValues,
          backgroundColor: backgroundColors.slice(0, labels.length), // Gebruik alleen zoveel kleuren als nodig
          hoverBackgroundColor: backgroundColors.slice(0, labels.length), // Gebruik alleen zoveel kleuren als nodig
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(tooltipItem) {
                const percentage = ((values[tooltipItem.dataIndex] / total) * 100).toFixed(2);
                return `${values[tooltipItem.dataIndex].toLocaleString('nl-NL')} ${eenheden[tooltipItem.dataIndex]} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ASYNCHRONISCHE FUNCTIE OM LOCATIE VAN POSTCODE OP TE HOGEN EN MARKERS TE TONEN
  async function zoekPostcode() {
    if (!isValidPostcode(postcode)) {
      alert("Voer een geldige Nederlandse postcode in.");
      return;
    }

    const apiUrl = `https://nominatim.openstreetmap.org/search?postalcode=${postcode}&country=Netherlands&format=json`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.length > 0) {
        const { lat, lon } = data[0];

        if (map._purpleMarker) {
          map.removeLayer(map._purpleMarker); // Verwijder oudere marker
        }

        map._purpleMarker = L.circleMarker([lat, lon], {
          radius: 10,
          fillColor: "#4D00FF",
          color: "#4D00FF",
          weight: 1,
          opacity: 1,
          fillOpacity: 1,
          zIndexOffset: 1000,
        }).addTo(map);

        map.setView([lat, lon], 18);

        currentLat = lat;
        currentLon = lon;

        toonAlleMarkers();
      } else {
        alert("Geen locatie gevonden voor de ingevoerde postcode.");
      }
    } catch (error) {
      console.error("Fout bij ophalen van gegevens:", error);
      alert("Er ging iets mis bij het zoeken naar de locatie.");
    }
  }

  // HANDLES KEYDOWN EVENT VOOR INZOOMEN MET CONTROL/META TOETS
  function handleKeyDown(event) {
    if (event.key === "Control" || event.key === "Meta") {
      isZoomKeyPressed = true;
      map.scrollWheelZoom.enable();
    }
  }

  // HANDLES KEYUP EVENT VOOR ZORGEN DAT INZOOMEN AAN/UIT STAAT
  function handleKeyUp(event) {
    if (event.key === "Control" || event.key === "Meta") {
      isZoomKeyPressed = false;
      map.scrollWheelZoom.disable();
    }
  }

  // HANDLES MOUSEOVER EVENEMENT VOOR ZOEKEN INZOOMEN MET WIEL
  function handleMouseOver() {
    if (isZoomKeyPressed) {
      map.scrollWheelZoom.enable();
    }
  }

  // HANDLES MOUSEOUT EVENEMENT VOOR ZOEKEN INZOOMEN UIT
  function handleMouseOut() {
    map.scrollWheelZoom.disable();
  }

  // FUNCTIE VOOR ENTER-TOETS ZONDER ZOEKKNOP
  function handleKeyPress(event) {
    if (event.key === "Enter" && postcode && isValidPostcode(postcode)) {
      zoekPostcode();
    }
  }
</script>

<!-- HTML STRUCTUUR -->
<div class="relative w-full h-full">
  <!-- POSTCODE INPUT EN ZOEKKNOP -->
  <div class="postcode-container">
    <input
      type="text"
      placeholder="1234AB"
      bind:value={postcode}
      on:keydown={handleKeyPress}
    />
    <button on:click={zoekPostcode} class="zoek-button">Zoek</button>
    <select bind:value={selectedCategory} on:change={toonAlleMarkers}>
      {#each categoryArray as category}
        <option value={category}>{category}</option>
      {/each}
    </select>
  </div>

  <!-- KAART WEERGAVE -->
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
    left: 50px;
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

  .zoek-button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 5px 15px;
    font-size: 14px;
    cursor: pointer;
    border-radius: 4px;
  }

  .zoek-button:hover {
    background-color: #0056b3;
  }

  .popup-content {
    font-family: Arial, sans-serif;
    text-align: left;
    max-width: 300px; /* Maximale breedte van de popup */
    max-height: 300px; /* Maximale hoogte van de popup */
    overflow-y: auto; /* Scrollbare inhoud als deze groter is dan de popup */
  }

  .popup-content h3 {
    margin: 0;
    font-size: 16px;
    color: #333;
  }

  .popup-content p {
    margin: 5px 0;
    font-size: 14px;
    color: #555;
  }

  .popup-content ul {
    list-style-type: disc;
    padding-left: 20px;
    margin: 5px 0;
  }

  .popup-content li {
    font-size: 14px;
    color: #555;
  }
</style>