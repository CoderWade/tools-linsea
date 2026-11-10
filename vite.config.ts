import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Exchange Rate tool reads from four local relays under server/. None of the
// upstreams (UnionPay, Mastercard, Visa, and the Google/Sina/XE trio) send CORS
// headers, so the browser reaches them through these proxy rules.
const UNIONPAY_TARGET = process.env.UNIONPAY_PROXY_TARGET || "http://127.0.0.1:8788";
const SOURCE_TARGET = process.env.SOURCE_PROXY_TARGET || "http://127.0.0.1:8789";
const VISA_TARGET = process.env.VISA_PROXY_TARGET || "http://127.0.0.1:8790";
const MASTERCARD_TARGET = process.env.MC_PROXY_TARGET || "http://127.0.0.1:8791";

const relay = {
  "/api/unionpay": { target: UNIONPAY_TARGET, changeOrigin: true },
  "/api/sources": { target: SOURCE_TARGET, changeOrigin: true },
  "/api/visa": { target: VISA_TARGET, changeOrigin: true },
  "/api/mastercard": { target: MASTERCARD_TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { proxy: relay },
  preview: { proxy: relay },
});
