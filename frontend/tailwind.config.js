/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "ups-brown": "#351C15",
        "ups-gold": "#FFB500",
        "ups-green": "#0F9D58",
        "ups-red": "#DB4437",
        brand: {
          brown: "#351C15",
          brown900: "#24120D",
          brown700: "#4A2B21",
          gold: "#FFB500",
          gold600: "#E0A000",
          green: "#0F9D58",
        },
        primary: "#1b0703",
        "primary-container": "#351c15",
        "primary-fixed": "#ffdbd1",
        "on-primary": "#ffffff",
        "on-primary-container": "#a78177",
        secondary: "#7d5700",
        "secondary-container": "#fdb300",
        "secondary-fixed": "#ffdeab",
        "secondary-fixed-dim": "#ffba30",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#694900",
        surface: "#fff8f6",
        "surface-container": "#feeae4",
        "surface-container-low": "#fff1ed",
        "surface-container-high": "#f8e4de",
        "surface-container-highest": "#f2ded9",
        "surface-container-lowest": "#ffffff",
        outline: "#827470",
        "outline-variant": "#d4c3be",
        "on-surface": "#241916",
        "on-surface-variant": "#504441",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        error: "#ba1a1a",
        canvas: "#FFFFFF",
        surfaceAlt: "#F2EEEA",
        borderClean: "#E3DCD6",
        borderStrong: "#C9BFB6",
        textMain: "#1F1512",
        textMuted: "#6B5D55",
        textInverse: "#FFF9F0",
        status: {
          ok: "#0F9D58",
          watch: "#FFB500",
          risk: "#DB4437",
          idle: "#8C9196",
        }
      },
      spacing: {
        "header-height": "64px",
        "sidebar-width": "240px",
        "max-content-width": "1440px"
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        eyebrow: ['"Barlow Condensed"', 'sans-serif'],
        ui: ['Barlow', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        'data-tabular': ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        card: '8px',
        btn: '6px',
        badge: '4px',
        input: '6px',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem'
      }
    },
  },
  plugins: [],
}

