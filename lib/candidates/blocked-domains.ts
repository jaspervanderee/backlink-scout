import type { CandidateRemovalReason } from "./types";

/** Top slot-wasters for Perplexity search_domain_filter (API max 20). */
export const PERPLEXITY_DOMAIN_DENYLIST = [
  "-pinterest.com",
  "-behance.net",
  "-dribbble.com",
  "-deviantart.com",
  "-youtube.com",
  "-instagram.com",
  "-facebook.com",
  "-tiktok.com",
  "-linkedin.com",
  "-reddit.com",
  "-medium.com",
  "-etsy.com",
  "-amazon.com",
  "-redbubble.com",
  "-zazzle.com",
  "-adobe.com",
  "-canva.com",
  "-freepik.com",
  "-shutterstock.com",
  "-wikipedia.org",
] as const;

type BlockedBrandEntry = {
  domains: string[];
  reason: CandidateRemovalReason;
};

const BLOCKED_BRANDS: BlockedBrandEntry[] = [
  // Specific subdomains first (first match wins)
  { domains: ["shop.tiktok.com"], reason: "blocked_marketplace" },
  { domains: ["store.fifa.com"], reason: "blocked_large_retail" },
  { domains: ["express.adobe.com"], reason: "blocked_template" },
  { domains: ["stock.adobe.com"], reason: "blocked_template" },
  { domains: ["create.adobe.com"], reason: "blocked_template" },
  { domains: ["adobe.com"], reason: "blocked_template" },

  // Platforms
  { domains: ["instagram.com"], reason: "blocked_platform" },
  { domains: ["facebook.com"], reason: "blocked_platform" },
  { domains: ["youtube.com"], reason: "blocked_platform" },
  { domains: ["tiktok.com"], reason: "blocked_platform" },
  { domains: ["pinterest.com"], reason: "blocked_platform" },
  { domains: ["behance.com", "behance.net"], reason: "blocked_platform" },
  { domains: ["linkedin.com"], reason: "blocked_platform" },
  { domains: ["twitter.com"], reason: "blocked_platform" },
  { domains: ["x.com"], reason: "blocked_platform" },
  { domains: ["reddit.com"], reason: "blocked_platform" },
  { domains: ["medium.com"], reason: "blocked_platform" },
  { domains: ["substack.com"], reason: "blocked_platform" },
  { domains: ["wikipedia.org"], reason: "blocked_platform" },
  { domains: ["tumblr.com"], reason: "blocked_platform" },
  { domains: ["flickr.com"], reason: "blocked_platform" },
  { domains: ["deviantart.com"], reason: "blocked_platform" },
  { domains: ["dribbble.com"], reason: "blocked_platform" },
  { domains: ["espn.com"], reason: "blocked_platform" },

  // Marketplaces and print-on-demand
  { domains: ["etsy.com", "etsy.co.uk"], reason: "blocked_marketplace" },
  { domains: ["alibaba.com"], reason: "blocked_marketplace" },
  { domains: ["aliexpress.com"], reason: "blocked_marketplace" },
  { domains: ["ebay.com", "ebay.co.uk"], reason: "blocked_marketplace" },
  { domains: ["amazon.com", "amazon.co.uk"], reason: "blocked_marketplace" },
  { domains: ["zazzle.com", "zazzle.co.uk"], reason: "blocked_marketplace" },
  { domains: ["redbubble.com"], reason: "blocked_marketplace" },
  { domains: ["society6.com"], reason: "blocked_marketplace" },
  { domains: ["cafepress.com"], reason: "blocked_marketplace" },
  { domains: ["spreadshirt.com"], reason: "blocked_marketplace" },
  { domains: ["spoonflower.com"], reason: "blocked_marketplace" },
  { domains: ["teespring.com"], reason: "blocked_marketplace" },
  { domains: ["bonfire.com"], reason: "blocked_marketplace" },
  { domains: ["displate.com"], reason: "blocked_marketplace" },
  { domains: ["wish.com"], reason: "blocked_marketplace" },
  { domains: ["mercari.com"], reason: "blocked_marketplace" },
  { domains: ["poshmark.com"], reason: "blocked_marketplace" },

  // Stock assets and vector libraries
  { domains: ["shutterstock.com"], reason: "blocked_stock_asset" },
  { domains: ["freepik.com"], reason: "blocked_stock_asset" },
  { domains: ["istockphoto.com"], reason: "blocked_stock_asset" },
  { domains: ["gettyimages.com"], reason: "blocked_stock_asset" },
  { domains: ["unsplash.com"], reason: "blocked_stock_asset" },
  { domains: ["vecteezy.com"], reason: "blocked_stock_asset" },
  { domains: ["vectorstock.com"], reason: "blocked_stock_asset" },
  { domains: ["depositphotos.com"], reason: "blocked_stock_asset" },
  { domains: ["dreamstime.com"], reason: "blocked_stock_asset" },
  { domains: ["123rf.com"], reason: "blocked_stock_asset" },
  { domains: ["pngtree.com"], reason: "blocked_stock_asset" },
  { domains: ["flaticon.com"], reason: "blocked_stock_asset" },
  { domains: ["storyblocks.com"], reason: "blocked_stock_asset" },
  { domains: ["pond5.com"], reason: "blocked_stock_asset" },
  { domains: ["rawpixel.com"], reason: "blocked_stock_asset" },
  { domains: ["vexels.com"], reason: "blocked_stock_asset" },
  { domains: ["bigstockphoto.com"], reason: "blocked_stock_asset" },
  { domains: ["stocksy.com"], reason: "blocked_stock_asset" },
  { domains: ["pixabay.com"], reason: "blocked_stock_asset" },
  { domains: ["pexels.com"], reason: "blocked_stock_asset" },
  { domains: ["iconscout.com"], reason: "blocked_stock_asset" },
  { domains: ["iconfinder.com"], reason: "blocked_stock_asset" },
  { domains: ["alamy.com"], reason: "blocked_stock_asset" },

  // Templates and design asset marketplaces
  { domains: ["canva.com"], reason: "blocked_template" },
  { domains: ["creativemarket.com"], reason: "blocked_template" },
  { domains: ["envato.com"], reason: "blocked_template" },
  { domains: ["themeforest.net"], reason: "blocked_template" },
  { domains: ["graphicriver.net"], reason: "blocked_template" },
  { domains: ["videohive.net"], reason: "blocked_template" },
  { domains: ["motionarray.com"], reason: "blocked_template" },
  { domains: ["designbundles.net"], reason: "blocked_template" },
  { domains: ["template.net"], reason: "blocked_template" },
  { domains: ["templatelab.com"], reason: "blocked_template" },
  { domains: ["smiletemplates.com"], reason: "blocked_template" },
  { domains: ["presentermedia.com"], reason: "blocked_template" },

  // Large retail
  { domains: ["target.com"], reason: "blocked_large_retail" },
  { domains: ["walmart.com"], reason: "blocked_large_retail" },
  { domains: ["bestbuy.com"], reason: "blocked_large_retail" },
  { domains: ["homedepot.com"], reason: "blocked_large_retail" },
  { domains: ["lowes.com"], reason: "blocked_large_retail" },
  { domains: ["costco.com"], reason: "blocked_large_retail" },
  { domains: ["ikea.com", "ikea.co.uk"], reason: "blocked_large_retail" },
  { domains: ["wayfair.com", "wayfair.co.uk"], reason: "blocked_large_retail" },
  { domains: ["macys.com"], reason: "blocked_large_retail" },
  { domains: ["nordstrom.com"], reason: "blocked_large_retail" },
  { domains: ["kohls.com"], reason: "blocked_large_retail" },
];

function hostnameMatchesBlockedDomain(
  hostname: string,
  blockedDomain: string,
): boolean {
  return (
    hostname === blockedDomain || hostname.endsWith(`.${ blockedDomain }`)
  );
}

export function getBlockedDomainReason(
  hostname: string,
): CandidateRemovalReason | null {
  for (const entry of BLOCKED_BRANDS) {
    for (const domain of entry.domains) {
      if (hostnameMatchesBlockedDomain(hostname, domain)) {
        return entry.reason;
      }
    }
  }

  return null;
}

export function formatRemovalReason(reason: CandidateRemovalReason): string {
  switch (reason) {
    case "invalid_domain":
      return "Invalid domain";
    case "blocked_platform":
      return "Blocked platform";
    case "blocked_marketplace":
      return "Blocked marketplace";
    case "blocked_stock_asset":
      return "Blocked stock asset";
    case "blocked_template":
      return "Blocked template";
    case "blocked_large_retail":
      return "Blocked large retail";
  }
}
