import type { Config } from "tailwindcss";

/**
 * Design language: institutional / "editorial finance" — near-black ink on
 * warm ivory, a single deep-navy accent, hairline rules, muted status
 * colours (never neon), serif display + tight sans UI. Inspired by the
 * restraint of large alternative-asset-manager brand systems.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F6F2", // page background
        paper: "#FFFFFF", // cards / surfaces
        ink: {
          DEFAULT: "#1A1A18", // headlines + body
          soft: "#565651", // secondary text
          faint: "#8B8B84", // tertiary / captions
        },
        line: {
          DEFAULT: "#E7E5DE", // hairline borders
          strong: "#D4D2C8",
        },
        accent: {
          DEFAULT: "#1B2A44", // primary buttons, active nav
          700: "#152135", // hover / pressed
        },
        link: "#2C4A82",
        flag: {
          green: "#3F7350",
          amber: "#9E7727",
          red: "#9C3D2E",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "Cambria", "serif"],
      },
      letterSpacing: {
        eyebrow: "0.12em",
      },
      maxWidth: {
        shell: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
