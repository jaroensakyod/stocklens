// ===== โลโก้ StockLens — ตรงกับ favicon ที่เบราว์เซอร์ใช้ (public/icons/icon-*.png จาก gen-icons.mjs) =====
// ดีไซน์: พื้นเข้ม + แท่งกราฟเขียว 3 แท่งไล่ระดับ + แดง 1 แท่ง + เส้นฐาน — ใช้ตำแหน่ง/สีเดียวกับสคริปต์สร้างไอคอนเป๊ะ
export default function LogoMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={"shrink-0 " + className}
    >
      <rect width="512" height="512" rx="100" fill="#0B0E14" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="6" />
      <rect x="96" y="300" width="48" height="116" fill="#2DD4BF" />
      <rect x="196" y="240" width="48" height="176" fill="#2DD4BF" />
      <rect x="296" y="160" width="48" height="256" fill="#2DD4BF" />
      <rect x="396" y="220" width="48" height="150" fill="#FB7185" />
      <rect x="96" y="300" width="48" height="10" fill="#FFFFFF" opacity="0.16" />
      <rect x="196" y="240" width="48" height="10" fill="#FFFFFF" opacity="0.16" />
      <rect x="296" y="160" width="48" height="10" fill="#FFFFFF" opacity="0.16" />
      <rect x="396" y="220" width="48" height="10" fill="#FFFFFF" opacity="0.16" />
      <rect x="80" y="430" width="352" height="6" fill="#FFFFFF" opacity="0.24" />
    </svg>
  );
}
