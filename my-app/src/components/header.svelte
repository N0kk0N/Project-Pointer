<script>
    import { onMount } from "svelte";

    let scrolled = false;

    onMount(() => {
        // Add scroll event listener when the component mounts
        const handleScroll = () => {
            if (window.scrollY > 0) {
                // Log when the page is scrolled away from the top
                if (!scrolled) {
                    console.log("The page has scrolled down!");
                    document.getElementById("kroncrv").classList.replace("w-32", "w-16");
                    document.getElementById("kroncrv").classList.replace("opacity-100", "opacity-0");
                    document.getElementById("pointer").classList.replace("w-40", "w-32");
                    scrolled = true;
                }
            } else {
                // Log when the page is at the top
                if (scrolled) {
                    console.log("The page is back at the top!");
                    document.getElementById("kroncrv").classList.replace("w-16", "w-32");
                    document.getElementById("kroncrv").classList.replace("opacity-0", "opacity-100");
                    document.getElementById("pointer").classList.replace("w-32", "w-40");
                    scrolled = false;
                }
            }
        };

        window.addEventListener("scroll", handleScroll);

        // Cleanup the event listener when the component is destroyed
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    });
</script>

<div class="flex items-center justify-between bg-white h-20 shadow-lg sticky top-0 z-50">
    <div class="flex items-center">
        <a href="https://pointer.kro-ncrv.nl/">
            <img
                id="pointer"
                src="/images/pointerLogo.png"
                alt="Pointer logo"
                class="w-40 h-auto ml-2 transition-all duration-300 ease-in-out"
            />
        </a>
    </div>
    
    <div class="flex items-center justify-between gap-4">
        <a href="https://kro-ncrv.nl/" target="_blank" class="hidden md:flex w-32 justify-center">
            <img
                id="kroncrv"
                src="/images/kroLogo.png"
                alt="KRO NCRV Logo"
                class="w-32 h-auto opacity-100 transition-all duration-300 ease-in-out"
            />
        </a>

        <a
            href="https://pointer.kro-ncrv.nl/deel-jouw-ervaring"
            class=" hidden md:flex flex items-center bg-[#DEFF9C] rounded-full pt-2 pb-2 pr-4 pl-4 hover:bg-black hover:text-white transition-all duration-200"
        >
            Deel jouw ervaring
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                class="w-4 h-auto ml-2"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path
                    d="M10 18l6-6-6-6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <path
                    d="M16 12H3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </a>

        <a href="https://npo.nl/start" target="_blank">
            <img
            src="/images/npoLogo.png"
            alt="NPO Logo"
            class="w-8 h-auto"
            />
        </a>

        <a href="#/">
            <img
                src="/images/search.png"
                alt="Zoek knop"
                class="w-6 h-auto"
            />
        </a>

        <button class="flex items-center justify-center p-2 mr-2 bg-transparent border-none" aria-label="Hamburgermenu">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-8 h-auto" fill="none" stroke="currentColor" stroke-width="4">
                <rect x="3" y="5" width="18" height="2" stroke="none" fill="currentColor"/>
                <rect x="3" y="11" width="18" height="2" stroke="none" fill="currentColor"/>
                <rect x="3" y="17" width="18" height="2" stroke="none" fill="currentColor"/>
            </svg>
        </button>
    </div>
</div>