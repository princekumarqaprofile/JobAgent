// Save this as apply.js in C:\Users\PRINCE KUMAR\OneDrive\Desktop\JobAgent\apply.js
const { chromium } = require('playwright');
const { applyJobs } = require('./scripts/applyJobs');

async function runPipeline() {
    console.log("Launching Playwright Automation Browser...");
    const browser = await chromium.launch({
        headless: false, // Watch the scraper filter and apply live
        slowMo: 200      
    });

    const page = await browser.newPage();

    console.log("Logging into platform context...");
    await page.goto('https://www.naukri.com/nlogin/login');
    await page.locator('#usernameField').fill('princekumarqaprofile@gmail.com');
    await page.locator('input[type="password"]').fill('Pa55word$703');
    await page.click('button[type="submit"]');
    
    // Wait for the dashboard redirect URL pattern to resolve
    await page.waitForURL('**/mnjuser/**', { timeout: 30000 });
    console.log("Session authenticated successfully.");

    console.log("Handing over page context to application filter engine...");
    await applyJobs(page);

    console.log("\nAll listings parsed successfully. Shutting down browser context.");
    await browser.close();
}

runPipeline();