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
          border: "var(--app-border)",
          text: "var(--app-text)",
          muted: "var(--app-muted)",
          accent: "var(--app-accent)",
          accentSoft: "var(--app-accent-soft)",
          success: "var(--app-success)",
          successSoft: "var(--app-success-soft)",
          warning: "var(--app-warning)",
          warningSoft: "var(--app-warning-soft)",
          danger: "var(--app-danger)",
          dangerSoft: "var(--app-danger-soft)",
          info: "var(--app-info)",
          infoSoft: "var(--app-info-soft)",
        },
      },
      borderRadius: {
        sm: "var(--app-radius-sm)",
        md: "var(--app-radius-md)",
        lg: "var(--app-radius-lg)",
        xl: "var(--app-radius-xl)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.06)",
        card: "0 2px 8px rgba(15, 23, 42, 0.08)",
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
