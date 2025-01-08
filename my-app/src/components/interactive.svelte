<script>
  import { onMount } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  let map;
  let isZoomKeyPressed = false;

  onMount(async () => {
    if (typeof window !== 'undefined') {
      const L = await import('leaflet');

      map = L.map('map').setView([52.1326, 5.2913], 7);

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
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

<div class="relative w-full h-full">
  <!-- Map -->
  <div id="map" class="w-full h-full"></div>

  <!-- Button Container -->
  <div class="flex justify-center mt-4">
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
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M5 12l14 0" />
        <path d="M13 18l6 -6" />
        <path d="M13 6l6 6" />
      </svg>
    </button>
  </div>
</div>