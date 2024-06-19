const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { readUrlsFromExcel, writeUrlsToExcel, verifyUrls, mergeResults } = require('../utils/functions');
 
// Function to get the number of parallel workers from environment variables or default to 1
const getNumberOfWorkers = () => {
    return parseInt(process.env.PLAYWRIGHT_WORKERS || '1', 10);
};
 
test.describe('Verify URLs redirection and log failed cases', () => {
    let filePath;
    let workbook;
    let sheetName;
    let data;
    let totalRows;
    let chunkSize;
    const tempFilePaths = [];
 
    test.beforeAll(async () => {
        filePath = 'url.xlsx'; // Update if the path is different
        ({ workbook, sheetName, data } = await readUrlsFromExcel(filePath));
        totalRows = data.length - 1; // excluding header
        const numberOfWorkers = getNumberOfWorkers();
        chunkSize = Math.ceil(totalRows / numberOfWorkers);
    });
 
    test(`Verify URLs redirection`, async ({ page }, testInfo) => {
        const index = testInfo.workerIndex;
        const start = index * chunkSize;
        const end = start + chunkSize;
 
        const tempFilePath = path.join(__dirname, `../temp_result_${index}.json`);
        tempFilePaths.push(tempFilePath);
 
        const updatedData = await verifyUrls(page, data, start, end);
 
        // Save results to a temporary file
        fs.writeFileSync(tempFilePath, JSON.stringify(updatedData.slice(1))); // skip header
    });
 
    test.afterAll(async () => {
        await mergeResults(filePath, workbook, sheetName, tempFilePaths);
    });
});