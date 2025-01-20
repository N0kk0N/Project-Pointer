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

        const cardOverlay = document.getElementById("cardOverlay");
        cardOverlay.classList.replace("block", "hidden");

        const card2 = document.getElementById("card2");
        const card21 = document.getElementById("card21");
        const card22 = document.getElementById("card22");
        const card23 = document.getElementById("card23");

        const card3 = document.getElementById("card3");
        const card31 = document.getElementById("card31");
        const card32 = document.getElementById("card32");

        card2.classList.replace("hidden", "flex");

        // card 2 | algemeen
        const card2next = document.getElementById("card2next");
        card2next.addEventListener("click", () => {
          card2.classList.replace("flex", "hidden");
          card21.classList.replace("hidden", "flex");
        });

        // card 2.1 | ergste
        const card21prev = document.getElementById("card21prev");
        card21prev.addEventListener("click", () => {
          card21.classList.replace("flex", "hidden");
          card2.classList.replace("hidden", "flex");
        });

        const card21next = document.getElementById("card21next");
        card21next.addEventListener("click", () => {
          card21.classList.replace("flex", "hidden");
          card22.classList.replace("hidden", "flex");
        });

        // card 2.2 | interssant
        const card22prev = document.getElementById("card22prev");
        card22prev.addEventListener("click", () => {
          card22.classList.replace("flex", "hidden");
          card21.classList.replace("hidden", "flex");
        });

        const card22next = document.getElementById("card22next");
        card22next.addEventListener("click", () => {
          card22.classList.replace("flex", "hidden");
          card23.classList.replace("hidden", "flex");
        });

        // card 2.3 | eigen locatie
        const card23prev = document.getElementById("card23prev")
        card23prev.addEventListener("click", () => {
          card23.classList.replace("flex", "hidden");
          card22.classList.replace("hidden", "flex");
        });

        const card23next = document.getElementById("card23next");
        card23next.addEventListener("click", () => {
          card23.classList.replace("flex", "hidden");
          card3.classList.replace("hidden", "flex");
        });

        // card 3 | algemeen
        const card3prev = document.getElementById("card3prev")
        card3prev.addEventListener("click", () => {
          card3.classList.replace("flex", "hidden");
          card23.classList.replace("hidden", "flex");
        });

        const card3next = document.getElementById("card3next");
        card3next.addEventListener("click", () => {
          card3.classList.replace("flex", "hidden");
          card31.classList.replace("hidden", "flex");
        });

        // card 3.1 | ergste
        const card31prev = document.getElementById("card31prev")
        card31prev.addEventListener("click", () => {
          card31.classList.replace("flex", "hidden");
          card3.classList.replace("hidden", "flex");
        });

        const card31next = document.getElementById("card31next");
        card31next.addEventListener("click", () => {
          card31.classList.replace("flex", "hidden");
          card32.classList.replace("hidden", "flex");
        });

        // card 3.2 | interessant
        const card32prev = document.getElementById("card32prev")
        card32prev.addEventListener("click", () => {
          card32.classList.replace("flex", "hidden");
          card31.classList.replace("hidden", "flex");
        });

        const card32next = document.getElementById("card32next");
        card32next.addEventListener("click", () => {
          card32.classList.replace("flex", "hidden");
          card33.classList.replace("hidden", "flex");
        });


        // card 3.3 | eigen locatie
        const card33prev = document.getElementById("card33prev")
        card33prev.addEventListener("click", () => {
          card33.classList.replace("flex", "hidden");
          card32.classList.replace("hidden", "flex");
        });

        const card33next = document.getElementById("card33next");
        card33next.addEventListener("click", () => {
          card33.classList.replace("flex", "hidden");
          card4.classList.replace("hidden", "flex");
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
    class="z-40 w-full h-full absolute left-0 top-0 backdrop-brightness-50 backdrop-blur-sm block"
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
    id="card2"
   class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
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
      <button id="card2next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>

  <div
    id="card21"
   class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Industrie, Energie en
          Raffinaderijen</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">Het schadelijkste bedrijf in Nederland bevind zich in IJmuiden. Tatasteel BV heeft in totaal €408.378.600 schade-kosten in 2022.</p>
      <p class="mt-4 leading-6 text-slate-300">Klik op de bedrijven en bekijk de opbouw van de veroorzaakte luchtvervuiling.</p>
    </div>
    <div class="flex justify-between items-center">
      <button id="card21prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
      </div>
      <button id="card21next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>

  <div
    id="card22"
   class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Industrie, Energie en
          Raffinaderijen</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">In havengebied Rotterdam is er ook spraken van een grote mate van luchtvervuiling door deze sector. De grootste vervuiler is Esso Nederland BV (Raffinaderij Rotterdam).</p>
      <p class="mt-4 leading-6 text-slate-300">Klik op de bedrijven en bekijk de opbouw van de veroorzaakte luchtvervuiling.</p>
    </div>
    <div class="flex justify-between items-center">
      <button id="card22prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
      </div>
      <button id="card22next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>

  <div
    id="card23"
   class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Industrie, Energie en
          Raffinaderijen</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">2/7</p>
      </div>
      <p class="text-xl leading-9">Deze bedrijven vervuilen de lucht bij u in de buurt:</p>
      <div class="mt-6">
        <p class="text-xl">Bedrijfsnaam 1</p>
        <div class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="w-2/3 h-2 bg-red-500"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 2</p>
        <div class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="w-1/3 h-2 bg-red-500"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 3</p>
        <div class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="w-1/4 h-2 bg-red-500"></div>
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button id="card23prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
      </div>
      <button id="card23next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>

  <div
    id="card3"
   class="z-30 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">In Nederland zijn er in totaal 17 verschillende vliegvelden. Deze sector is verantwoordelijk voor 17% van de kosten die worden gemaakt voor luchtvervuiling in Nederland.</p>
      <div class="w-full h-2 bg-slate-200 mt-8 rounded-full overflow-hidden flex justify-start">
        <div class="w-ierWidth bg-red-600"></div>
        <div class="w-vevWidth bg-blue-600"></div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button id="card3prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
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
      <button id="card3next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>
  
  <div
  id="card31"
  class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">Schiphol is een van de belangrijkste luchthavens van Europa en de grootste van Nederland. Hier staat een prijskaartje van €161.264.591 in schadekosten voor luchtvervuiling tegenover.</p>
      <p class="mt-4 leading-6 text-slate-300">Klik op de bedrijven en bekijk de opbouw van de veroorzaakte luchtvervuiling.</p>
    </div>
    <div class="flex justify-between items-center">
      <button id="card31prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
      </div>
      <button id="card31next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>

  <div
    id="card32"
    class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">De luchthaven met de laagste schadekosten ligt is vliegveld De Kooy. Met €215.731 staat dit vliegveld onderaan.</p>
      <p class="mt-4 leading-6 text-slate-300">Klik op de bedrijven en bekijk de opbouw van de veroorzaakte luchtvervuiling.</p>
    </div>
    <div class="flex justify-between items-center">
      <button id="card32prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
      </div>
      <button id="card32next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>      </button>
    </div>
  </div>

  <div
    id="card33"
   class="z-40 h-cardHeight absolute left-0 top-0 rounded-2xl m-8 p-8 w-96 bg-white shadow-2xl hidden flex-col justify-between">
    <div>
      <div class="w-full flex justify-between pb-2">
        <p class="block text-xl font-bold leading-9">Verkeer en vervoer</p>
        <p class="block text-xl font-bold text-slate-200 leading-9">3/7</p>
      </div>
      <p class="text-xl leading-9">Dit zijn de luchthavens in uw buurt gesorteerd op hoogte van de schadekosten.</p>
      <div class="mt-6">
        <p class="text-xl">Bedrijfsnaam 1</p>
        <div class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="w-2/3 h-2 bg-red-500"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 2</p>
        <div class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="w-1/3 h-2 bg-red-500"></div>
        </div>
        <p class="text-xl">Bedrijfsnaam 3</p>
        <div class="mt-1 mb-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="w-1/4 h-2 bg-red-500"></div>
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center">
      <button id="card33prev" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
        <svg xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </button>
      <div class="flex gap-4">
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-200">
        </div>
        <div class="w-2 h-2 rounded-full bg-slate-900">
        </div>
      </div>
      <button id="card33next" class="p-4 bg-[#DEFF9C] rounded-full hover:brightness-90 transition ease-in-out duration-100">
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
