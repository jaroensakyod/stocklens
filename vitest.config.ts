import { defineConfig } from "vitest/config";
import path from "path";

// ทดสอบระดับ logic (node env ล้วน — ไม่ต้อง jsdom ในรอบแรก)
// ใช้ alias @ ให้ import "@/lib/..." เหมือนตอน Next build
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
