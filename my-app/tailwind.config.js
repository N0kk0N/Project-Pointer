import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {
      fontFamily: {
        'formula': ['titlefont', 'sans-serif'],
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
      }
    }
  },

  plugins: [typography]
};
