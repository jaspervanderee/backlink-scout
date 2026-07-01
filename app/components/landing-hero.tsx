"use client";

import { useState, type FormEvent } from "react";

type LandingHeroProps = {
  headingClassName: string;
};

const exampleURL = "https://example.com";

export function LandingHero({ headingClassName }: LandingHeroProps) {
  const [url, setUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="w-full max-w-3xl">
      <h1
        className={`${headingClassName} mb-6 text-[2.5rem] leading-[1.1] font-normal text-[#381d1d] sm:mb-8 sm:text-5xl md:text-6xl`}
      >
        Find backlinks
        <br />
        suited for you, fast
      </h1>

      <form onSubmit={handleSubmit} className="flex w-full flex-col items-start">
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onFocus={(event) => {
            event.currentTarget.placeholder = "";
          }}
          onBlur={(event) => {
            if (!event.currentTarget.value) {
              event.currentTarget.placeholder = exampleURL;
            }
          }}
          placeholder={exampleURL}
          aria-label="Project URL"
          className="h-14 w-full rounded-full bg-white px-6 text-base text-black shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.08)] outline-none placeholder:text-black/35 focus:ring-2 focus:ring-[#381d1d]/15 sm:h-16 sm:px-8 sm:text-lg"
        />

        <button
          type="submit"
          className="mt-10 bg-[#381d1d] px-4 py-2 text-sm text-white sm:mt-12"
        >
          Analyze project
        </button>
      </form>
    </div>
  );
}
