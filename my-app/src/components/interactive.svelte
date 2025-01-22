<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";
  import { Chart, registerables } from "chart.js";
  Chart.register(...registerables);

  import geojsonData from "../data/bedrijven.json";
  import stoffenData from "../data/stoffen.json"; // NIEUW JSON-BESTAND IMPORTEREN

  let zoomEnd = true;

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
  let currentLat = 52.1326; // HUIDIGE LOCATIE BREEDTEGRAAD (VOORBEELD)
  let currentLon = 5.2913; // HUIDIGE LOCATIE LENGTEGRAAD (VOORBEELD)

  const defaultLat = 52.0; // Voorbeeld coördinaten voor uitzoomen
  const defaultLon = 5.0;
  const defaultZoomLevel = 7; // Stel het gewenste uitzoomniveau in

  const ijmuidenLat = 52.4607;
  const ijmuidenLon = 4.6117;
  const zoomLevel = 12; // Stel het gewenste zoomniveau in

  const rotterdamLat = 51.9225;
  const rotterdamLon = 4.47917;
  const rotterdamZoomLevel = 10; // Stel het gewenste zoomniveau in voor Rotterdam

  const schipholLat = 52.3105;
  const schipholLon = 4.7683;
  const schipholZoomLevel = 12; // Stel het gewenste zoomniveau in

  const deKooyLat = 52.9234;
  const deKooyLon = 4.7806;
  const deKooyZoomLevel = 12; // Stel het gewenste zoomniveau in

  const amsterdamLat = 52.37; // Iets verhoogd
  const amsterdamLon = 4.89; // Iets verlaagd
  const amsterdamZoomLevel = 12; // Stel het gewenste zoomniveau in

  const berkenwoudeLat = 51.9375;
  const berkenwoudeLon = 4.7355;
  const berkenwoudeZoomLevel = 12; // Stel het gewenste zoomniveau in

  const veendamLat = 53.1061;
  const veendamLon = 6.8797;
  const veendamZoomLevel = 12; // Stel het gewenste zoomniveau in

  const rotterdamHavenLat = 51.9526; // Aangepast naar het uiterste puntje van de haven
  const rotterdamHavenLon = 4.0559; // Aangepast naar het uiterste puntje van de haven
  const rotterdamHavenZoomLevel = 12; // Stel het gewenste zoomniveau in

  const kapelleLat = 51.4867;
  const kapelleLon = 3.9622;
  const kapelleZoomLevel = 12; // Stel het gewenste zoomniveau in

  const luttelgeestLat = 52.7425;
  const luttelgeestLon = 5.8322;
  const luttelgeestZoomLevel = 12; // Stel het gewenste zoomniveau in

  // Array van sectoren
  const categoryArray = [
    "Alle sectoren",
    "Industrie, Energie en Raffinaderijen",
    "Verkeer en vervoer",
    "Afval, riolering, waterzuivering",
    "Handel/Diensten/Overheid en Bouw",
    "Landbouw",
  ];
  let selectedCategory = categoryArray[0]; // Standaard geselecteerde sector

  // Kleuren toewijzen aan sectoren
  const sectorKleuren = {
    "Industrie, Energie en Raffinaderijen": "#1E90FF",
    "Verkeer en vervoer": "#4D00FF",
    "Afval, riolering, waterzuivering": "#00D9AD",
    "Handel/Diensten/Overheid en Bouw": "#DEFF9C",
    Landbouw: "#FF8800", // Zelfgekozen kleur voor Landbouw
    Overig: "#8A2BE2", // Zelfgekozen kleur voor overige sectoren
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

      imageOverlay = L.imageOverlay("/data/QGisTest6.png", overlayBounds, {
        opacity: 0.7,
      }).addTo(map);

      colorLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 18,
        }
      );

      labelsLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 18,
        }
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

      // Voeg deze regel toe om de markers te tonen
      toonAlleMarkers();

      map.on("zoomstart", () => {
        if (buurtMarkersLayer) {
          map.removeLayer(buurtMarkersLayer);
        }
      });

      map.on("zoomend", () => {
        console.log(zoomEnd); // Log the value of zoomEnd for debugging
        if (zoomEnd) {
          toonAlleMarkers(selectedCategory);
        } else {
          voegNieuweMarkersToe();
        }
      });
    }
  });

  // FUNCTIE OM TE CONTROLEREN OF DE INGEVOERDE POSTCODE GELDIG IS (NEDERLANDSE POSTCODE)
  function isValidPostcode(postcode) {
    const postcodeRegEx = /^[1-9][0-9]{3}[A-Za-z]{2}$/;
    return postcodeRegEx.test(postcode);
  }

  // FUNCTIE OM UITSTOOTGEGEVENS PER BEDRIJF TE COMBINEREN
  function getTop3UitstootPerBedrijf(bedrijf) {
    const uitstootPerBedrijf = stoffenData.filter(
      (stof) => stof.Bedrijf === bedrijf
    );

    if (uitstootPerBedrijf.length === 0) {
      return [];
    }

    const preferredUitstoot = {};

    uitstootPerBedrijf.forEach((stof) => {
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
  function toonAlleMarkers(selectedCategory = "Alle sectoren") {
    const L = window.L;

    if (buurtMarkersLayer) {
      map.removeLayer(buurtMarkersLayer); // Verwijder bestaande markers
    }

    buurtMarkersLayer = L.layerGroup();

    const maxSchadekosten = Math.max(
      ...geojsonData.features.map(
        (feature) => feature.properties.schadekosten_2022
      )
    );

    geojsonData.features.forEach((feature) => {
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
      const radius =
        (schadekosten / maxSchadekosten) * (maxRadius - minRadius) + minRadius;

      const top3Uitstoot = getTop3UitstootPerBedrijf(
        feature.properties.bedrijf
      );

      const popupContent = `
      <div class="popup-content">
        <h3>${feature.properties.bedrijf}</h3>
        <p><strong>Sector:</strong> ${sector}</p>
        <p><strong>Schadekosten 2022:</strong> €${feature.properties.schadekosten_2022.toLocaleString("nl-NL")}</p>
        <p><strong>Uitstoot (Top 3):</strong></p>
        ${top3Uitstoot.length > 0 ? `<canvas id="chart-${feature.properties.bedrijf.replace(/\s+/g, "-")}" width="200" height="200"></canvas>` : "<p>Geen gegevens gevonden</p>"}
      </div>
    `;

      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        fillColor: sectorKleuren[sector] || "#8A2BE2", // Gebruik de sector kleur of standaard kleur
        color: sectorKleuren[sector] || "#8A2BE2", // Gebruik de sector kleur of standaard kleur
        weight: 0,
        opacity: 1,
        fillOpacity: 0.7,
      }).bindPopup(popupContent, { maxWidth: "auto", maxHeight: "auto" });

      buurtMarkersLayer.addLayer(marker);

      // Maak de grafiek aan nadat de popup geopend is, als er data is
      if (top3Uitstoot.length > 0) {
        marker.on("popupopen", () => {
          createChart(
            `chart-${feature.properties.bedrijf.replace(/\s+/g, "-")}`,
            top3Uitstoot
          );
        });
      }
    });

    buurtMarkersLayer.addTo(map);
  }

  // FUNCTIE OM EEN TAARTGRAFIEK TE MAKEN VAN DE TOP 3 UITSTOOT
  function createChart(chartId, data) {
    const ctx = document.getElementById(chartId).getContext("2d");
    const labels = data.map((item) => item.Stof);
    const values = data.map((item) => item.Hoeveelheid);
    const eenheden = data.map((item) => item.Eenheid);

    // Definieer een reeks kleuren om te gebruiken in de pie chart
    const backgroundColors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
    ];

    // Minimum waardepercentage om weer te geven
    const minPercentage = 2;

    // Bereken totale hoeveelheid
    const total = values.reduce((a, b) => a + b, 0);

    // Bereken percentage voor elke waarde en zorg ervoor dat elke waarde ten minste het minimum percentage heeft
    const adjustedValues = values.map((value) => {
      const percentage = (value / total) * 100;
      return percentage < minPercentage ? (minPercentage / 100) * total : value;
    });

    new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Uitstoot",
            data: adjustedValues,
            backgroundColor: backgroundColors.slice(0, labels.length), // Gebruik alleen zoveel kleuren als nodig
            hoverBackgroundColor: backgroundColors.slice(0, labels.length), // Gebruik alleen zoveel kleuren als nodig
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (tooltipItem) {
                const percentage = (
                  (values[tooltipItem.dataIndex] / total) *
                  100
                ).toFixed(2);
                return `${values[tooltipItem.dataIndex].toLocaleString("nl-NL")} ${eenheden[tooltipItem.dataIndex]} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ASYNCHRONISCHE FUNCTIE OM LOCATIE VAN POSTCODE OP TE HOGEN EN MARKERS TE TONEN
  async function zoekPostcode() {
    if (!isValidPostcode(postcode)) {
      document.getElementById("zipcodeError").classList.remove("hidden");
      document.getElementById("postcode").classList.add("border-red-500");
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

        // Plaats nieuwe marker op de kaart
        map._purpleMarker = L.circleMarker([lat, lon], {
          radius: 10,
          fillColor: "#4D00FF",
          color: "#4D00FF",
          weight: 1,
          opacity: 1,
          fillOpacity: 1,
          zIndexOffset: 1000,
        }).addTo(map);

        currentLat = lat;
        currentLon = lon;

        const cardOverlay = document.getElementById("cardOverlay");
        cardOverlay.classList.replace("block", "hidden");

        // Wijzig de geselecteerde categorie en toon alleen markers van de sector "Industrie, Energie en Raffinaderijen"
        selectedCategory = categoryArray[1]; // Set to "Industrie, Energie en Raffinaderijen"
        toonAlleMarkers(selectedCategory);

        // VIND DE 3 DICHTSTBIJZIJNDE BEDRIJVEN IN DE SECTOR "Industrie, Energie en Raffinaderijen"
        const bedrijvenInSectorIndustrie = geojsonData.features.filter(
          (feature) =>
            feature.properties.aangepaste_sector ===
            "Industrie, Energie en Raffinaderijen"
        );

        // Bereken de afstand tussen de huidige locatie en de bedrijven in de sector
        const bedrijvenMetAfstandIndustrie = bedrijvenInSectorIndustrie.map(
          (bedrijf) => ({
            ...bedrijf,
            afstand: calculateDistance(
              lat,
              lon,
              bedrijf.geometry.coordinates[1],
              bedrijf.geometry.coordinates[0]
            ),
          })
        );

        // Sorteer de bedrijven op afstand
        bedrijvenMetAfstandIndustrie.sort((a, b) => a.afstand - b.afstand);

        // Selecteer de 3 dichtstbijzijnde bedrijven
        const dichtsbijzijndeBedrijvenIndustrie =
          bedrijvenMetAfstandIndustrie.slice(0, 3);

        // Update de HTML met de bedrijfsnamen
        document.querySelector(
          "#card23 .mt-6 .text-xl:nth-of-type(1)"
        ).textContent =
          dichtsbijzijndeBedrijvenIndustrie[0]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card23 .mt-6 .text-xl:nth-of-type(2)"
        ).textContent =
          dichtsbijzijndeBedrijvenIndustrie[1]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card23 .mt-6 .text-xl:nth-of-type(3)"
        ).textContent =
          dichtsbijzijndeBedrijvenIndustrie[2]?.properties.bedrijf ||
          "Geen gegevens";

        // VIND DE 3 DICHTSTBIJZIJNDE BEDRIJVEN IN DE SECTOR "Verkeer en vervoer"
        const bedrijvenInSectorVerkeer = geojsonData.features.filter(
          (feature) =>
            feature.properties.aangepaste_sector === "Verkeer en vervoer"
        );

        // Bereken de afstand tussen de huidige locatie en de bedrijven in de sector
        const bedrijvenMetAfstandVerkeer = bedrijvenInSectorVerkeer.map(
          (bedrijf) => ({
            ...bedrijf,
            afstand: calculateDistance(
              lat,
              lon,
              bedrijf.geometry.coordinates[1],
              bedrijf.geometry.coordinates[0]
            ),
          })
        );

        // Sorteer de bedrijven op afstand
        bedrijvenMetAfstandVerkeer.sort((a, b) => a.afstand - b.afstand);

        // Selecteer de 3 dichtstbijzijnde bedrijven
        const dichtsbijzijndeBedrijvenVerkeer =
          bedrijvenMetAfstandVerkeer.slice(0, 3);

        // Update de HTML met de bedrijfsnamen
        document.querySelector(
          "#card33 .mt-6 .text-xl:nth-of-type(1)"
        ).textContent =
          dichtsbijzijndeBedrijvenVerkeer[0]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card33 .mt-6 .text-xl:nth-of-type(2)"
        ).textContent =
          dichtsbijzijndeBedrijvenVerkeer[1]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card33 .mt-6 .text-xl:nth-of-type(3)"
        ).textContent =
          dichtsbijzijndeBedrijvenVerkeer[2]?.properties.bedrijf ||
          "Geen gegevens";

        // VIND DE 3 DICHTSTBIJZIJNDE BEDRIJVEN IN DE SECTOR "Afval, riolering, waterzuivering"
        const bedrijvenInSectorAfval = geojsonData.features.filter(
          (feature) =>
            feature.properties.aangepaste_sector ===
            "Afval, riolering, waterzuivering"
        );

        // Bereken de afstand tussen de huidige locatie en de bedrijven in de sector
        const bedrijvenMetAfstandAfval = bedrijvenInSectorAfval.map(
          (bedrijf) => ({
            ...bedrijf,
            afstand: calculateDistance(
              lat,
              lon,
              bedrijf.geometry.coordinates[1],
              bedrijf.geometry.coordinates[0]
            ),
          })
        );

        // Sorteer de bedrijven op afstand
        bedrijvenMetAfstandAfval.sort((a, b) => a.afstand - b.afstand);

        // Selecteer de 3 dichtstbijzijnde bedrijven
        const dichtsbijzijndeBedrijvenAfval = bedrijvenMetAfstandAfval.slice(
          0,
          3
        );

        // Update de HTML met de bedrijfsnamen
        document.querySelector(
          "#card43 .mt-6 .text-xl:nth-of-type(1)"
        ).textContent =
          dichtsbijzijndeBedrijvenAfval[0]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card43 .mt-6 .text-xl:nth-of-type(2)"
        ).textContent =
          dichtsbijzijndeBedrijvenAfval[1]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card43 .mt-6 .text-xl:nth-of-type(3)"
        ).textContent =
          dichtsbijzijndeBedrijvenAfval[2]?.properties.bedrijf ||
          "Geen gegevens";

        // VIND DE 3 DICHTSTBIJZIJNDE BEDRIJVEN IN DE SECTOR "Handel/Diensten/Overheid en Bouw"
        const bedrijvenInSectorHandel = geojsonData.features.filter(
          (feature) =>
            feature.properties.aangepaste_sector ===
            "Handel/Diensten/Overheid en Bouw"
        );

        // Bereken de afstand tussen de huidige locatie en de bedrijven in de sector
        const bedrijvenMetAfstandHandel = bedrijvenInSectorHandel.map(
          (bedrijf) => ({
            ...bedrijf,
            afstand: calculateDistance(
              lat,
              lon,
              bedrijf.geometry.coordinates[1],
              bedrijf.geometry.coordinates[0]
            ),
          })
        );

        // Sorteer de bedrijven op afstand
        bedrijvenMetAfstandHandel.sort((a, b) => a.afstand - b.afstand);

        // Selecteer de 3 dichtstbijzijnde bedrijven
        const dichtsbijzijndeBedrijvenHandel = bedrijvenMetAfstandHandel.slice(
          0,
          3
        );

        // Update de HTML met de bedrijfsnamen
        document.querySelector(
          "#card53 .mt-6 .text-xl:nth-of-type(1)"
        ).textContent =
          dichtsbijzijndeBedrijvenHandel[0]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card53 .mt-6 .text-xl:nth-of-type(2)"
        ).textContent =
          dichtsbijzijndeBedrijvenHandel[1]?.properties.bedrijf ||
          "Geen gegevens";
        document.querySelector(
          "#card53 .mt-6 .text-xl:nth-of-type(3)"
        ).textContent =
          dichtsbijzijndeBedrijvenHandel[2]?.properties.bedrijf ||
          "Geen gegevens";

        // VIND DE 3 DICHTSTBIJZIJNDE BEDRIJVEN IN DE SECTOR "Landbouw"
        const bedrijvenInSectorLandbouw = geojsonData.features.filter(
          (feature) => feature.properties.aangepaste_sector === "Landbouw"
        );

        // Bereken de afstand tussen de huidige locatie en de bedrijven in de sector
        const bedrijvenMetAfstandLandbouw = bedrijvenInSectorLandbouw.map(
          (bedrijf) => ({
            ...bedrijf,
            afstand: calculateDistance(
              lat,
              lon,
              bedrijf.geometry.coordinates[1],
              bedrijf.geometry.coordinates[0]
            ),
          })
        );

        // Sorteer de bedrijven op afstand
        bedrijvenMetAfstandLandbouw.sort((a, b) => a.afstand - b.afstand);

        // Selecteer de 3 dichtstbijzijnde bedrijven
        const dichtsbijzijndeBedrijvenLandbouw =
          bedrijvenMetAfstandLandbouw.slice(0, 3);

        // Wijzig de geselecteerde categorie en toon alleen markers van de sector "Industrie, Energie en Raffinaderijen"
        selectedCategory = categoryArray[1]; // Set to "Industrie, Energie en Raffinaderijen"
        toonAlleMarkers(selectedCategory);

        const card2 = document.getElementById("card2");
        const card21 = document.getElementById("card21");
        const card22 = document.getElementById("card22");
        const card23 = document.getElementById("card23");

        const card3 = document.getElementById("card3");
        const card31 = document.getElementById("card31");
        const card32 = document.getElementById("card32");
        const card33 = document.getElementById("card33");

        const card4 = document.getElementById("card4");
        const card41 = document.getElementById("card41");
        const card42 = document.getElementById("card42");
        const card43 = document.getElementById("card43");

        const card5 = document.getElementById("card5");
        const card51 = document.getElementById("card51");
        const card52 = document.getElementById("card52");
        const card53 = document.getElementById("card53");

        const card6 = document.getElementById("card6");
        const card61 = document.getElementById("card61");
        const card62 = document.getElementById("card62");
        const card63 = document.getElementById("card63");

        const card7 = document.getElementById("card7");

        card2.classList.replace("hidden", "flex");

        // card 2 | algemeen
        const card2next = document.getElementById("card2next");
        card2next.addEventListener("click", () => {
          card2.classList.replace("flex", "hidden");
          card21.classList.replace("hidden", "flex");

          // Start de animatie om in te zoomen
          map.flyTo([ijmuidenLat, ijmuidenLon], zoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
            start: () => {
              if (buurtMarkersLayer) {
                map.removeLayer(buurtMarkersLayer);
              }
            },
            end: () => {
              toonAlleMarkers(selectedCategory);

              // Zoek de marker voor IJmuiden en open de popup automatisch
              const ijmuidenMarker = buurtMarkersLayer
                .getLayers()
                .find((marker) => {
                  const [markerLon, markerLat] = marker.getLatLng();
                  return markerLat === ijmuidenLat && markerLon === ijmuidenLon;
                });

              if (ijmuidenMarker) {
                ijmuidenMarker.openPopup();
              }
            },
          });
        });

        // card 2.1 | ergste
        const card21prev = document.getElementById("card21prev");
        card21prev.addEventListener("click", () => {
          card21.classList.replace("flex", "hidden");
          card2.classList.replace("hidden", "flex");

          // Start de animatie om uit te zoomen
          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card21next = document.getElementById("card21next");
        card21next.addEventListener("click", () => {
          card21.classList.replace("flex", "hidden");
          card22.classList.replace("hidden", "flex");

          // Start de animatie om naar de haven van Rotterdam te vliegen
          map.flyTo([rotterdamLat, rotterdamLon], rotterdamZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 2.2 | interssant
        const card22prev = document.getElementById("card22prev");
        card22prev.addEventListener("click", () => {
          card22.classList.replace("flex", "hidden");
          card21.classList.replace("hidden", "flex");

          // Start de animatie om terug te vliegen naar IJmuiden
          map.flyTo([ijmuidenLat, ijmuidenLon], zoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card22next = document.getElementById("card22next");
        card22next.addEventListener("click", () => {
          card22.classList.replace("flex", "hidden");
          card23.classList.replace("hidden", "flex");

          // Start de animatie om naar de eigen locatie te vliegen
          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 2.3 | eigen locatie
        const card23prev = document.getElementById("card23prev");
        card23prev.addEventListener("click", () => {
          card23.classList.replace("flex", "hidden");
          card22.classList.replace("hidden", "flex");

          // Start de animatie om terug te vliegen naar de locatie van kaart 22 (bijv. Rotterdam)
          map.flyTo([rotterdamLat, rotterdamLon], rotterdamZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card23next = document.getElementById("card23next");
        card23next.addEventListener("click", () => {
          card23.classList.replace("flex", "hidden");
          card3.classList.replace("hidden", "flex");

          // Verander de geselecteerde categorie naar "Verkeer en vervoer"
          selectedCategory = categoryArray[2]; // Set to "Verkeer en vervoer"
          toonAlleMarkers(selectedCategory);

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 3 | algemeen
        const card3prev = document.getElementById("card3prev");
        card3prev.addEventListener("click", () => {
          card3.classList.replace("flex", "hidden");
          card23.classList.replace("hidden", "flex");

          // Verander de geselecteerde categorie terug naar de vorige categorie
          selectedCategory = categoryArray[1]; // Terug naar "Industrie, Energie en Raffinaderijen"
          toonAlleMarkers(selectedCategory);

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card3next = document.getElementById("card3next");
        card3next.addEventListener("click", () => {
          card3.classList.replace("flex", "hidden");
          card31.classList.replace("hidden", "flex");

          map.flyTo([schipholLat, schipholLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 3.1 | ergste
        const card31prev = document.getElementById("card31prev");
        card31prev.addEventListener("click", () => {
          card31.classList.replace("flex", "hidden");
          card3.classList.replace("hidden", "flex");

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card31next = document.getElementById("card31next");
        card31next.addEventListener("click", () => {
          card31.classList.replace("flex", "hidden");
          card32.classList.replace("hidden", "flex");
          map.flyTo([deKooyLat, deKooyLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 3.2 | interessant
        const card32prev = document.getElementById("card32prev");
        card32prev.addEventListener("click", () => {
          card32.classList.replace("flex", "hidden");
          card31.classList.replace("hidden", "flex");

          map.flyTo([schipholLat, schipholLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card32next = document.getElementById("card32next");
        card32next.addEventListener("click", () => {
          card32.classList.replace("flex", "hidden");
          card33.classList.replace("hidden", "flex");

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 3.3 | eigen locatie
        const card33prev = document.getElementById("card33prev");
        card33prev.addEventListener("click", () => {
          card33.classList.replace("flex", "hidden");
          card32.classList.replace("hidden", "flex");

          map.flyTo([deKooyLat, deKooyLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card33next = document.getElementById("card33next");
        card33next.addEventListener("click", () => {
          card33.classList.replace("flex", "hidden");
          card4.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[3];
          toonAlleMarkers(selectedCategory);

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 4 | algemeen
        const card4prev = document.getElementById("card4prev");
        card4prev.addEventListener("click", () => {
          card4.classList.replace("flex", "hidden");
          card33.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[2];
          toonAlleMarkers(selectedCategory);

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card4next = document.getElementById("card4next");
        card4next.addEventListener("click", () => {
          card4.classList.replace("flex", "hidden");
          card41.classList.replace("hidden", "flex");

          map.flyTo([amsterdamLat, amsterdamLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 4.1 | ergste
        const card41prev = document.getElementById("card41prev");
        card41prev.addEventListener("click", () => {
          card41.classList.replace("flex", "hidden");
          card4.classList.replace("hidden", "flex");

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card41next = document.getElementById("card41next");
        card41next.addEventListener("click", () => {
          card41.classList.replace("flex", "hidden");
          card42.classList.replace("hidden", "flex");

          map.flyTo([berkenwoudeLat, berkenwoudeLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 4.2 | interessant
        const card42prev = document.getElementById("card42prev");
        card42prev.addEventListener("click", () => {
          card42.classList.replace("flex", "hidden");
          card41.classList.replace("hidden", "flex");

          map.flyTo([amsterdamLat, amsterdamLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card42next = document.getElementById("card42next");
        card42next.addEventListener("click", () => {
          card42.classList.replace("flex", "hidden");
          card43.classList.replace("hidden", "flex");

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 4.3 | eigen locatie
        const card43prev = document.getElementById("card43prev");
        card43prev.addEventListener("click", () => {
          card43.classList.replace("flex", "hidden");
          card42.classList.replace("hidden", "flex");

          map.flyTo([berkenwoudeLat, berkenwoudeLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card43next = document.getElementById("card43next");
        card43next.addEventListener("click", () => {
          card43.classList.replace("flex", "hidden");
          card5.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[4];
          toonAlleMarkers(selectedCategory);

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 5 | algemeen
        const card5prev = document.getElementById("card5prev");
        card5prev.addEventListener("click", () => {
          card5.classList.replace("flex", "hidden");
          card43.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[3];
          toonAlleMarkers(selectedCategory);

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card5next = document.getElementById("card5next");
        card5next.addEventListener("click", () => {
          card5.classList.replace("flex", "hidden");
          card51.classList.replace("hidden", "flex");

          map.flyTo([veendamLat, veendamLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 5.1 | ergste
        const card51prev = document.getElementById("card51prev");
        card51prev.addEventListener("click", () => {
          card51.classList.replace("flex", "hidden");
          card5.classList.replace("hidden", "flex");

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card51next = document.getElementById("card51next");
        card51next.addEventListener("click", () => {
          card51.classList.replace("flex", "hidden");
          card52.classList.replace("hidden", "flex");

          map.flyTo([rotterdamHavenLat, rotterdamHavenLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 5.2 | interessant
        const card52prev = document.getElementById("card52prev");
        card52prev.addEventListener("click", () => {
          card52.classList.replace("flex", "hidden");
          card51.classList.replace("hidden", "flex");

          map.flyTo([veendamLat, veendamLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card52next = document.getElementById("card52next");
        card52next.addEventListener("click", () => {
          card52.classList.replace("flex", "hidden");
          card53.classList.replace("hidden", "flex");

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 5.3 | eigen locatie
        const card53prev = document.getElementById("card53prev");
        card53prev.addEventListener("click", () => {
          card53.classList.replace("flex", "hidden");
          card52.classList.replace("hidden", "flex");

          map.flyTo([rotterdamHavenLat, rotterdamHavenLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card53next = document.getElementById("card53next");
        card53next.addEventListener("click", () => {
          card53.classList.replace("flex", "hidden");
          card6.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[5];
          toonAlleMarkers(selectedCategory);

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 6 | algemeen
        const card6prev = document.getElementById("card6prev");
        card6prev.addEventListener("click", () => {
          card6.classList.replace("flex", "hidden");
          card53.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[4];
          toonAlleMarkers(selectedCategory);

          map.flyTo([currentLat, currentLon], 11, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card6next = document.getElementById("card6next");
        card6next.addEventListener("click", () => {
          card6.classList.replace("flex", "hidden");
          card61.classList.replace("hidden", "flex");

          map.flyTo([kapelleLat, kapelleLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 6.1 | ergste
        const card61prev = document.getElementById("card61prev");
        card61prev.addEventListener("click", () => {
          card61.classList.replace("flex", "hidden");
          card6.classList.replace("hidden", "flex");

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card61next = document.getElementById("card61next");
        card61next.addEventListener("click", () => {
          card61.classList.replace("flex", "hidden");
          card62.classList.replace("hidden", "flex");

          map.flyTo([luttelgeestLat, luttelgeestLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 6.2 | interessant
        const card62prev = document.getElementById("card62prev");
        card62prev.addEventListener("click", () => {
          card62.classList.replace("flex", "hidden");
          card61.classList.replace("hidden", "flex");

          map.flyTo([kapelleLat, kapelleLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card62next = document.getElementById("card62next");
        card62next.addEventListener("click", () => {
          card62.classList.replace("flex", "hidden");
          card63.classList.replace("hidden", "flex");

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        // card 6.3 | eigen locatie
        const card63prev = document.getElementById("card63prev");
        card63prev.addEventListener("click", () => {
          card63.classList.replace("flex", "hidden");
          card62.classList.replace("hidden", "flex");

          map.flyTo([luttelgeestLat, luttelgeestLon], 12, {
            animate: true,
            duration: 1.5, // De duur van de animatie in seconden
          });
        });

        const card63next = document.getElementById("card63next");
        card63next.addEventListener("click", () => {
          card63.classList.replace("flex", "hidden");
          card7.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[0];
          toonAlleMarkers(selectedCategory);

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 0, // De duur van de animatie in seconden
          });
        });

        // card 7 | afronden
        const card7prev = document.getElementById("card7prev");
        card7prev.addEventListener("click", () => {
          card7.classList.replace("flex", "hidden");
          card63.classList.replace("hidden", "flex");

          selectedCategory = categoryArray[5];
          toonAlleMarkers(selectedCategory);

          map.flyTo([defaultLat, defaultLon], defaultZoomLevel, {
            animate: true,
            duration: 0, // De duur van de animatie in seconden
          });
        });

        const card7next = document.getElementById("card7next");
        card7next.addEventListener("click", () => {
          card7.classList.replace("flex", "hidden");
          document.getElementById("cardExploration").classList.replace("hidden", "flex");
          zoomEnd = false;
          console.log(zoomEnd);
        });

        toonMarkersInDeBuurt();
      } else {
        document.getElementById("zipcodeError").classList.remove("hidden");
        document.getElementById("postcode").classList.add("border-red-500");
      }
    } catch (error) {
      console.error("Fout bij ophalen van gegevens:", error);
      document.getElementById("zipcodeError").classList.remove("hidden");
      document.getElementById("postcode").classList.add("border-red-500");
    }
  }

  // FUNCTIE OM DE AFSTAND TUSSEN TWEE PUNTEN TE BEREKENEN
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Aardstraal in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
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

  function skipTour() {
    cardOverlay.classList.replace("block", "hidden");
    document.getElementById("cardExploration").classList.replace("hidden", "flex");
    zoomEnd = false;
    console.log(zoomEnd);
  }

  function openFilters() {
    document.getElementById("filterButton").classList.replace("flex", "hidden");
    document.getElementById("filterSection").classList.replace("hidden", "block");
  }

  function closeFilters() {
    document.getElementById("filterButton").classList.replace("hidden", "flex");
    document.getElementById("filterSection").classList.replace("block", "hidden");
  }

// Array om de geselecteerde waarden bij te houden, begint met alles aan
let selectedItems = [
  "Industrie, Energie en Raffinaderijen",
  "Verkeer en vervoer",
  "Afval, riolering, waterzuivering",
  "Handel/Diensten/Overheid en Bouw",
  "Landbouw",
  "Overig",
];

// Variabele voor de kaartlaag
let buurtMarkersLayer2;

function voegNieuweMarkersToe() {
  const L = window.L;

  verwijderAlleMarkers();

  try {
    // Controleer of de kaartlaag al bestaat, anders maak je een nieuwe laag
    if (buurtMarkersLayer2) {
      buurtMarkersLayer2.clearLayers(); // Wis alle bestaande markers
    } else {
      buurtMarkersLayer2 = L.layerGroup().addTo(map);
    }

    // Controleer of geojsonData bestaat en geldig is
    if (!geojsonData || !geojsonData.features) {
      console.error("GeoJSON data is ongeldig of ontbreekt.");
      return;
    }

    const maxSchadekosten = Math.max(
      ...geojsonData.features.map(
        (feature) => feature.properties.schadekosten_2022 || 0 // Fallback naar 0 bij ontbrekende data
      )
    );

    geojsonData.features.forEach((feature) => {
      const { coordinates } = feature.geometry || {};
      const { aangepaste_sector: sector, schadekosten_2022: schadekosten } =
        feature.properties || {};

      if (!coordinates || !sector) {
        console.warn("Feature ontbreekt cruciale data:", feature);
        return;
      }

      const [lon, lat] = coordinates;
      const minRadius = 5;
      const maxRadius = 20;
      const radius =
        (schadekosten / maxSchadekosten) * (maxRadius - minRadius) + minRadius;

      // Controleer of de sector in de geselecteerde items zit
      if (!selectedItems.includes(sector)) {
        return;
      }

      const top3Uitstoot = getTop3UitstootPerBedrijf(feature.properties.bedrijf);
      const popupContent = `
        <div class="popup-content">
          <h3>${feature.properties.bedrijf || "Onbekend Bedrijf"}</h3>
          <p><strong>Sector:</strong> ${sector}</p>
          <p><strong>Schadekosten 2022:</strong> €${schadekosten?.toLocaleString(
            "nl-NL"
          )}</p>
          <p><strong>Uitstoot (Top 3):</strong></p>
          ${
            top3Uitstoot.length > 0
              ? `<canvas id="chart-${feature.properties.bedrijf.replace(
                  /\s+/g,
                  "-"
                )}" width="200" height="200"></canvas>`
              : "<p>Geen gegevens gevonden</p>"
          }
        </div>
      `;

      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        fillColor: sectorKleuren[sector] || "#8A2BE2", // Gebruik de sector kleur of standaard kleur
        color: sectorKleuren[sector] || "#8A2BE2", // Gebruik de sector kleur of standaard kleur
        weight: 0,
        opacity: 1,
        fillOpacity: 0.7,
      }).bindPopup(popupContent, { maxWidth: "auto", maxHeight: "auto" });

      buurtMarkersLayer2.addLayer(marker);

      // Maak de grafiek aan nadat de popup geopend is, als er data is
      if (top3Uitstoot.length > 0) {
        marker.on("popupopen", () => {
          createChart(
            `chart-${feature.properties.bedrijf.replace(/\s+/g, "-")}`,
            top3Uitstoot
          );
        });
      }
    });
  } catch (error) {
    console.error("Er is een fout opgetreden:", error);
  }
}

// Functie om items toe te voegen of te verwijderen
let filterCount = 5;

function toggleItem(item) {
  if (selectedItems.includes(item)) {
    // Verwijder item
    selectedItems = selectedItems.filter((i) => i !== item);
    filterCount = selectedItems.length - 1;
    console.log(filterCount)
  } else {
    // Voeg item toe
    selectedItems = [...selectedItems, item];
    filterCount = selectedItems.length -1;
    console.log(filterCount)
  }

  // Verwijder alle markers en voeg opnieuw toe op basis van de geselecteerde categorieën
  voegNieuweMarkersToe();
}

function verwijderAlleMarkers() {
  if (buurtMarkersLayer) {
    buurtMarkersLayer.clearLayers(); // Verwijder alle markers uit de laag
    map.removeLayer(buurtMarkersLayer); // Verwijder de laag zelf van de kaart
    buurtMarkersLayer = null; // Reset de variabele
  }
}

</script>

<!-- HTML STRUCTUUR -->
<div class="relative w-full h-full">
  <!-- POSTCODE INPUT EN ZOEKKNOP -->
  <div
    id="cardOverlay"
    class="z-40 w-full h-full absolute left-0 top-0 backdrop-brightness-50 backdrop-blur-sm block"
  >
    <div
      class="h-cardHeight rounded-2xl m-8 p-8 w-96 bg-white flex flex-col shadow-2xl"
    >
      <div>
        <div class="w-full flex justify-between pb-2">
          <p class="block text-xl font-bold leading-9">Locatie</p>
          <p class="block text-xl font-bold leading-9 opacity-15">1/7</p>
        </div>
        <p class="text-xl leading-9">
          In deze interactive staat uw eigen locatie centraal. Vul hieronder uw
          postcode in om te starten.
        </p>
        <div class="mt-4">
          <label class="text-xl" for="postcode">Postcode</label>
          <div class="flex w-full mt-1">
            <input
              id="postcode"
              name="postcode"
              type="text"
              placeholder="1234AB"
              class="leading-9 flex-1 py-2 px-4 text-xl border-l-2 border-t-2 border-b-2 rounded-l-full border-slate-200"
              bind:value={postcode}
              on:keydown={handleKeyPress}
            />
            <button
              on:click={zoekPostcode}
              class="bg-[#DEFF9C] pl-4 pr-6 border-2 border-[#A3BE6F] rounded-r-full"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-map-search"
                ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
                  d="M11 18l-2 -1l-6 3v-13l6 -3l6 3l6 -3v7.5"
                /><path d="M9 4v13" /><path d="M15 7v5" /><path
                  d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
                /><path d="M20.2 20.2l1.8 1.8" /></svg
              ></button
            >
          </div>
          <p id="zipcodeError" class="hidden mt-1 text-red-500 leading-9">
            Voer een geldige postcode in.
          </p>
        </div>
      </div>
      <div class="flex w-full mt-auto justify-center">
        <button class="block w-fit underline leading-9" on:click={skipTour}
          >Of sla de ervaring over</button
        >
      </div>
    </div>
  </div>

  <div
    id="card2"
    class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Industrie, Energie en Raffinaderijen
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">
        U ziet nu 443 bedrijven in de desbetreffende sector. Deze sector is
        verantwoordelijk voor 40% van alle kosten voor luchtvervuiling in
        Nederland.
      </p>
      <div
        class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start"
      >
        <div class="w-2/5 bg-[#1E90FF]"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button class="p-4 bg-[#DEFF9C] rounded-full opacity-30 cursor-no-drop">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card2next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card21"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Industrie, Energie en Raffinaderijen
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">
        Het schadelijkste bedrijf in Nederland bevind zich in IJmuiden.
        Tatasteel BV heeft in totaal €408.378.600 schade-kosten in 2022.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card21prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card21next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card22"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Industrie, Energie en Raffinaderijen
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">
        In havengebied Rotterdam is er ook spraken van een grote mate van
        luchtvervuiling door deze sector. De grootste vervuiler is Esso
        Nederland BV (Raffinaderij Rotterdam).
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card22prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card22next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card23"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Industrie, Energie en Raffinaderijen
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">
        Deze bedrijven vervuilen de lucht bij u in de buurt:
      </p>
      <div class="mt-6">
        <p class="text-xl">Bedrijfsnaam 1</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-2/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 2</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 3</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/4 h-2 bg-[#FF5362]"></div>
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card23prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
      </div>
      <button
        id="card23next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card3"
    class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">
        In Nederland zijn er in totaal 20 verschillende vliegvelden. Deze sector
        is verantwoordelijk voor 10% van de kosten die worden gemaakt voor
        luchtvervuiling in Nederland.
      </p>
      <div
        class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start"
      >
        <div class="w-2/5 bg-[#1E90FF]"></div>
        <div class="w-1/10 bg-[#4D00FF]"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card3prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card3next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card31"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">
        Schiphol is een van de belangrijkste luchthavens van Europa en de
        grootste van Nederland. Hier staat een prijskaartje van €161.264.591 in
        schadekosten voor luchtvervuiling tegenover.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card31prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card31next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card32"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">
        De luchthaven met de laagste schadekosten ligt is vliegveld De Kooy. Met
        €215.731 staat dit vliegveld onderaan.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card32prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card32next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card33"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">
        Dit zijn de luchthavens in uw buurt gesorteerd op hoogte van de
        schadekosten.
      </p>
      <div class="mt-6">
        <p class="text-xl">Bedrijfsnaam 1</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-2/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 2</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 3</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/4 h-2 bg-[#FF5362]"></div>
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card33prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
      </div>
      <button
        id="card33next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card4"
    class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Afval, riolering, waterzuivering
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">4/7</p>
      </div>
      <p class="text-xl leading-9">
        De 348 installaties in Nederland die het land voorzien van
        afval-verwerking, riolering en ook waterzuivering zijn goed voor 5% van
        de schadekosten voor luchtvervuiling in Nederland.
      </p>
      <div
        class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start"
      >
        <div class="w-2/5 bg-[#1E90FF]"></div>
        <div class="w-1/10 bg-[#4D00FF]"></div>
        <div class="w-1/20 bg-[#00D9AD]"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card4prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card4next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card41"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Afval, riolering, waterzuivering
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">4/7</p>
      </div>
      <p class="text-xl leading-9">
        Afval Energie Bedrijf (Amsterdam) is het bedrijf in Nederland met de
        grootste kosten. Deze kosten waren in 2022 in totaal €23.489.029.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card41prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card41next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card42"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Afval, riolering, waterzuivering
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">4/7</p>
      </div>
      <p class="text-xl leading-9">
        De schadekosten van deze grote sector variëren sterk. De kosten van
        rioolwaterzuiverings-installaties (RWZI) verschillen sterk door de
        grootte van de plaats. De kleinste RWZI, Berkenwoude, heeft een
        kostenpost van €10.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card42prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card42next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card43"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Afval, riolering, waterzuivering
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">4/7</p>
      </div>
      <p class="text-xl leading-9">
        In uw buurt zijn dit de bedrijven met de hoogste kosten:
      </p>
      <div class="mt-6">
        <p class="text-xl">Bedrijfsnaam 1</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-2/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 2</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 3</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/4 h-2 bg-[#FF5362]"></div>
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card43prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
      </div>
      <button
        id="card43next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card5"
    class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Handel, diensten, overheid en bouw
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">5/7</p>
      </div>
      <p class="text-xl leading-9">
        Op de kaart ziet u nu 47 locaties staan die vallen binnen deze sector.
        In totaal maakt dit 5% uit van de totale schadenkosten in Nederland.
      </p>
      <div
        class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start"
      >
        <div class="w-2/5 bg-[#1E90FF]"></div>
        <div class="w-1/10 bg-[#4D00FF]"></div>
        <div class="w-1/20 bg-[#00D9AD]"></div>
        <div class="w-1/20 bg-[#DEFF9C]"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card5prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card5next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card51"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Handel, diensten, overheid en bouw
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">5/7</p>
      </div>
      <p class="text-xl leading-9">
        In Veendam bevindt zich het bedrijf genaamd Nedmag BV. Dit is het
        bedrijf met de grootste schade, namelijk €23.110.334.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card51prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card51next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card52"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Handel, diensten, overheid en bouw
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">5/7</p>
      </div>
      <p class="text-xl leading-9">
        De vervuilers in deze sector zijn enigszins verspreid door Nederland. In
        Rotterdam zijn enkele bedrijven die in de buurt van elkaar zijn, maar
        ook in andere steden zijn er meerdere bedrijven te vinden.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card52prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card52next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card53"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">
          Handel, diensten, overheid en bouw
        </p>
        <p class="block text-xl font-bold text-slate-200 leading-9">5/7</p>
      </div>
      <p class="text-xl leading-9">
        In uw buurt zijn dit de vervuilers met de hoogste kosten:
      </p>
      <div class="mt-6">
        <p class="text-xl">Bedrijfsnaam 1</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-2/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 2</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/3 h-2 bg-[#FF5362]"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 3</p>
        <div
          class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden"
        >
          <div class="w-1/4 h-2 bg-[#FF5362]"></div>
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card53prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
      </div>
      <button
        id="card53next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card6"
    class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Landbouw</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">6/7</p>
      </div>
      <p class="text-xl leading-9">
        Nu zoomen wij in op vijf vervuilende landbouwbedrijven. Deze zijn nu te
        zien op de kaart. De landbouw is een zeer vervuilende sector, goed voor
        40% van de totale schadekosten.
      </p>
      <div
        class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start"
      >
        <div class="w-2/5 bg-[#1E90FF]"></div>
        <div class="w-1/10 bg-[#4D00FF]"></div>
        <div class="w-1/20 bg-[#00D9AD]"></div>
        <div class="w-1/20 bg-[#DEFF9C]"></div>
        <div class="w-2/5 bg-[#FF8800]"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card6prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card6next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card61"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Landbouw</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">6/7</p>
      </div>
      <p class="text-xl leading-9">
        Het landbouw bedrijf met de grootste schadenkosten is gevestigd in
        Kapelle en heet Seasun BV. Deze groententeler heeft in totaal €367.333
        schadekosten.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card61prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card61next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card62"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Landbouw</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">6/7</p>
      </div>
      <p class="text-xl leading-9">
        Op de tweede plaats staat Leo Hoogweg BV met in totaal €323.379 aan
        kosten. Deze kwekerij bevindt zich in Luttelgeest.
      </p>
      <p class="mt-4 leading-6 text-slate-300">
        Klik op de bedrijven en bekijk de opbouw van de veroorzaakte
        luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card62prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
      </div>
      <button
        id="card62next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card63"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Landbouw</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">6/7</p>
      </div>
      <p class="text-xl leading-9">
        Landbouwbedrijven vestigen zich vaak buiten de randstad, maar dit
        betekent niet dat de luchtvervuiling verder reikt. Daarnaast ligt de
        focus nu op 5 bedrijven, maar in realiteit zijn er natuurlijk veel meer
        kleinere bedrijven die ook een bijdrage hebben aan luchtvervuiling.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card63prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-200"></div>
        <div class="w-2 h-2 rounded-full bg-slate-900"></div>
      </div>
      <button
        id="card63next"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="card7"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div>
      <div class="w-full flex justify-between pb-2 gap-4">
        <p class="block text-xl font-bold leading-9">Einde</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">7/7</p>
      </div>
      <p class="text-xl leading-9">
        U kunt nu zelf rond kijken om een compleet beeld van alle vervuilende
        bedrijven in Nederland te krijgen. Met filters kunt u verschillende
        sectoren aan en uit zetten.
      </p>
    </div>
    <div class="flex justify-between items-center">
      <button
        id="card7prev"
        class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg
        >
      </button>
      <button
        id="card7next"
        class="text-lg gap-2 items-center flex p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100"
      >
        Zelf rondkijken<svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M5 12l14 0"
          /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg
        >
      </button>
    </div>
  </div>

  <div
    id="cardExploration"
    class="z-40 h-fit w-fit absolute left-0 bottom-0 rounded-2xl m-8  bg-white shadow-2xl hidden flex-col justify-between"
  >
    <div class="w-fit hidden items-center justify-center" id="filterButton">
      <button on:click={openFilters} class="p-4 relative"
        >
        <p class="h-6 w-6 rounded-full text-white p-1 flex items-center justify-center absolute -top-2 -right-2 bg-[#4D00FF] text-white>">
          {filterCount}
        </p>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-filter"
          ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
            d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227z"
          /></svg
        ></button
      >
    </div>
    <div id="filterSection" class="w-96 p-8 block">
      <div>
        <div class="w-full flex justify-between pb-2 gap-4">
          <p class="block text-xl font-bold leading-9">Filters</p>
          <button on:click={closeFilters}
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon icon-tabler icons-tabler-outline icon-tabler-x"
              ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
                d="M18 6l-12 12"
              /><path d="M6 6l12 12" /></svg
            ></button
          >
        </div>
        <div>
          {#each [
            "Industrie, Energie en Raffinaderijen",
            "Verkeer en vervoer",
            "Afval, riolering, waterzuivering",
            "Handel/Diensten/Overheid en Bouw",
            "Landbouw"
          ] as label}
            <div class="checkbox-container">
              <label class="leading-9 text-lg">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(label)}
                  on:change={() => toggleItem(label)}
                />
                {label}
              </label>
            </div>
          {/each}
        </div>

      </div>
    </div>
  </div>
  <!-- KAART WEERGAVE -->
  <div id="map" class="w-full h-full z-10"></div>
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
