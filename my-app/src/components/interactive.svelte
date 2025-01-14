<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";

  let map;
  let isZoomKeyPressed = false;
  let inputValue = ""; // Houd de waarde van de invoer bij
  let marker; // Variabele om de marker bij te houden

  async function getCoordinates(zipcode) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=Netherlands&format=json`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];

        const zipcodeSection = document.getElementById("zipcodeSection");
        zipcodeSection.classList.add("hidden");

        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      } else {
        console.error(`No coordinates found for zipcode ${zipcode}`);

        const button = document.getElementById('wrongAnswerButton');
        button.classList.add('animate-shake');

        const input = document.getElementById('zipcodeInput');
        input.classList.add('bg-red-100');

        // Remove the class after animation ends to allow retriggering
        button.addEventListener('animationend', () => {
          button.classList.remove('animate-shake');
        }, { once: true });

        
        return null;
      }
    } catch (error) {
      console.error("Error fetching coordinates:", error);
      return null;
    }
  }

  async function handleSearch() {
    if (!inputValue.trim()) {
      console.error("Please enter a valid postal code.");
      return;
    }

    const coordinates = await getCoordinates(inputValue.trim());
    if (coordinates) {
      // Voeg een nieuwe marker toe of verplaats de bestaande marker
      if (marker) {
        marker.setLatLng([coordinates.lat, coordinates.lon]);
      } else {
        const customIcon = L.icon({
          iconUrl: "/images/mapmarker.png", // URL naar de aangepaste markerafbeelding
          iconSize: [60, 60], // Grootte van de icon
          iconAnchor: [19, 38], // Punt dat overeenkomt met de locatie
          popupAnchor: [0, -30], // Punt voor de popup
        });
        marker = L.marker([coordinates.lat, coordinates.lon], {
          icon: customIcon,
        }).addTo(map);
      }

      // Centreer de kaart op de nieuwe marker
      map.setView([coordinates.lat, coordinates.lon], 12);
    }
  }

  onMount(async () => {
    if (typeof window !== "undefined") {
      const L = await import("leaflet");

      map = L.map("map").setView([52.1326, 5.2913], 7);

      // Satellite map
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 18,
        }
      ).addTo(map);

      // Disable scroll zoom by default
      map.scrollWheelZoom.disable();

      // Listen for keydown and keyup events
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      map.on("mouseover", handleMouseOver);
      map.on("mouseout", handleMouseOut);
    }
  });

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

  function hideZipcodeSection() {
    const zipcodeSection = document.getElementById("zipcodeSection");
    zipcodeSection.classList.add("hidden");
  }
</script>

<div class="relative w-full h-testHeight">
  <div
    id="zipcodeSection"
    class="absolute z-20 top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-30 backdrop-blur-sm"
  >
    <div class="bg-white p-8 flex justify-center flex-col items-center">
      <div id="wrongAnswerButton" class="flex">
        <input
          placeholder="postcode"
          type="text"
          bind:value={inputValue}
          id="zipcodeInput"
          class="block border-2 border-black px-6 py-4 rounded-l-full m-0 text-2xl"
        />
        <button
          class="block border-2 border-black border-l-0 pl-4 pr-6 py-4 rounded-r-full m-0 bg-[#DEFF9C]"
          on:click={handleSearch}
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
            class="icon icon-tabler icons-tabler-outline icon-tabler-map-search"
            ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
              d="M11 18l-2 -1l-6 3v-13l6 -3l6 3l6 -3v7.5"
            /><path d="M9 4v13" /><path d="M15 7v5" /><path
              d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
            /><path d="M20.2 20.2l1.8 1.8" /></svg
          >
        </button>
      </div>
      <div class="mt-2">
        <p class="inline">Of</p>
        <button id="skipTourButton" class="inline underline" on:click{hideZipcodeSection}>sla de tour over</button>
      </div>
    </div>
  </div>
  <!-- Map -->
  <div id="map" class="w-full h-full absolute z-10"></div>
</div>

<style>
  #map {
    height: 600px; /* Pas de hoogte van de kaart aan */
  }
</style>
