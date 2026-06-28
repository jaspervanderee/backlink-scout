import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPageLinks, isInternalHostname } from "./prescan-link-probe";

describe("isInternalHostname", () => {
  it("treats subdomains as internal", () => {
    assert.equal(isInternalHostname("www.example.com", "example.com"), true);
    assert.equal(isInternalHostname("artist.example.org", "example.com"), false);
  });
});

describe("classifyPageLinks", () => {
  it("ignores social links when checking self-promotion", () => {
    const counts = classifyPageLinks(
      [
        { href: "https://example.com/a", text: "Item A" },
        { href: "https://example.com/b", text: "Item B" },
        { href: "https://example.com/c", text: "Item C" },
        { href: "https://instagram.com/example", text: "Instagram" },
      ],
      "https://example.com/post",
      "example.com",
    );

    assert.equal(counts.externalLinkCount, 0);
    assert.equal(counts.featuredLinksAllInternal, true);
  });
});
