const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function extractJobs() {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 150
    });

    const page = await browser.newPage();

    // LOGIN
    await page.goto('https://www.naukri.com/nlogin/login');

    await page.locator('#usernameField').fill('princekumarqaprofile@gmail.com');
    await page.locator('input[type="password"]').fill('Pa55word$703');
    await page.click('button[type="submit"]');

    // Wait for the logged-in dashboard URL pattern to resolve
    await page.waitForURL('**/mnjuser/**', { timeout: 30000 });
    console.log("Login successful");

    // SEARCH JOB
    console.log("Opening search container...");
    const searchPlaceholder = page.locator('span.nI-gNb-sb__placeholder, .search-job-box, .nI-gNb-sb__txt');
    await searchPlaceholder.waitFor({ state: 'visible', timeout: 15000 });
    await searchPlaceholder.click();

    console.log("Locating keyword input box...");
    const jobInput = page.getByRole('textbox', { name: /keyword|designation/i });
    await jobInput.waitFor({ state: 'visible', timeout: 15000 });

    const jobKeyword = "QA automation engineer";
    await jobInput.fill(jobKeyword);
    
    console.log(`Searching for: "${jobKeyword}"`);
    await page.keyboard.press('Enter');

    // PAGINATION LOOP SETUP
    let allJobs = [];
    const seenLinks = new Set(); // Tracks unique URLs to prevent duplicates
    
    // CHANGE THIS NUMBER to scrape more pages (e.g., 5, 10, etc.)
    const maxPages = 5;         
    let currentPage = 1;

    // Target structural wrappers flexibly
    const jobCardSelector = 'article.jobTuple, div.srp-jobtuple-wrapper, div.cust-job-tuple';

    while (currentPage <= maxPages) {
        console.log(`\n--- Scraping Page ${currentPage} ---`);
        
        try {
            await page.waitForSelector(jobCardSelector, { timeout: 25000 });
            await page.waitForTimeout(2000); // Small cooldown buffer for dynamic elements
        } catch (timeoutErr) {
            console.log("Could not detect job elements on this page. Stopping loop.");
            break;
        }

        // Extract raw data from current page view
        const pageJobs = await page.$$eval(jobCardSelector, cards => {
            return cards.map(card => {
                const titleElement = card.querySelector('.title, a.title, [class*="title"]');
                const companyElement = card.querySelector('.subTitle, .comp-name, [class*="company"]');
                const linkElement = card.querySelector('a.title, a');

                return {
                    title: titleElement ? titleElement.innerText.trim() : "Unknown Title",
                    company: companyElement ? companyElement.innerText.trim() : "Unknown Company",
                    link: linkElement ? linkElement.href : ""
                };
            }).filter(job => job.link !== "");
        });

        // Filter out duplicate instances using our Set tracker
        let uniquePageCount = 0;
        for (const job of pageJobs) {
            if (!seenLinks.has(job.link)) {
                seenLinks.add(job.link);
                allJobs.push(job);
                uniquePageCount++;
            }
        }
        console.log(`Found ${pageJobs.length} raw cards on page ${currentPage} (${uniquePageCount} unique records added).`);

        // BREAK IF WE REACH MAX PAGES
        if (currentPage >= maxPages) {
            console.log("Reached targeted page limit.");
            break;
        }

        // PAGINATION INTERACTION: Locate and transition via "Next" button
        const nextButton = page.locator('a.styles_btn___o0Yw:has-text("Next"), a:has-text("Next"), .styles_btn-cluster__v_m60 >> text="Next"').first();
        
        if (await nextButton.count() > 0 && await nextButton.isVisible()) {
            console.log("Navigating to next page...");
            await nextButton.click();
            currentPage++;
            await page.waitForLoadState('domcontentloaded');
        } else {
            console.log("No further pagination navigation options detected.");
            break;
        }
    }

    console.log(`\nExtraction sequence complete. Total unique jobs collected: ${allJobs.length}`);
    
    // PRINT TO CONSOLE AT THE END OF THE SCRIPT
    console.log("\nFinal Extracted Jobs List:");
    console.log(allJobs);

    // SAVE FILE
    const filePath = path.join(__dirname, '../jobs/jobs.json');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(allJobs, null, 2));
    console.log("\nSaved structured results to:", filePath);

    await browser.close();
}

extractJobs();