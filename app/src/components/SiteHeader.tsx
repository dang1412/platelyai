// Header chung: logo (link về trang chủ) + nút auth. Dùng ở trang chính và các trang con.
// `subtitle` tuỳ chọn (trang chủ truyền tagline).

import Image from "next/image";
import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export default function SiteHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="relative mb-8 text-center">
      <div className="absolute right-0 top-0">
        <AuthButton />
      </div>
      <h1 className="flex justify-center">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="platelyai"
            width={713}
            height={233}
            priority
            className="h-16 w-auto"
          />
        </Link>
      </h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
