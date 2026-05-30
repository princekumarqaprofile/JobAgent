const { chromium } = require('playwright');

async function searchJobs() {

    const browser = await chromium.launch({
        headless: false,
        slowMo: 200
    });

    const page = await browser.newPage();

    // LOGIN
    await page.goto('https://www.naukri.com/nlogin/login');

    await page.locator('#usernameField')
        .fill('princekumarqaprofile@gmail.com');

    await page.locator('input[type="password"]')
        .fill('Pa55word$703');

    await page.click('button[type="submit"]');

    await page.waitForURL('**/mnjuser/**', { timeout: 30000 });

    console.log("Login successful");

    const jobs = [
        'qa automation engineer',
        'sdet',
        'senior test analyst',
        'test automation engineer'
    ];

    for (const job of jobs) {

        console.log("Searching:", job);

        // STEP 1: Open search UI
        await page.goto('https://www.naukri.com/');

        // Click search placeholder (opens input box)
        await page.click('span.nI-gNb-sb__placeholder');

        // STEP 2: Fill job keyword
        const jobInput = page.locator('input.suggestor-input');

        await jobInput.waitFor({ state: 'visible', timeout: 20000 });

        await jobInput.fill(job);

        // STEP 3: Select experience (5 years example)
        const expInput = page.locator('#experienceDD');

        if (await expInput.isVisible()) {
            await expInput.click();
            await expInput.fill('5');
            await page.keyboard.press('Enter');
        }

        // STEP 4: Click search button
        await page.click('span:has-text("Search")');

        // STEP 5: Wait results
        await page.waitForTimeout(5000);

        console.log("Completed:", job);
    }

    console.log("All searches completed");

    await browser.close();
}

searchJobs();