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
          brown: "#2A1610",
          brown900: "#1C0D08",
          brown700: "#44261C",
          gold: "#FFB500",
          gold600: "#E0A000",
          green: "#0F9D58",
        },
        primary: "#180703",
        "primary-container": "#2E1812",
        "primary-fixed": "#ffdbd1",
        "on-primary": "#ffffff",
        "on-primary-container": "#EAE0DA",
        secondary: "#7d5700",
        "secondary-container": "#fdb300",
        "secondary-fixed": "#ffdeab",
        "secondary-fixed-dim": "#ffba30",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#694900",
        surface: "#FAF7F4",
        "surface-container": "#feeae4",
        "surface-container-low": "#fff1ed",
        "surface-container-high": "#f8e4de",
        "surface-container-highest": "#f2ded9",
        "surface-container-lowest": "#ffffff",
        outline: "#9A8A83",
        "outline-variant": "#d4c3be",
        "on-surface": "#1C0F0B",
        "on-surface-variant": "#EAE0DA",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        error: "#ba1a1a",
        canvas: "#FFFFFF",
        surfaceAlt: "#F3ECE6",
        borderClean: "#DDD2CA",
        borderStrong: "#B8ACA3",
        textMain: "#1C0F0B",
        textMuted: "#4E3E37",
        textInverse: "#FFF9F0",
        status: {
          ok: "#0F9D58",
          watch: "#FFB500",
          risk: "#DB4437",
          idle: "#70767C",
        }
      },
      spacing: {
        "header-height": "64px",
        "sidebar-width": "240px",
        "max-content-width": "1440px"
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Plus Jakarta Sans"', 'sans-serif'],
        eyebrow: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        ui: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
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



