const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { readUrlsFromExcel, verifyUrls, mergeResults } = require('../utils/functions');

// Function to get the number of parallel workers
const getNumberOfWorkers = () => {
    return parseInt(process.env.PLAYWRIGHT_WORKERS || '1', 10);
};

test.describe('Verify URLs redirection and log failed cases', () => {
    let filePath = 'url.xlsx';
    let workbook;
    let sheetName;
    let data;
    let totalRows;
    let chunkSize;
    const tempFilePaths = [];
    const screenshotDir = 'C:/Tosca_Projects/Redirect URL Test/screenshots';

    test.beforeAll(async () => {
        ({ workbook, sheetName, data } = await readUrlsFromExcel(filePath));
        totalRows = data.length - 1;
        chunkSize = Math.ceil(totalRows / getNumberOfWorkers());

        // Ensure the screenshots folder exists
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
    });

    test(`Verify URLs redirection`, async ({ page }, testInfo) => {
        const index = testInfo.workerIndex;
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, totalRows);

        const tempFilePath = path.join(__dirname, `../temp_result_${index}.json`);
        tempFilePaths.push(tempFilePath);

        const { data: updatedData, failedCases } = await verifyUrls(page, data, start, end, async (url, urlIndex) => {
            await page.goto(url);

            // Define the path for the screenshot
            const screenshotPath = path.join(screenshotDir, `screenshot_${index}_${urlIndex}.png`);
            
            // Take and save the screenshot
            await page.screenshot({ path: screenshotPath });

            // Log an error if the screenshot was not saved
            if (!fs.existsSync(screenshotPath)) {
                console.error(`Error: Screenshot for URL ${url} at index ${urlIndex} was not saved.`);
            }
        });

        // Save results to a temporary file
        fs.writeFileSync(tempFilePath, JSON.stringify({ data: updatedData.slice(1), failedCases }));
    });

    test.afterAll(async () => {
        await mergeResults(filePath, workbook, sheetName, tempFilePaths);
    });
});
