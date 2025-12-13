import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system colors - will be enhanced with theme-specific colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // TCG-specific colors
        pokemon: {
          grass: "#78C850",
          fire: "#F08030",
          water: "#6890F0",
          electric: "#F8D030",
          psychic: "#F85888",
          fighting: "#C03028",
          darkness: "#705848",
          metal: "#B8B8D0",
          fairy: "#EE99AC",
          dragon: "#7038F8",
          colorless: "#A8A878",
        },
        lorcana: {
          amber: "#F59E42",
          amethyst: "#9D5DB8",
          emerald: "#00A85C",
          ruby: "#E52839",
          sapphire: "#0076B5",
          steel: "#7C8A99",
        },
        onepiece: {
          red: "#E63946",
          blue: "#1D3557",
          green: "#2A9D8F",
          purple: "#9D4EDD",
          black: "#212529",
          yellow: "#F4A261",
          pink: "#FF6B9D",
        },
        riftbound: {
          void: "#6B21A8",
          arcane: "#3B82F6",
          nature: "#10B981",
          fire: "#EF4444",
          light: "#FBBF24",
          shadow: "#1F2937",
        },
        naruto: {
          fire: "#FF4500",
          wind: "#38BDF8",
          lightning: "#FBBF24",
          earth: "#92400E",
          water: "#0EA5E9",
          void: "#7C3AED",
        },
        starwars: {
          gold: "#FFE81F",
          empire: "#1A1A1A",
          rebel: "#FF4500",
          jedi: "#3B82F6",
          sith: "#DC2626",
          vigilance: "#3B82F6",
          command: "#22C55E",
          aggression: "#EF4444",
          cunning: "#F59E0B",
          villainy: "#6B21A8",
          heroism: "#0EA5E9",
        },
        // Custom cursor colors
        cursor: {
          primary: "var(--cursor-primary)",
          alt: "var(--cursor-primary-alt)",
          light: "var(--cursor-primary-light)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
