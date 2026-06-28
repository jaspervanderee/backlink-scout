import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPageLinks,
} from "./prescan-link-probe";
import {
  demoteEntryForSelfPromotionalLinks,
  evaluatePrescan,
} from "./prescan";
import type { KeptDomainCandidate } from "./types";
import type { SearchPlan } from "@/lib/search-plan/types";

function buildSearchPlan(): SearchPlan {
  return {
    metadata: {
      projectCategory: "Football World Cup poster art print",
      targetAudiences: ["football fans", "poster collectors", "design enthusiasts"],
      searchLanguage: "en",
      searchCountryRegion: null,
      excludedDomains: [],
      assumptions: [],
    },
    opportunityHypotheses: [],
    queries: [
      {
        id: "q1",
        queryText: "football culture magazine poster feature",
        hypothesisUsed: "h1",
        priority: "high",
        rationale: "r",
        expectedPageType: "feature",
        riskNote: "n",
        recommendedResultCount: 5,
      },
    ],
  };
}

function buildCandidate(
  overrides: Partial<KeptDomainCandidate> & Pick<KeptDomainCandidate, "domain">,
): KeptDomainCandidate {
  const representativeUrl =
    overrides.representativeUrl ?? `https://${ overrides.domain }/article`;

  return {
    domain: overrides.domain,
    representativeUrl,
    representativeTitle: overrides.representativeTitle ?? "Untitled",
    sourceQueryIds: overrides.sourceQueryIds ?? ["q1"],
    sourceHits: overrides.sourceHits ?? [
      {
        queryId: "q1",
        queryOrder: 0,
        resultRank: 0,
        url: representativeUrl,
        normalizedUrl: representativeUrl,
        title: overrides.representativeTitle ?? "Untitled",
        snippet: "Default snippet",
        date: null,
        lastUpdated: null,
      },
    ],
  };
}

describe("evaluatePrescan", () => {
  const searchPlan = buildSearchPlan();

  it("skips 99designs marketplace domain", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "99designs.com",
        representativeTitle: "World Cup poster design contest",
        representativeUrl: "https://99designs.com/contests",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 0,
            url: "https://99designs.com/contests",
            normalizedUrl: "https://99designs.com/contests",
            title: "World Cup poster design contest",
            snippet: "Hire designers for your football poster contest",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "skip");
    assert.equal(entry.skipCategory, "marketplace");
  });

  it("skips ace.aaa.com shop path", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "ace.aaa.com",
        representativeUrl: "https://ace.aaa.com/shop/posters",
        representativeTitle: "Football posters",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 0,
            url: "https://ace.aaa.com/shop/posters",
            normalizedUrl: "https://ace.aaa.com/shop/posters",
            title: "Football posters",
            snippet: "Buy football poster prints for fans",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "skip");
    assert.equal(entry.skipCategory, "own_catalog_or_ecommerce");
  });

  it("does not skip editorial publication when snippet only mentions shop", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "creativebloq.com",
        representativeUrl:
          "https://www.creativebloq.com/design/poster-design/world-cup-posters",
        representativeTitle: "World Cup poster design feature",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 1,
            url: "https://www.creativebloq.com/design/poster-design/world-cup-posters",
            normalizedUrl:
              "https://www.creativebloq.com/design/poster-design/world-cup-posters",
            title: "World Cup poster design feature",
            snippet: "Our gift guide to shop the best football poster art",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.notEqual(entry.skipCategory, "own_catalog_or_ecommerce");
    assert.equal(entry.decision, "investigate");
  });

  it("skips pdf document host from title tag", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "example.edu",
        representativeUrl: "https://example.edu/files/poster-guide",
        representativeTitle: "[PDF] Poster guide",
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "skip");
    assert.equal(entry.skipCategory, "document_host");
  });

  it("skips bitstream repository URLs", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "repository.example.edu",
        representativeUrl:
          "https://repository.example.edu/bitstream/handle/123/poster.pdf",
        representativeTitle: "Poster archive",
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "skip");
    assert.equal(entry.skipCategory, "document_host");
  });

  it("does not skip .edu without school cues", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "news.example.edu",
        representativeUrl: "https://news.example.edu/football-poster-feature",
        representativeTitle: "Football poster art feature",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 0,
            url: "https://news.example.edu/football-poster-feature",
            normalizedUrl: "https://news.example.edu/football-poster-feature",
            title: "Football poster art feature",
            snippet: "Magazine feature on World Cup poster design for football fans",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.notEqual(entry.skipCategory, "official_or_licensing_risk");
    assert.equal(entry.decision, "investigate");
  });

  it("investigates design magazine feature with topic overlap", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "itsnicethat.com",
        representativeUrl: "https://www.itsnicethat.com/articles/poster-feature",
        representativeTitle: "Poster art feature",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 0,
            url: "https://www.itsnicethat.com/articles/poster-feature",
            normalizedUrl: "https://www.itsnicethat.com/articles/poster-feature",
            title: "Poster art feature",
            snippet:
              "Magazine feature on football World Cup poster design for fans and collectors",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "investigate");
    assert.equal(entry.skipCategory, null);
  });

  it("investigates football culture editorial roundup", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "culturedfootball.com",
        representativeUrl: "https://culturedfootball.com/roundup/posters",
        representativeTitle: "Football poster roundup",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 2,
            url: "https://culturedfootball.com/roundup/posters",
            normalizedUrl: "https://culturedfootball.com/roundup/posters",
            title: "Football poster roundup",
            snippet: "Editorial roundup of World Cup poster art for football fans",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "investigate");
  });

  it("demotes blog-only surface with topic overlap to maybe", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "brandblog.com",
        representativeUrl: "https://brandblog.com/blog/world-cup-poster-ideas",
        representativeTitle: "World Cup poster ideas",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 0,
            url: "https://brandblog.com/blog/world-cup-poster-ideas",
            normalizedUrl: "https://brandblog.com/blog/world-cup-poster-ideas",
            title: "World Cup poster ideas",
            snippet: "Blog article with football poster inspiration",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "maybe");
    assert.ok(entry.reason.includes("blog"));
  });

  it("demotes likely self-promotional roundup to maybe", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "ownbrand.com",
        representativeUrl: "https://ownbrand.com/blog/best-football-posters-roundup",
        representativeTitle: "Our favorite football poster roundup",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 1,
            url: "https://ownbrand.com/blog/best-football-posters-roundup",
            normalizedUrl: "https://ownbrand.com/blog/best-football-posters-roundup",
            title: "Our favorite football poster roundup",
            snippet: "A blog roundup of football poster art we love",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "maybe");
    assert.equal(entry.maybeCategory, "self_promotional_content_marketing");
  });

  it("investigates creativebloq with weak snippet but strong publisher path", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "creativebloq.com",
        representativeUrl:
          "https://www.creativebloq.com/design/poster-design/these-slick-fifa-world-cup-posters-are-a-work-of-art",
        representativeTitle: "Poster design",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 3,
            url: "https://www.creativebloq.com/design/poster-design/these-slick-fifa-world-cup-posters-are-a-work-of-art",
            normalizedUrl:
              "https://www.creativebloq.com/design/poster-design/these-slick-fifa-world-cup-posters-are-a-work-of-art",
            title: "Poster design",
            snippet: "The latest in graphic design",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "investigate");
  });

  it("investigates when snippet links to outside project", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "blog.example.com",
        representativeUrl: "https://blog.example.com/guide/poster-roundup",
        representativeTitle: "Poster roundup",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 2,
            url: "https://blog.example.com/guide/poster-roundup",
            normalizedUrl: "https://blog.example.com/guide/poster-roundup",
            title: "Poster roundup",
            snippet:
              "Guide featuring https://artist.example.com/world-cup-poster for football fans",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "investigate");
  });

  it("skips unrelated article with accidental keyword overlap", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "techcrunch.com",
        representativeUrl: "https://techcrunch.com/saas-funding",
        representativeTitle: "Startup raises funding",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 4,
            url: "https://techcrunch.com/saas-funding",
            normalizedUrl: "https://techcrunch.com/saas-funding",
            title: "Startup raises funding",
            snippet: "B2B software company announces new venture round",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "skip");
    assert.equal(entry.skipCategory, "unrelated_accidental_overlap");
  });

  it("skips award page", () => {
    const entry = evaluatePrescan(
      buildCandidate({
        domain: "graphis.com",
        representativeUrl: "https://www.graphis.com/awards",
        representativeTitle: "Design award winners",
        sourceHits: [
          {
            queryId: "q1",
            queryOrder: 0,
            resultRank: 1,
            url: "https://www.graphis.com/awards",
            normalizedUrl: "https://www.graphis.com/awards",
            title: "Design award winners",
            snippet: "Call for entries to the annual design award competition",
            date: null,
            lastUpdated: null,
          },
        ],
      }),
      searchPlan,
    );

    assert.equal(entry.decision, "skip");
    assert.equal(entry.skipCategory, "award_or_paid_submission");
  });
});

describe("demoteEntryForSelfPromotionalLinks", () => {
  it("demotes investigate entries with only internal featured links", () => {
    const candidate = buildCandidate({ domain: "example.com" });

    const demoted = demoteEntryForSelfPromotionalLinks(
      {
        candidate,
        decision: "investigate",
        reason: "test",
        skipCategory: null,
        maybeCategory: null,
      },
      0,
      5,
    );

    assert.equal(demoted.decision, "maybe");
    assert.equal(demoted.maybeCategory, "self_promotional_content_marketing");
  });
});

describe("classifyPageLinks", () => {
  it("flags pages where substantive links are all internal", () => {
    const counts = classifyPageLinks(
      [
        { href: "https://example.com/posters/a", text: "Poster A" },
        { href: "https://example.com/posters/b", text: "Poster B" },
        { href: "https://example.com/posters/c", text: "Poster C" },
        { href: "https://twitter.com/example", text: "Share" },
      ],
      "https://example.com/roundup",
      "example.com",
    );

    assert.equal(counts.externalLinkCount, 0);
    assert.equal(counts.featuredLinksAllInternal, true);
  });

  it("does not flag pages with external substantive links", () => {
    const counts = classifyPageLinks(
      [
        { href: "https://example.com/posters/a", text: "Poster A" },
        { href: "https://artist.example.org/project", text: "Artist project" },
        { href: "https://example.com/posters/c", text: "Poster C" },
      ],
      "https://example.com/roundup",
      "example.com",
    );

    assert.equal(counts.externalLinkCount, 1);
    assert.equal(counts.featuredLinksAllInternal, false);
  });
});
