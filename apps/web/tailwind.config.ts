import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        surface: "#FFFFFF",
        "surface-2": "#F1F4F8",
        "surface-3": "#E8EDF4",
        border: "#DDE3EC",
        "border-strong": "#B8C4D4",
        brand: "#1D4ED8",
        "brand-light": "#EFF6FF",
        "brand-dark": "#1E3A8A",
        success: "#059669",
        "success-bg": "#ECFDF5",
        warning: "#D97706",
        "warning-bg": "#FFFBEB",
        danger: "#DC2626",
        "danger-bg": "#FEF2F2",
        purple: "#7C3AED",
        "purple-bg": "#F5F3FF",
        text: "#0F172A",
        "text-2": "#475569",
        "text-3": "#94A3B8",
        "text-inv": "#FFFFFF",
      },
      fontFamily: {
        display: [
          "var(--font-plus-jakarta)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        body: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15,23,42,0.06)",
        sm: "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)",
        md: "0 4px 6px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.04)",
        lg: "0 10px 15px rgba(15,23,42,0.08), 0 4px 6px rgba(15,23,42,0.04)",
        modal:
          "0 20px 60px rgba(15,23,42,0.15), 0 8px 20px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
