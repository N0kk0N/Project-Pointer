<script>
  import { onMount } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  onMount(async () => {
    // Controleer of we in de browseromgeving zitten
    if (typeof window !== 'undefined') {
      // Dynamisch importeren van Leaflet
      const L = await import('leaflet');

      // Initialiseer de kaart
      const map = L.map('map', {
        scrollWheelZoom: false // Schakel standaard scroll zoom uit
      }).setView([52.1326, 5.2913], 7); // Coördinaten van Nederland

      // Voeg een kaartlaag toe
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Voeg een marker toe voor Amsterdam
      L.marker([52.3676, 4.9041]).addTo(map)
        .bindPopup('Amsterdam')
        .openPopup();

      // Functie om scroll zoom in te schakelen wanneer de command-toets is ingedrukt
      const enableScrollZoom = (e) => {
        if (e.metaKey) {
          map.scrollWheelZoom.enable();
        }
      };

      // Functie om scroll zoom uit te schakelen wanneer de command-toets wordt losgelaten
      const disableScrollZoom = (e) => {
        if (!e.metaKey) {
          map.scrollWheelZoom.disable();
        }
      };

      // Event listeners voor toets indrukken en loslaten
      window.addEventListener('keydown', enableScrollZoom);
      window.addEventListener('keyup', disableScrollZoom);

      // Opruimen van event listeners bij demontage van de component
      return () => {
        window.removeEventListener('keydown', enableScrollZoom);
        window.removeEventListener('keyup', disableScrollZoom);
      };
    }
  });
</script>

<style>
  #map {
    height: 500px; /* Pas de hoogte van de kaart aan */
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