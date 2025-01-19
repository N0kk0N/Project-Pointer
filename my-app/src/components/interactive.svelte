<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";

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
  let currentLat = 52.1326; // HUIDIGE LOCATIE BREEDTEGRAAD (VOORBEELD)
  let currentLon = 5.2913; // HUIDIGE LOCATIE LENGTEGRAAD (VOORBEELD)

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

  // FUNCTIE OM LOCATIES IN DE BUURT VAN DE OPGEZOCHTE POSTCODE TE TONEN
  function toonMarkersInDeBuurt() {
    const L = window.L;

    if (buurtMarkersLayer) {
      map.removeLayer(buurtMarkersLayer); // VERWIJDER BESTAANDE BUURTMARKERS
    }

    const buurtStraal = 25000; // 25 KM STRAAL
    buurtMarkersLayer = L.layerGroup();

    const maxSchadekosten = Math.max(
      ...geojsonData.features.map(
        (feature) => feature.properties.schadekosten_2022
      )
    );

    const boundsArray = [];

    geojsonData.features.forEach((feature) => {
      const lat = feature.geometry.coordinates[1];
      const lon = feature.geometry.coordinates[0];

      const afstand = L.latLng(currentLat, currentLon).distanceTo([lat, lon]);

      if (afstand <= buurtStraal) {
        const schadekosten = feature.properties.schadekosten_2022;
        const minRadius = 5;
        const maxRadius = 20;
        const radius =
          (schadekosten / maxSchadekosten) * (maxRadius - minRadius) +
          minRadius;

        const top3Uitstoot = getTop3UitstootPerBedrijf(
          feature.properties.bedrijf
        );

        const marker = L.circleMarker([lat, lon], {
          radius: radius,
          fillColor: "#00D9AD",
          color: "#00D9AD",
          weight: 0,
          opacity: 1,
          fillOpacity: 0.7,
        }).bindPopup(`
          <b>${feature.properties.bedrijf}</b><br>
          Sector: ${feature.properties.aangepaste_sector}<br>
          Schadekosten 2022: €${feature.properties.schadekosten_2022.toLocaleString("nl-NL")}<br>
          Uitstoot (Top 3):
          <ul>
            ${
              top3Uitstoot.length > 0
                ? top3Uitstoot
                    .map(
                      (stof) =>
                        `<li>${stof.Stof}: ${stof.Hoeveelheid.toLocaleString("nl-NL")} ${stof.Eenheid}</li>`
                    )
                    .join("")
                : `<li>Geen gegevens aanwezig</li>`
            }
          </ul>
        `);

        buurtMarkersLayer.addLayer(marker);

        boundsArray.push(marker.getLatLng());
      }
    });

    buurtMarkersLayer.addTo(map);
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
          map.removeLayer(map._purpleMarker); // VERWIJDER OUDERE MARKER
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

        // Hier komt het verwijderen van de oude card en de donkere achtergrond
        const cardOverlay = document.getElementById("cardOverlay");
        cardOverlay.classList.add("hidden");

        const firstTestCard = document.getElementById("firstTestCard");
        firstTestCard.classList.remove("hidden");

        toonMarkersInDeBuurt();
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
  <div
    id="cardOverlay"
    class="z-40 w-full h-full absolute left-0 top-0 backdrop-brightness-50 backdrop-blur-sm"
  >
    <div class="h-cardHeight rounded-2xl m-8 p-8 w-96 bg-white flex flex-col shadow-2xl">
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
          <p id="zipcodeError" class="hidden mt-1 text-red-500 leading-9">Voer een geldige postcode in.</p>
        </div>
      </div>
      <div class="flex w-full mt-auto justify-center">
        <button class="block w-fit underline leading-9">Of sla de ervaring over</button>
      </div>
    </div>
  </div>

  <div
    id="firstTestCard"
   class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl flex flex-col justify-between hidden">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Industrie, Energie en
          Raffinaderijen</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">U ziet nu 442 bedrijven in de desbetreffende sector. Deze sector is verantwoordelijk voor 60% van alle kosten voor luchtvervuiling in Nederland.</p>
      <div class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start">
        <div class="w-ierWidth bg-red-600"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button class="p-4 bg-[#DEFF9C] rounded-full opacity-30 cursor-no-drop">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
      </div>
      <button class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
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
</style>
