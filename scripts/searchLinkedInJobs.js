const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function searchLinkedInJobs() {
    console.log("Launching High-Yield LinkedIn Job Search Engine...");
    
    const browser = await chromium.launch({
        headless: false, 
        slowMo: 100
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        locale: 'en-US'
    });
    
    const page = await context.newPage();

    // 1. Absolute core skills required to match a job posting
    const mandatorySkills = ["selenium", "java", "rest assured", "postman"];

    // 2. Your complete full skill profile list (all lowercased for accurate matching)
    const myFullSkillSet = [
        "java", "selenium webdriver", "testng", "rest assured", "postman", 
        "api testing", "ui testing", "functional testing", "regression testing", 
        "end-to-end testing", "manual testing", "cross-browser testing", 
        "selenium grid", "browserstack", "lambdatest", "xpath", "bdd cucumber", 
        "git", "agile", "scrum", "azure devops", "jira", "sql", "maven", 
        "pom framework", "hybrid framework,Selenium,RestAssured"
    ];
    
    const searchKeywords = [
        "QA Automation Engineer",
        "SDET Automation",
        "Automation Test Engineer"
    ];

    let foundJobs = [];
    const seenLinks = new Set();
    const maxTargetJobs = 30;

    for (const keyword of searchKeywords) {
        if (foundJobs.length >= maxTargetJobs) break;

        console.log(`\nSearching LinkedIn Feed for: "${keyword}"`);
        
        const encodedKeyword = encodeURIComponent(keyword);
        const url = `https://www.linkedin.com/jobs/search?keywords=${encodedKeyword}&location=India&f_TPR=r2592000`; 
        
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);

            console.log("Scrolling page down to load dynamic job cards...");
            for (let i = 0; i < 6; i++) {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(1500);
            }
        } catch (err) {
            console.log(`⚠️ Network timeout exploring feed path. Skipping keyword loop.`);
            continue;
        }

        const jobCards = await page.$$eval('ul.jobs-search__results-list > li', (elements) => {
            return elements.map(el => {
                const titleEl = el.querySelector('.base-search-card__title');
                const companyEl = el.querySelector('.base-search-card__subtitle a, .base-search-card__subtitle');
                const linkEl = el.querySelector('.base-card__full-link, a');
                
                return {
                    title: titleEl ? titleEl.innerText.trim() : '',
                    company: companyEl ? companyEl.innerText.trim() : 'Unknown Enterprise',
                    link: linkEl ? linkEl.href.split('?')[0] : '' 
                };
            }).filter(item => item.title !== '' && item.link !== '');
        });

        console.log(`Discovered ${jobCards.length} raw postings. Evaluating skills...`);

        for (const card of jobCards) {
            if (foundJobs.length >= maxTargetJobs) break;
            if (seenLinks.has(card.link)) continue;

            try {
                await page.goto(card.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(1500);

                const jdSelector = '.description__text, .show-more-less-html__markup, section.description';
                let jdText = "";
                
                const jdElementCount = await page.locator(jdSelector).first().count();
                if (jdElementCount > 0) {
                    jdText = await page.locator(jdSelector).first().innerText();
                } else {
                    jdText = await page.locator('body').innerText();
                }

                const lowerJD = jdText.toLowerCase();
                const lowerTitle = card.title.toLowerCase();
                const fullContext = `${lowerTitle} ${lowerJD}`;

                // Validate mandatory profile presence first
                const matchedMandatory = mandatorySkills.filter(skill => fullContext.includes(skill));

                if (matchedMandatory.length >= 2) {
                    seenLinks.add(card.link);

                    // Map matched skills from your entire profile list
                    const skillsNeeded = myFullSkillSet.filter(skill => fullContext.includes(skill));
                    
                    // Identify skills you HAVE but are MISSING from this particular job description
                    const missingSkills = myFullSkillSet.filter(skill => !fullContext.includes(skill));

                    foundJobs.push({
                        jobTitle: card.title,
                        company: card.company,
                        skillsNeeded: skillsNeeded.map(s => s.toUpperCase()),
                        missingSkills: missingSkills.map(s => s.toUpperCase()), // New Field added!
                        sourceSite: "LinkedIn Public Feed",
                        contactDetails: "Apply directly via portal link",
                        directApplyLink: card.link,
                        dateScraped: new Date().toISOString().split('T')[0]
                    });
                    
                    console.log(`✅ MATCHED [${foundJobs.length}]: "${card.title}" at ${card.company}`);
                    console.log(`   -> Missing from JD: ${missingSkills.slice(0, 4).join(', ')}...`);
                }
            } catch (cardErr) {
                continue; 
            }
        }
    }

    console.log(`\nPipeline Operations Finished: Total Qualified Matches Collected: ${foundJobs.length}/${maxTargetJobs}`);

    const outputFilePath = path.join(__dirname, '../jobs/google_matched_jobs.json');
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(foundJobs, null, 2));
    console.log(`Structured items saved perfectly into: ${outputFilePath}`);

    await browser.close();
}

searchLinkedInJobs();