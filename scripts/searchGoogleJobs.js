const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

// Inject the stealth plugin into Playwright before launching
chromium.use(stealth);

async function searchGoogleJobs() {
    console.log("Launching Upgraded Stealth Google Search Scraper Engine...");
    
    const browser = await chromium.launch({
        headless: false, // Set to false so you can watch or solve a captcha if needed
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: null // Uses the maximized screen layout naturally
    });
    
    const page = await context.newPage();

    const mandatorySkills = ["Selenium", "Java", "Rest Assured", "Postman"];
    const secondarySkills = ["TestNG", "API Testing", "UI Testing", "Functional Testing", "BDD Cucumber", "Maven"];

    // Human-like natural search string queries
    const precisionQueries = [
        'intitle:"QA Automation" Selenium Java "Rest Assured" site:lever.co',
        'intitle:SDET Selenium Java "Rest Assured" site:greenhouse.io',
        'intitle:"Automation Engineer" Java TestNG Postman site:myworkdayjobs.com',
        '"QA Automation Engineer" Java "Rest Assured" Postman'
    ];

    let foundJobs = [];
    const seenLinks = new Set();
    const maxTargetJobs = 200;

    for (const query of precisionQueries) {
        if (foundJobs.length >= maxTargetJobs) break;

        console.log(`\nExecuting Query: ${query}`);
        
        try {
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Random delay between 3 to 6 seconds to mimic human reading patterns
            const humanDelay = Math.floor(Math.random() * 3000) + 3000;
            await page.waitForTimeout(humanDelay);

            // Double check if a hard CAPTCHA block page is visible
            if (await page.locator('text=Our systems have detected unusual traffic').count() > 0 || await page.locator('#captcha-form').count() > 0) {
                console.log("⚠️ Google Security Wall Triggered! Please solve the CAPTCHA inside the browser window immediately...");
                // Gives you up to 30 seconds to solve it manually
                await page.waitForTimeout(30000); 
            }

            // Look for standard Google result cards or search containers
            await page.waitForSelector('div.g, #rso', { timeout: 10000 });

        } catch (e) {
            console.log(`⚠️ Search results container skipped or timed out for this phrase layout.`);
            continue; 
        }

        // Parse search items
        const searchNodes = await page.$$eval('div.g', (elements) => {
            return elements.map(el => {
                const titleEl = el.querySelector('h3');
                const linkEl = el.querySelector('a');
                const snippetEl = el.querySelector('.VwiC3b, [class*="snippet"], [style*="-webkit-line-clamp"]');

                return {
                    title: titleEl ? titleEl.innerText : '',
                    link: linkEl ? linkEl.href : '',
                    snippet: snippetEl ? snippetEl.innerText : ''
                };
            }).filter(item => item.title !== '' && item.link !== '' && !item.link.includes('google.com'));
        });

        console.log(`Found ${searchNodes.length} search entries on page.`);

        for (const node of searchNodes) {
            if (foundJobs.length >= maxTargetJobs) break;
            if (seenLinks.has(node.link)) continue;

            const textContext = `${node.title} ${node.snippet}`.toLowerCase();

            // Match structural skill check rules
            const matchesMandatory = mandatorySkills.every(skill => textContext.includes(skill.toLowerCase()));

            if (matchesMandatory) {
                seenLinks.add(node.link);

                const matchedSecondary = secondarySkills.filter(skill => textContext.includes(skill.toLowerCase()));
                const allMatchedSkills = [...mandatorySkills, ...matchedSecondary];

                let sourcePortal = "Direct Corporate Portal";
                if (node.link.includes("lever.co")) sourcePortal = "Lever ATS";
                else if (node.link.includes("greenhouse.io")) sourcePortal = "Greenhouse ATS";
                else if (node.link.includes("myworkdayjobs.com")) sourcePortal = "Workday Careers";

                foundJobs.push({
                    jobTitle: node.title.split(' - ')[0].trim(),
                    company: extractCompanyName(node.title, node.link),
                    skillsNeeded: allMatchedSkills,
                    sourceSite: sourcePortal,
                    directApplyLink: node.link,
                    dateScraped: new Date().toISOString().split('T')[0]
                });
            }
        }
    }

    console.log(`\nExtraction Complete: Compiled ${foundJobs.length} structured records.`);

    const outputFilePath = path.join(__dirname, '../jobs/google_matched_jobs.json');
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputFilePath, JSON.stringify(foundJobs, null, 2));
    console.log(`Saved items successfully inside: ${outputFilePath}`);

    await browser.close();
}

function extractCompanyName(title, link) {
    try {
        if (title.includes(" at ")) return title.split(/ at /i)[1].split('|')[0].split('-')[0].trim();
        const urlObj = new URL(link);
        return urlObj.hostname.replace('www.', '').split('.')[0].toUpperCase();
    } catch (e) {
        return "Enterprise Partner";
    }
}

searchGoogleJobs();