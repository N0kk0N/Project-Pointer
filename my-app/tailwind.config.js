import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {
      maxWidth: {
        'relatedMax': '80rem', // Add a custom class for max width
      },
      height: {
        'interactiveHeight': '32em',
        'testHeight': '600px',
      }
    }
  },

  plugins: [typography]
};
