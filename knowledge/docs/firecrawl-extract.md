Extract
Extract structured data from pages using LLMs

​
Introducing /extract (Open Beta)
The /extract endpoint simplifies collecting structured data from any number of URLs or entire domains. Provide a list of URLs, optionally with wildcards (e.g., example.com/*), and a prompt or schema describing the information you want. Firecrawl handles the details of crawling, parsing, and collating large or small datasets.

​
Using /extract
You can extract structured data from one or multiple URLs, including wildcards:

Single Page
Example: https://firecrawl.dev/some-page
Multiple Pages / Full Domain
Example: https://firecrawl.dev/*
When you use /*, Firecrawl will automatically crawl and parse all URLs it can discover in that domain, then extract the requested data. This feature is experimental; email help@firecrawl.dev if you have issues.

​
Example Usage

Python

Node

cURL

Copy
import FirecrawlApp from "@mendable/firecrawl-js";
import { z } from "zod";

const app = new FirecrawlApp({
  apiKey: "fc-YOUR_API_KEY"
});

// Define schema to extract contents into
const schema = z.object({
  company_mission: z.string(),
  supports_sso: z.boolean(),
  is_open_source: z.boolean(),
  is_in_yc: z.boolean()
});

const scrapeResult = await app.extract([
  'https://docs.firecrawl.dev/*', 
  'https://firecrawl.dev/', 
  'https://www.ycombinator.com/companies/'
], {
  prompt: "Extract the company mission, whether it supports SSO, whether it is open source, and whether it is in Y Combinator from the page.",
  schema: schema
});

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult.data);
Key Parameters:

urls: An array of one or more URLs. Supports wildcards (/*) for broader crawling.
prompt (Optional unless no schema): A natural language prompt describing the data you want or specifying how you want that data structured.
schema (Optional unless no prompt): A more rigid structure if you already know the JSON layout.
enableWebSearch (Optional): When true, extraction can follow links outside the specified domain.
See API Reference for more details.

​
Response (sdks)
JSON

Copy
{
  "success": true,
  "data": {
    "company_mission": "Firecrawl is the easiest way to extract data from the web. Developers use us to reliably convert URLs into LLM-ready markdown or structured data with a single API call.",
    "supports_sso": false,
    "is_open_source": true,
    "is_in_yc": true
  }
}
​
Asynchronous Extraction & Status Checking
When you submit an extraction job—either directly via the API or through the SDK’s asynchronous methods—you’ll receive a Job ID. You can use this ID to:

Check Job Status: Send a request to the /extract/ endpoint to see if the job is still running or has finished.
Automatically Poll (Default SDK Behavior): If you use the default extract method (Python/Node), the SDK automatically polls this endpoint for you and returns the final results once the job completes.
Manually Poll (Async SDK Methods): If you use the asynchronous methods—async_extract (Python) or asyncExtract (Node)—the SDK immediately returns a Job ID that you can track. Use get_extract_status (Python) or getExtractStatus (Node) to check the job’s progress on your own schedule.
This endpoint only works for jobs in progress or recently completed (within 24 hours).

Below are code examples for checking an extraction job’s status using Python, Node.js, and cURL:


Python

Node

cURL

Copy
import FirecrawlApp from "@mendable/firecrawl-js";

const app = new FirecrawlApp({
  apiKey: "fc-YOUR_API_KEY"
});

// Start an extraction job first
const extractJob = await app.asyncExtract([
  'https://docs.firecrawl.dev/*', 
  'https://firecrawl.dev/'
], {
  prompt: "Extract the company mission and features from these pages."
});

// Get the status of the extraction job
const jobStatus = await app.getExtractStatus(extractJob.jobId);

console.log(jobStatus);
// Example output:
// {
//   status: "completed",
//   progress: 100,
//   results: [{
//     url: "https://docs.firecrawl.dev",
//     data: { ... }
//   }]
// }
​
Possible States
completed: The extraction finished successfully.
processing: Firecrawl is still processing your request.
failed: An error occurred; data was not fully extracted.
cancelled: The job was cancelled by the user.
​
Pending Example
JSON

Copy
{
  "success": true,
  "data": [],
  "status": "processing",
  "expiresAt": "2025-01-08T20:58:12.000Z"
}
​
Completed Example
JSON

Copy
{
  "success": true,
  "data": {
      "company_mission": "Firecrawl is the easiest way to extract data from the web. Developers use us to reliably convert URLs into LLM-ready markdown or structured data with a single API call.",
      "supports_sso": false,
      "is_open_source": true,
      "is_in_yc": true
    },
  "status": "completed",
  "expiresAt": "2025-01-08T20:58:12.000Z"
}
​
Extracting without a Schema
If you prefer not to define a strict structure, you can simply provide a prompt. The underlying model will choose a structure for you, which can be useful for more exploratory or flexible requests.


Python

Node

cURL

Copy
import FirecrawlApp from "@mendable/firecrawl-js";

const app = new FirecrawlApp({
apiKey: "fc-YOUR_API_KEY"
});

const scrapeResult = await app.extract([
'https://docs.firecrawl.dev/',
'https://firecrawl.dev/'
], {
prompt: "Extract Firecrawl's mission from the page."
});

if (!scrapeResult.success) {
throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult.data);
JSON

Copy
{
  "success": true,
  "data": {
    "company_mission": "Turn websites into LLM-ready data. Power your AI apps with clean data crawled from any website."
  }
}
​
Improving Results with Web Search
Setting enableWebSearch = true in your request will expand the crawl beyond the provided URL set. This can capture supporting or related information from linked pages.

Here’s an example that extracts information about dash cams, enriching the results with data from related pages:


Python

Node

cURL

Copy
import FirecrawlApp from "@mendable/firecrawl-js";

const app = new FirecrawlApp({
apiKey: "fc-YOUR_API_KEY"
});

const scrapeResult = await app.extract([
'https://nextbase.com/dash-cams/622gw-dash-cam'
], {
prompt: "Extract details about the best dash cams including prices, features, pros/cons and reviews.",
enableWebSearch: true // Enable web search for better context
});

if (!scrapeResult.success) {
throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult.data);
​
Example Response with Web Search
JSON

Copy
{
  "success": true,
  "data": {
    "dash_cams": [
      {
        "name": "Nextbase 622GW",
        "price": "$399.99",
        "features": [
          "4K video recording",
          "Image stabilization",
          "Alexa built-in",
          "What3Words integration"
        ],
        /* Information below enriched with other websites like 
        https://www.techradar.com/best/best-dash-cam found 
        via enableWebSearch parameter */
        "pros": [
          "Excellent video quality",
          "Great night vision",
          "Built-in GPS"
        ],
        "cons": ["Premium price point", "App can be finicky"]
      }
    ],
  }

The response includes additional context gathered from related pages, providing more comprehensive and accurate information.

​
Extracting without URLs
The /extract endpoint now supports extracting structured data using a prompt without needing specific URLs. This is useful for research or when exact URLs are unknown. Currently in Alpha.


Python

Node

cURL

Copy
import { z } from "zod";

// Define schema to extract contents into
const schema = z.object({
  company_mission: z.string(),
});

const scrapeResult = await app.extract([], {
  prompt: "Extract the company mission from Firecrawl's website.",
  schema: schema
});

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult.data);
​
Known Limitations (Beta)
Large-Scale Site Coverage
Full coverage of massive sites (e.g., “all products on Amazon”) in a single request is not yet supported.

Complex Logical Queries
Requests like “find every post from 2025” may not reliably return all expected data. More advanced query capabilities are in progress.

Occasional Inconsistencies
Results might differ across runs, particularly for very large or dynamic sites. Usually it captures core details, but some variation is possible.

Beta State
Since /extract is still in Beta, features and performance will continue to evolve. We welcome bug reports and feedback to help us improve.

​
Billing and Usage Tracking
You can check our the pricing for /extract on the Extract landing page pricing page and monitor usage via the Extract page on the dashboard.

Have feedback or need help? Email help@firecrawl.dev.