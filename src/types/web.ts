export interface FirecrawlScrapeParams {
  url: string;
  formats?: ('markdown' | 'html' | 'rawHtml' | 'screenshot' | 'screenshot@fullPage' | 'links' | 'extract')[];
  // Add other potential scrape options if needed, like 'pageOptions'
}

export interface FirecrawlScrapeMetadata {
  title?: string;
  description?: string;
  language?: string;
  keywords?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
  ogLocaleAlternate?: string[];
  ogSiteName?: string;
  sourceURL?: string;
  statusCode?: number;
}

export interface FirecrawlScrapeSuccessData {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  screenshot?: string; // Assuming screenshot might be base64 or a URL
  links?: string[]; // Assuming links is an array of strings
  extract?: Record<string, unknown>; // Assuming extract is a flexible object
  metadata: FirecrawlScrapeMetadata;
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: FirecrawlScrapeSuccessData;
  error?: string; // Assuming potential error field
}

export interface FirecrawlSearchPageOptions {
  includeHtml?: boolean;
  onlyMainContent?: boolean;
  fetchPageContent?: boolean;
  // Consider adding screenshot options if available/needed
}

export interface FirecrawlSearchOptions {
  limit?: number;
  // Add other search options if documented/needed
}

export interface FirecrawlSearchParams {
  query: string;
  pageOptions?: FirecrawlSearchPageOptions;
  searchOptions?: FirecrawlSearchOptions;
}

// Define a more specific type for search results if the structure is known
// Using Record<string, unknown> for now based on the limited example
export interface FirecrawlSearchSuccessData extends Array<Record<string, unknown>> { }

export interface FirecrawlSearchResponse {
  success: boolean;
  data?: FirecrawlSearchSuccessData;
  error?: string; // Assuming potential error field
}
