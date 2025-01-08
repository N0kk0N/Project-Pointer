<script>
  import { onMount } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  let map;
  let isZoomKeyPressed = false;
  let inputValue = ''; // Houd de waarde van de invoer bij
  let marker; // Variabele om de marker bij te houden
  
  async function getCoordinates(zipcode) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=Netherlands&format=json`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      } else {
        console.error(`No coordinates found for zipcode ${zipcode}`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching coordinates:', error);
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
          iconUrl: '/images/mapmarker.png', // URL naar de aangepaste markerafbeelding
          iconSize: [60, 60], // Grootte van de icon
          iconAnchor: [19, 38], // Punt dat overeenkomt met de locatie
          popupAnchor: [0, -30], // Punt voor de popup
        });
        marker = L.marker([coordinates.lat, coordinates.lon], { icon: customIcon }).addTo(map);
      }

      // Centreer de kaart op de nieuwe marker
      map.setView([coordinates.lat, coordinates.lon], 12);
    }
  }

  onMount(async () => {
    if (typeof window !== 'undefined') {
      const L = await import('leaflet');

      map = L.map('map').setView([52.1326, 5.2913], 7);

      // Satellite map
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
      }).addTo(map);

      // Disable scroll zoom by default
      map.scrollWheelZoom.disable();

      // Listen for keydown and keyup events
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      map.on('mouseover', handleMouseOver);
      map.on('mouseout', handleMouseOut);
    }
  });

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
</script>

<style>
  #map {
    height: 600px; /* Pas de hoogte van de kaart aan */
  }
</style>

<div>
  <input
    placeholder="postcode"
    type="text"
    bind:value={inputValue}
  >
  <button on:click={handleSearch}>Search</button>
</div>

<div class="relative w-full h-testHeight">
  <!-- Button Container -->
  <div class="flex justify-center mt-4">
    <button
      class="inline-flex gap-2 items-center rounded-full text-xl bg-[#DEFF9C] px-6 py-4 z-20 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2"
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
  <!-- Map -->
  <div id="map" class="w-full h-full absolute z-10"></div>
</div>
