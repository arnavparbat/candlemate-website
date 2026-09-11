import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#2d1b16", cream: "#fff8ed", clay: "#ae633e", gold: "#c9934c", moss: "#67705a" }, fontFamily: { serif: ["Georgia", "serif"] }, boxShadow: { warm: "0 18px 60px rgba(68,35,20,.13)" } } }, plugins: [] } satisfies Config;
