import Image from "next/image";
import localFont from "next/font/local";
import { LandingHero } from "@/app/components/landing-hero";

const berlingskeSerif = localFont({
  src: "./fonts/berlingske-serif-bold.otf",
  variable: "--font-berlingske-serif",
});

export default function Home() {
  return (
    <main className={`${berlingskeSerif.variable} flex flex-col bg-white`}>
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <svg
            className="absolute -bottom-[76%] left-1/2 h-[160%] w-[340vw] max-w-none origin-[50%_100%] -translate-x-[44%] rotate-[-18deg]"
            viewBox="0 0 100 98.75"
            preserveAspectRatio="xMidYMax meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#f9f3ed"
              fillRule="evenodd"
              d="M98.94,14.01C70.45-5.03,27.01-4.31,1.09,14.01c-6.26,33.02,15.08,74.96,48.92,84.74,33.2-7.97,55.18-54.61,48.92-84.74h0Z"
            />
          </svg>
        </div>

        <header className="absolute top-0 left-0 z-10 px-6 pt-6 sm:px-10 sm:pt-8">
          <Image
            src="/backlink-scout-logo.svg"
            alt="Backlink Scout"
            width={160}
            height={59}
            priority
            className="h-10 w-auto sm:h-12"
          />
        </header>

        <div className="relative z-10 flex min-h-screen flex-col items-center px-6 pt-32 sm:pt-40 md:pt-48">
          <LandingHero headingClassName={berlingskeSerif.className} />
        </div>
      </section>

      <Image
        src="/backlink-scout-image.webp"
        alt="Scout searching for backlink opportunities"
        width={3200}
        height={2000}
        unoptimized
        className="block h-auto w-full"
      />
    </main>
  );
}
