Scrape
Scrape
Turn any url into clean data

Firecrawl converts web pages into markdown, ideal for LLM applications.

It manages complexities: proxies, caching, rate limits, js-blocked content
Handles dynamic content: dynamic websites, js-rendered sites, PDFs, images
Outputs clean markdown, structured data, screenshots or html.
For details, see the Scrape Endpoint API Reference.

​
Scraping a URL with Firecrawl
​
/scrape endpoint
Used to scrape a URL and get its content.

​
Installation

Python

Node

Go

Rust

Copy
npm install @mendable/firecrawl-js
​
Usage

Python

Node

Go

Rust

cURL

Copy
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

// Scrape a website:
const scrapeResult = await app.scrapeUrl('firecrawl.dev', { formats: ['markdown', 'html'] }) as ScrapeResponse;

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult)
For more details about the parameters, refer to the API Reference.

​
Response
SDKs will return the data object directly. cURL will return the payload exactly as shown below.


Copy
{
  "success": true,
  "data" : {
    "markdown": "Launch Week I is here! [See our Day 2 Release 🚀](https://www.firecrawl.dev/blog/launch-week-i-day-2-doubled-rate-limits)[💥 Get 2 months free...",
    "html": "<!DOCTYPE html><html lang=\"en\" class=\"light\" style=\"color-scheme: light;\"><body class=\"__variable_36bd41 __variable_d7dc5d font-inter ...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "language": "en",
      "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
      "robots": "follow, index",
      "ogTitle": "Firecrawl",
      "ogDescription": "Turn any website into LLM-ready data.",
      "ogUrl": "https://www.firecrawl.dev/",
      "ogImage": "https://www.firecrawl.dev/og.png?123",
      "ogLocaleAlternate": [],
      "ogSiteName": "Firecrawl",
      "sourceURL": "https://firecrawl.dev",
      "statusCode": 200
    }
  }
}
​
Scrape Formats
You can now choose what formats you want your output in. You can specify multiple output formats. Supported formats are:

Markdown (markdown)
HTML (html)
Raw HTML (rawHtml) (with no modifications)
Screenshot (screenshot or screenshot@fullPage)
Links (links)
Extract (extract) - structured output
Output keys will match the format you choose.

​
Extract structured data
​
/scrape (with extract) endpoint
Used to extract structured data from scraped pages.


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

const scrapeResult = await app.scrapeUrl("https://docs.firecrawl.dev/", {
  formats: ["json"],
  jsonOptions: { schema: schema }
});

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult.extract);
Output:

JSON

Copy
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "Train a secure AI on your technical resources that answers customer and employee questions so your team doesn't have to",
        "supports_sso": true,
        "is_open_source": false,
        "is_in_yc": true
      },
      "metadata": {
        "title": "Mendable",
        "description": "Mendable allows you to easily build AI chat applications. Ingest, customize, then deploy with one line of code anywhere you want. Brought to you by SideGuide",
        "robots": "follow, index",
        "ogTitle": "Mendable",
        "ogDescription": "Mendable allows you to easily build AI chat applications. Ingest, customize, then deploy with one line of code anywhere you want. Brought to you by SideGuide",
        "ogUrl": "https://docs.firecrawl.dev/",
        "ogImage": "https://docs.firecrawl.dev/mendable_new_og1.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Mendable",
        "sourceURL": "https://docs.firecrawl.dev/"
      },
    }
}
​
Extracting without schema (New)
You can now extract without a schema by just passing a prompt to the endpoint. The llm chooses the structure of the data.


cURL

Copy
curl -X POST https://api.firecrawl.dev/v1/scrape \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer YOUR_API_KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev/",
      "formats": ["json"],
      "jsonOptions": {
        "prompt": "Extract the company mission from the page."
      }
    }'
Output:

JSON

Copy
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "Train a secure AI on your technical resources that answers customer and employee questions so your team doesn't have to",
      },
      "metadata": {
        "title": "Mendable",
        "description": "Mendable allows you to easily build AI chat applications. Ingest, customize, then deploy with one line of code anywhere you want. Brought to you by SideGuide",
        "robots": "follow, index",
        "ogTitle": "Mendable",
        "ogDescription": "Mendable allows you to easily build AI chat applications. Ingest, customize, then deploy with one line of code anywhere you want. Brought to you by SideGuide",
        "ogUrl": "https://docs.firecrawl.dev/",
        "ogImage": "https://docs.firecrawl.dev/mendable_new_og1.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Mendable",
        "sourceURL": "https://docs.firecrawl.dev/"
      },
    }
}
​
Extract object
The extract object accepts the following parameters:

schema: The schema to use for the extraction.
systemPrompt: The system prompt to use for the extraction.
prompt: The prompt to use for the extraction without a schema.
​
Interacting with the page with Actions
Firecrawl allows you to perform various actions on a web page before scraping its content. This is particularly useful for interacting with dynamic content, navigating through pages, or accessing content that requires user interaction.

Here is an example of how to use actions to navigate to google.com, search for Firecrawl, click on the first result, and take a screenshot.

It is important to almost always use the wait action before/after executing other actions to give enough time for the page to load.

​
Example

Python

Node

cURL

Copy
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

// Scrape a website:
const scrapeResult = await app.scrapeUrl('firecrawl.dev', { formats: ['markdown', 'html'], actions: [
    { type: "wait", milliseconds: 2000 },
    { type: "click", selector: "textarea[title=\"Search\"]" },
    { type: "wait", milliseconds: 2000 },
    { type: "write", text: "firecrawl" },
    { type: "wait", milliseconds: 2000 },
    { type: "press", key: "ENTER" },
    { type: "wait", milliseconds: 3000 },
    { type: "click", selector: "h3" },
    { type: "scrape" },
    {"type": "screenshot"}
] }) as ScrapeResponse;

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult)
​
Output

JSON

Copy
{
  "success": true,
  "data": {
    "markdown": "Our first Launch Week is over! [See the recap 🚀](blog/firecrawl-launch-week-1-recap)...",
    "actions": {
      "screenshots": [
        "https://alttmdsdujxrfnakrkyi.supabase.co/storage/v1/object/public/media/screenshot-75ef2d87-31e0-4349-a478-fb432a29e241.png"
      ],
      "scrapes": [
        {
          "url": "https://www.firecrawl.dev/",
          "html": "<html><body><h1>Firecrawl</h1></body></html>"
        }
      ]
    },
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "language": "en",
      "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
      "robots": "follow, index",
      "ogTitle": "Firecrawl",
      "ogDescription": "Turn any website into LLM-ready data.",
      "ogUrl": "https://www.firecrawl.dev/",
      "ogImage": "https://www.firecrawl.dev/og.png?123",
      "ogLocaleAlternate": [],
      "ogSiteName": "Firecrawl",
      "sourceURL": "http://google.com",
      "statusCode": 200
    }
  }
}
For more details about the actions parameters, refer to the API Reference.

​
Location and Language
Specify country and preferred languages to get relevant content based on your target location and language preferences.

​
How it works
When you specify the location settings, Firecrawl will use an appropriate proxy if available and emulate the corresponding language and timezone settings. By default, the location is set to ‘US’ if not specified.

​
Usage
To use the location and language settings, include the location object in your request body with the following properties:

country: ISO 3166-1 alpha-2 country code (e.g., ‘US’, ‘AU’, ‘DE’, ‘JP’). Defaults to ‘US’.
languages: An array of preferred languages and locales for the request in order of priority. Defaults to the language of the specified location.

Python

Node

cURL

Copy
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

// Scrape a website:
const scrapeResult = await app.scrapeUrl('airbnb.com', { formats: ['markdown', 'html'], location: {
    country: "BR",
    languages: ["pt-BR"]
} }) as ScrapeResponse;

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult)```
​
Batch scraping multiple URLs
You can now batch scrape multiple URLs at the same time. It takes the starting URLs and optional parameters as arguments. The params argument allows you to specify additional options for the batch scrape job, such as the output formats.

​
How it works
It is very similar to how the /crawl endpoint works. It submits a batch scrape job and returns a job ID to check the status of the batch scrape.

The sdk provides 2 methods, synchronous and asynchronous. The synchronous method will return the results of the batch scrape job, while the asynchronous method will return a job ID that you can use to check the status of the batch scrape.

​
Usage

Python

Node

cURL

Copy
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

// Scrape multiple websites (synchronous):
const batchScrapeResult = await app.batchScrapeUrls(['firecrawl.dev', 'mendable.ai'], { formats: ['markdown', 'html'] });

if (!batchScrapeResult.success) {
  throw new Error(`Failed to scrape: ${batchScrapeResult.error}`)
}
// Output all the results of the batch scrape:
console.log(batchScrapeResult)

// Or, you can use the asynchronous method:
const batchScrapeJob = await app.asyncBulkScrapeUrls(['firecrawl.dev', 'mendable.ai'], { formats: ['markdown', 'html'] });
console.log(batchScrapeJob)

// (async) You can then use the job ID to check the status of the batch scrape:
const batchScrapeStatus = await app.checkBatchScrapeStatus(batchScrapeJob.id);
console.log(batchScrapeStatus)
​
Response
If you’re using the sync methods from the SDKs, it will return the results of the batch scrape job. Otherwise, it will return a job ID that you can use to check the status of the batch scrape.

​
Synchronous
Completed

Copy
{
  "status": "completed",
  "total": 36,
  "completed": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-00-00T00:00:00.000Z",
  "next": "https://api.firecrawl.dev/v1/batch/scrape/123-456-789?skip=26",
  "data": [
    {
      "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
      "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
      "metadata": {
        "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
        "language": "en",
        "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
        "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
        "ogLocaleAlternate": [],
        "statusCode": 200
      }
    },
    ...
  ]
}
​
Asynchronous
You can then use the job ID to check the status of the batch scrape by calling the /batch/scrape/{id} endpoint. This endpoint is meant to be used while the job is still running or right after it has completed as batch scrape jobs expire after 24 hours.


Copy
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v1/batch/scrape/123-456-789"
}
Suggest edits
