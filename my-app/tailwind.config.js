import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {
      colors: {
        industrie: '#1E90FF',
        verkeer: '#4D00FF',
        afval: '#00D9AD',
        handel: '#C5E88B',
        landbouw: '#FF8800'
      },
      fontFamily: {
        custom: ['custom', 'sans-serif'], // Add fallback fonts if needed
      },
      maxWidth: {
        'relatedMax': '80rem', // Add a custom class for max width
      },
      height: {
        'interactiveHeight': '32em',
        'cardHeight': 'calc(100% - 4em)',
      },
      width: {
        'ierWidth': '60%',
        'vevWidth': '17%',
        'arwWidth': '8%',
        'hdoebWidth': '10%',
        'lWidth': '5%',
        '1/10': '10%',
        '1/20': '5%',
      },
      textDecorationColor: {
        'black': '#000000', // Add custom text decoration color
      },
    },
  },

  plugins: [
    typography,
    function({ addUtilities }) {
      addUtilities({
        '.underline-black': {
          'text-decoration': 'underline',
          'text-decoration-color': '#000000',
        },
      });
    },
  ],
};