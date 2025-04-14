import { webSearchQueriesSchema } from '@/ai/schemas/web.schema';
import type {
  FirecrawlScrapeParams,
  FirecrawlScrapeResponse,
  FirecrawlScrapeSuccessData,
  FirecrawlSearchParams,
} from '../../types/web'; // Import the types
import { resolve } from '../agent/ai.service';
import { webSearchQueriesPrompt } from '@/ai/prompts/web/generate-queries';

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

interface WebSearchResult {
  url: string;
  title: string;
  description: string;
}
/**
 * Performs a scrape operation using the Firecrawl API.
 * @param params - The parameters for the scrape request.
 * @param apiKey - The Firecrawl API key.
 * @returns The scraped data.
 * @throws {Error} If the API key is missing, the request fails, or the API returns an error.
 */
export const scrape = async (
  params: FirecrawlScrapeParams, // Use imported type
): Promise<FirecrawlScrapeSuccessData> => { // Use imported type
  if (!FIRECRAWL_API_KEY) {
    throw new Error('Firecrawl API key is required.');
  }

  const response = await fetch(`${FIRECRAWL_BASE_URL}/v1/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl API request failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as FirecrawlScrapeResponse; // Use imported type

  if (!result.success || !result.data) {
    throw new Error(`Firecrawl API scrape error: ${result.error || 'Unknown error'}`);
  }

  return result.data;
};

/**
 * Performs a search operation using the Firecrawl API.
 * @param params - The parameters for the search request.
 * @param apiKey - The Firecrawl API key.
 * @returns The search results.
 * @throws {Error} If the API key is missing, the request fails, or the API returns an error.
 */
export const search = async (
  params: FirecrawlSearchParams, // Use imported type
): Promise<WebSearchResult[]> => { // Use imported type
  if (!FIRECRAWL_API_KEY) {
    throw new Error('Firecrawl API key is required.');
  }

  // Default values similar to the Rust example
  const body = {
    query: params.query,
    pageOptions: {
      includeHtml: params.pageOptions?.includeHtml ?? false,
      onlyMainContent: params.pageOptions?.onlyMainContent ?? false,
      fetchPageContent: params.pageOptions?.fetchPageContent ?? false,
    },
    searchOptions: {
      limit: params.searchOptions?.limit ?? 3,
    },
  };


  const response = await fetch(`${FIRECRAWL_BASE_URL}/v0/search`, { // Note: Using v0 based on Rust example
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });


  if (!response.ok) {
      let errorBody = 'Could not parse error response';
      try {
          errorBody = await response.text();
      } catch (e) {
          // Ignore parsing error
      }
    throw new Error(`Firecrawl API request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`);
  }

  // Assuming the search endpoint might return the data directly or wrapped in a success object.
  // Adjusting based on common API patterns and the Rust example omitting the 'success' field check.
  // Let's assume it returns the array directly on success.
  // If the actual API wraps it like { success: true, data: [...] }, this needs adjustment.
  const result = (await response.json()); // Assuming direct data array for search

  // Add validation if the structure is known or if it follows the { success: boolean, data: [...] } pattern
  // Example if wrapped:
  // const result = (await response.json()) as FirecrawlSearchResponse; // Use imported type if needed here
  // if (!result.success || !result.data) {
  //   throw new Error(`Firecrawl API search error: ${result.error || 'Unknown error'}`);
  // }
  // return result.data;

  // For now, assuming direct array return based on how Rust example uses it:
   if (!Array.isArray(result)) {
       // Attempt to check for a wrapped structure if it's not an array
       if (result && typeof result === 'object' && 'success' in result && 'data' in result && result.success && Array.isArray(result.data)) {
           return result.data; // Use imported type
       }
        throw new Error(`Firecrawl API search returned unexpected data format: ${JSON.stringify(result)}`);
   }


  return result; // Use imported type
}; 

export const generateWebSearchQueries = async (query: string, numQueries: number = 5): Promise<string[]> => {
  const { queries } = await resolve({ 
    messages: [{role: 'user', content: query + `\n\nGenerate no more than ${numQueries} web search queries.`}],
    system: webSearchQueriesPrompt  , 
    schema: webSearchQueriesSchema,
  });

  return queries;
}

export const selectWebResults = async (searchResults: WebSearchResult[]): Promise<WebSearchResult[]> => {
  // TODO: Implement the logic to select the best web results, for now we just return the first one
  return [searchResults[0]];
}