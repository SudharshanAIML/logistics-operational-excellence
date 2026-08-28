/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          brown: '#351C15',      // chrome, headers, primary text
          brown900: '#24120D',   // sidebar, deepest surface
          brown700: '#4A2B21',   // hover on brown surfaces
          gold: '#FFB500',       // THE accent
          gold600: '#E0A000',    // gold hover
          green: '#64A70B',      // on-target, positive delta
        },
        canvas: '#FFFFFF',
        surface: '#FAF8F6',      // page background, warm off-white
        surfaceAlt: '#F2EEEA',   // table stripe, inset panels
        borderClean: '#E3DCD6',  // hairlines
        borderStrong: '#C9BFB6',
        textMain: '#1F1512',
        textMuted: '#6B5D55',
        textInverse: '#FFF9F0',
        status: {
          ok: '#64A70B',
          watch: '#FFB500',
          risk: '#C0392B',
          idle: '#8C9196',
        }
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        ui: ['Barlow', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        btn: '6px',
        badge: '4px',
        input: '6px',
      }
    },
  },
  plugins: [],
}
