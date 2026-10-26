export type PerplexitySearchPage = {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
  lastUpdated: string | null;
};

export type PerplexitySearchResponse = {
  id: string;
  results: PerplexitySearchPage[];
  serverTime: string | null;
};
