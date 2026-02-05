import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        app: {
          bg: "var(--app-bg)",
          surface: "var(--app-surface)",
          surface2: "var(--app-surface-2)",
          "surface-2": "var(--app-surface-2)",
          surface3: "var(--app-surface-3)",
          "surface-3": "var(--app-surface-3)",
          border: "var(--app-border)",
          borderStrong: "var(--app-border-strong)",
          "border-strong": "var(--app-border-strong)",
          text: "var(--app-text)",
          textStrong: "var(--app-text-strong)",
          "text-strong": "var(--app-text-strong)",
          muted: "var(--app-muted)",
          accent: "var(--app-accent)",
          accentSoft: "var(--app-accent-soft)",
          "accent-soft": "var(--app-accent-soft)",
          success: "var(--app-success)",
          successSoft: "var(--app-success-soft)",
          "success-soft": "var(--app-success-soft)",
          warning: "var(--app-warning)",
          warningSoft: "var(--app-warning-soft)",
          "warning-soft": "var(--app-warning-soft)",
          danger: "var(--app-danger)",
          dangerSoft: "var(--app-danger-soft)",
          "danger-soft": "var(--app-danger-soft)",
          info: "var(--app-info)",
          infoSoft: "var(--app-info-soft)",
          "info-soft": "var(--app-info-soft)",
        },
      },
      borderRadius: {
        sm: "var(--app-radius-sm)",
        md: "var(--app-radius-md)",
        lg: "var(--app-radius-lg)",
        xl: "var(--app-radius-xl)",
      },
      boxShadow: {
        soft: "var(--app-shadow-soft)",
        card: "var(--app-shadow-card)",
        pop: "var(--app-shadow-pop)",
      },
      fontSize: {
        h1: ["1.75rem", { lineHeight: "2.2rem", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        h3: ["1.25rem", { lineHeight: "1.7rem", fontWeight: "600" }],
        body: ["0.95rem", { lineHeight: "1.55rem" }],
        label: ["0.8rem", { lineHeight: "1.1rem", fontWeight: "500" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};
export default config;
