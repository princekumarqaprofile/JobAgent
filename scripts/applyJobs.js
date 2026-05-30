const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright'); // Added browser library here for self-execution

async function applyJobs(page) {
    const jobsPath = path.join(__dirname, '../jobs/jobs.json');
    const logPath = path.join(__dirname, '../applications/logs.json');

    if (!fs.existsSync(jobsPath)) {
        console.log("No extracted jobs found inside jobs/jobs.json. Run extractJobs.js first!");
        return;
    }

    const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
    console.log("Total jobs loaded to process:", jobs.length);

    // Core skill sets
    const primarySkills = ["selenium", "java", "rest assured", "postman"];

    // Load historical application log tracking
    let appliedLinks = new Set();
    if (fs.existsSync(logPath)) {
        try {
            const historicalLogs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
            historicalLogs.forEach(log => {
                if ((log.status === "APPLIED" || log.status === "ALREADY_APPLIED_ON_PLATFORM") && log.link) {
                    appliedLinks.add(log.link);
                }
            });
        } catch (e) {
            console.log("Starting tracking with a fresh application log sequence.");
        }
    }

    for (const job of jobs) {
        console.log(`\nProcessing: "${job.title}" at ${job.company}`);

        // CHECK 1: Local log history tracking
        if (appliedLinks.has(job.link)) {
            console.log("-> SKIPPED: You already applied to this job in a previous execution run.");
            continue;
        }

        try {
            // Navigate to individual job description page
            await page.goto(job.link, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(4000); 

            // CHECK 2: Native Green "Applied" badge element or plain text match
            const greenAppliedBadge = page.locator('.styles_j-applied___fK2w, .styles_btn-cluster__v_m60 .styles_j-applied___fK2w, [class*="applied"]').first();
            const plainTextApplied = page.locator('text="Applied", text="Already Applied"').first();

            if ((await greenAppliedBadge.count() > 0 && await greenAppliedBadge.isVisible()) || 
                (await plainTextApplied.count() > 0 && await plainTextApplied.isVisible())) {
                console.log("-> SKIPPED: UI indicator detects this job is already 'Applied'.");
                saveLog(job, "ALREADY_APPLIED_ON_PLATFORM");
                continue;
            }

            // CHECK 3: External Career Portal Filter ("Apply on company site")
            const externalCompanySiteBtn = page.locator('button:has-text("Apply on company site"), a:has-text("Apply on company site")').first();
            if (await externalCompanySiteBtn.count() > 0 && await externalCompanySiteBtn.isVisible()) {
                console.log("-> SKIPPED: Requires external company site portal redirection. Skipping.");
                saveLog(job, "SKIPPED_EXTERNAL_COMPANY_PORTAL");
                continue;
            }

            // CHECK 4: Primary Skills Verification Lookups
            const jdSelector = '.job-desc, .styles_Jd-left___Zz9f, #jobDescriptionId, [class*="jobDesc"]';
            let jdText = "";

            if (await page.locator(jdSelector).first().count() > 0) {
                jdText = await page.locator(jdSelector).first().innerText();
            } else {
                jdText = await page.locator('body').innerText();
            }

            const lowerCaseJD = jdText.toLowerCase();
            const matchedSkills = primarySkills.filter(skill => lowerCaseJD.includes(skill));

            if (matchedSkills.length === 0) {
                console.log(`-> IGNORED: Skill mismatch. Job Description does not contain: ${primarySkills.join(', ')}`);
                saveLog(job, "SKIPPED_SKILL_MISMATCH");
                continue;
            }

            console.log(`-> MATCH FOUND! Detected primary skills: [${matchedSkills.join(', ')}]`);

            // CHECK 5: Apply Execution Interaction
            const applyBtn = page.locator('button:has-text("Apply"), .styles_btn-cluster__v_m60 button, .styles_btn-cluster___v_m60 button').first();

            if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
                await applyBtn.click();
                await page.waitForTimeout(4000); 

                console.log("SUCCESS: Apply action executed safely.");
                saveLog(job, "APPLIED");
                appliedLinks.add(job.link);
            } else {
                console.log("-> SKIPPED: Active application button was not clickable or accessible.");
                saveLog(job, "APPLY_BUTTON_NOT_FOUND");
            }

        } catch (err) {
            console.log(`-> ERROR processing "${job.title}":`, err.message);
            saveLog(job, "ERROR");
        }
    }
}

function saveLog(job, status) {
    const logPath = path.join(__dirname, '../applications/logs.json');
    let logs = [];

    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(logPath)) {
        try {
            logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        } catch(e) {
            logs = [];
        }
    }

    logs.push({
        title: job.title,
        company: job.company,
        link: job.link,
        status,
        date: new Date().toISOString()
    });

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
}

// ==================== SELF EXECUTING RUNNER BLOCK ====================
async function runSelfContainedPipeline() {
    console.log("Launching Playwright Automation Browser...");
    const browser = await chromium.launch({
        headless: false, // Set to false to watch the browser process
        slowMo: 150
    });

    const page = await browser.newPage();

    console.log("Logging into platform context...");
    await page.goto('https://www.naukri.com/nlogin/login');
    await page.locator('#usernameField').fill('princekumarqaprofile@gmail.com');
    await page.locator('input[type="password"]').fill('Pa55word$703');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/mnjuser/**', { timeout: 30000 });
    console.log("Session authenticated successfully.");

    console.log("Starting application filter loop...");
    await applyJobs(page);

    console.log("\nAll items in queue parsed successfully. Shutting down browser.");
    await browser.close();
}

// Kicks off execution when this script file is run directly
runSelfContainedPipeline();