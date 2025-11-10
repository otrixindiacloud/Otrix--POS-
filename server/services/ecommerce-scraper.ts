/**
 * E-commerce Portal Scraper Service
 * 
 * Uses Puppeteer to scrape product data from e-commerce websites
 * Supports multiple e-commerce platforms including ansargallery
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import type { CompetitorProduct } from "../competitor-matching-service";

export interface ScrapeOptions {
  maxProducts?: number; // Limit number of products to scrape
  waitForSelector?: string; // CSS selector to wait for before scraping
  delay?: number; // Delay between page loads (ms)
}

export interface ScrapeResult {
  success: boolean;
  products: CompetitorProduct[];
  totalFound: number;
  errors?: string[];
}

/**
 * Scrape all products from ansargallery e-commerce portal
 */
export async function scrapeAnsargallery(
  baseUrl: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const {
    maxProducts = 1000,
    waitForSelector = ".product-item, .product-card, [class*='product']",
    delay = 1000,
  } = options;

  let browser: Browser | null = null;
  const products: CompetitorProduct[] = [];
  const errors: string[] = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to the base URL
    console.log(`Navigating to ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for products to load
    try {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    } catch (e) {
      console.warn("Product selector not found, continuing anyway...");
    }

    // Try to find pagination or "load more" button
    let hasMorePages = true;
    let pageNumber = 1;
    const maxPages = 50; // Safety limit

    while (hasMorePages && products.length < maxProducts && pageNumber <= maxPages) {
      console.log(`Scraping page ${pageNumber}...`);

      // Extract products from current page
      const pageProducts = await page.evaluate(() => {
        const productElements = document.querySelectorAll(
          ".product-item, .product-card, .product, [class*='product'], [data-product-id]"
        );

        const extracted: any[] = [];

        productElements.forEach((element) => {
          try {
            // Try to find product name
            const nameElement =
              element.querySelector("h1, h2, h3, h4, .product-name, [class*='name'], [class*='title']") ||
              element;
            const name = nameElement?.textContent?.trim() || "";

            if (!name) return;

            // Try to find price
            const priceElement =
              element.querySelector(
                ".price, .product-price, [class*='price'], [data-price]"
              ) || element;
            const priceText = priceElement?.textContent?.trim() || "";
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : 0;

            // Try to find original price (if on sale)
            const originalPriceElement = element.querySelector(
              ".original-price, .old-price, [class*='original'], [class*='old']"
            );
            const originalPriceText = originalPriceElement?.textContent?.trim() || "";
            const originalPriceMatch = originalPriceText.match(/[\d,]+\.?\d*/);
            const originalPrice = originalPriceMatch
              ? parseFloat(originalPriceMatch[0].replace(/,/g, ""))
              : undefined;

            // Try to find SKU
            const skuElement =
              element.querySelector(".sku, [class*='sku'], [data-sku]") || element;
            const sku = skuElement?.getAttribute("data-sku") ||
              skuElement?.textContent?.match(/SKU[:\s]*([^\s]+)/i)?.[1] ||
              undefined;

            // Try to find barcode
            const barcodeElement =
              element.querySelector(".barcode, [class*='barcode'], [data-barcode]") ||
              element;
            const barcode = barcodeElement?.getAttribute("data-barcode") ||
              barcodeElement?.textContent?.match(/Barcode[:\s]*([^\s]+)/i)?.[1] ||
              undefined;

            // Try to find product URL
            const linkElement = element.querySelector("a[href]") || element.closest("a");
            const url = linkElement?.getAttribute("href") || undefined;
            const fullUrl = url && !url.startsWith("http") 
              ? new URL(url, window.location.href).href 
              : url;

            // Try to find image URL
            const imageElement = element.querySelector("img");
            const imageUrl = imageElement?.getAttribute("src") ||
              imageElement?.getAttribute("data-src") ||
              undefined;
            const fullImageUrl = imageUrl && !imageUrl.startsWith("http")
              ? new URL(imageUrl, window.location.href).href
              : imageUrl;

            // Try to find description
            const descElement = element.querySelector(
              ".description, .product-description, [class*='description'], [class*='desc']"
            );
            const description = descElement?.textContent?.trim() || undefined;

            // Check availability
            const availabilityText = element.textContent?.toLowerCase() || "";
            let availability: string | undefined;
            if (availabilityText.includes("out of stock") || availabilityText.includes("unavailable")) {
              availability = "out_of_stock";
            } else if (availabilityText.includes("in stock") || availabilityText.includes("available")) {
              availability = "in_stock";
            } else if (availabilityText.includes("limited")) {
              availability = "limited";
            }

            if (name && price > 0) {
              extracted.push({
                name,
                price,
                originalPrice,
                sku,
                barcode,
                url: fullUrl,
                imageUrl: fullImageUrl,
                description,
                availability,
              });
            }
          } catch (err) {
            console.error("Error extracting product:", err);
          }
        });

        return extracted;
      });

      // Add products from this page
      for (const product of pageProducts) {
        if (products.length >= maxProducts) break;
        
        // Avoid duplicates
        const isDuplicate = products.some(
          (p) => p.name === product.name && p.price === product.price
        );
        if (!isDuplicate) {
          products.push(product);
        }
      }

      console.log(`Found ${pageProducts.length} products on page ${pageNumber}, total: ${products.length}`);

      // Try to navigate to next page
      const nextPageButton = await page.evaluate(() => {
        // Look for common pagination patterns
        const nextButton = Array.from(document.querySelectorAll("a, button")).find(
          (el) => {
            const text = el.textContent?.toLowerCase() || "";
            return (
              text.includes("next") ||
              text.includes(">") ||
              el.getAttribute("aria-label")?.toLowerCase().includes("next")
            );
          }
        );
        return nextButton ? nextButton.getAttribute("href") : null;
      });

      if (nextPageButton && products.length < maxProducts) {
        try {
          const nextUrl = nextPageButton.startsWith("http")
            ? nextPageButton
            : new URL(nextPageButton, baseUrl).href;
          await page.goto(nextUrl, { waitUntil: "networkidle2", timeout: 30000 });
          await page.waitForTimeout(delay);
          pageNumber++;
        } catch (e) {
          console.log("Could not navigate to next page:", e);
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }
    }

    console.log(`Scraping complete. Found ${products.length} products.`);

    return {
      success: true,
      products,
      totalFound: products.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("Scraping error:", error);
    errors.push(error.message || "Unknown error occurred");
    return {
      success: false,
      products,
      totalFound: products.length,
      errors,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generic e-commerce scraper that tries multiple strategies
 */
export async function scrapeEcommercePortal(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  // Check if it's ansargallery
  if (url.includes("ansargallery") || url.includes("ansar")) {
    return await scrapeAnsargallery(url, options);
  }

  // Default: use generic scraping strategy
  return await scrapeAnsargallery(url, options);
}

/**
 * Scrape products from a specific product listing page
 */
export async function scrapeProductListingPage(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  return await scrapeEcommercePortal(url, options);
}

