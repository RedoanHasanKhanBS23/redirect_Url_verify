const xlsx = require('xlsx');
const fs = require('fs');
 
// Function to read URLs from the Excel file
async function readUrlsFromExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    return { workbook, sheetName, data };
}
 
// Function to write URLs to the Excel file
async function writeUrlsToExcel(filePath, workbook, sheetName, data) {
    const worksheet = xlsx.utils.aoa_to_sheet(data);
    workbook.Sheets[sheetName] = worksheet;
    xlsx.writeFile(workbook, filePath);
}
 
// Function to verify URLs and record failed cases
async function verifyUrls(page, data, start, end) {
    const headers = data[0];
    const rows = data.slice(1);
    const failedCases = [];
 
    // Ensure the "FAILED CASE" column exists
    if (!headers.includes("FAILED CASE")) {
        headers.push("FAILED CASE");
    }
 
    for (let i = start; i < end && i < rows.length; i++) {
        const row = rows[i];
        const oldUrlIndex = headers.indexOf("OLD URL");
        const newUrlIndex = headers.indexOf("NEW URL");
        const failedCaseIndex = headers.indexOf("FAILED CASE");
 
        if (oldUrlIndex === -1 || newUrlIndex === -1) {
            console.error("Error: Required columns are missing in the Excel sheet.");
            continue;
        }
 
        const oldUrl = row[oldUrlIndex];
        const newUrl = row[newUrlIndex];
 
        try {
            await page.goto(oldUrl);
            const currentUrl = page.url();
 
            if (currentUrl === newUrl) {
                console.log(`SUCCESS: ${oldUrl} redirected to the correct URL: ${newUrl}`);
                row[failedCaseIndex] = ""; // Clear any existing failed case
            } else {
                console.log(`FAIL: ${oldUrl} redirected to ${currentUrl} instead of ${newUrl}`);
                row[failedCaseIndex] = currentUrl;
                failedCases.push([...row]); // Add failed case to the list
            }
        } catch (error) {
            console.log(`ERROR: Failed to navigate to ${oldUrl}. Error: ${error.message}`);
            row[failedCaseIndex] = `Error: ${error.message}`;
            failedCases.push([...row]); // Add failed case to the list
        }
    }
 
    return { data, failedCases };
}
 // Function to merge results from parallel tests and save failed cases
async function mergeResults(filePath, workbook, sheetName, tempFilePaths) {
    let data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    const headers = data[0];
    const rows = data.slice(1);
    let allFailedCases = [];

    // Read each temporary file and merge results
    for (const tempFilePath of tempFilePaths) {
        if (fs.existsSync(tempFilePath)) {
            const { data: tempData, failedCases } = JSON.parse(fs.readFileSync(tempFilePath));
            for (let i = 0; i < tempData.length; i++) {
                rows[i] = tempData[i];
            }
            allFailedCases = allFailedCases.concat(failedCases);
        }
    }

    data = [headers, ...rows];
    await writeUrlsToExcel(filePath, workbook, sheetName, data);

    // Write failed cases to a new Excel file
    const failedCasesFilePath = 'failed_cases.xlsx';
    const failedCasesWorkbook = xlsx.utils.book_new();
    const failedCasesSheet = xlsx.utils.aoa_to_sheet([headers, ...allFailedCases]);
    xlsx.utils.book_append_sheet(failedCasesWorkbook, failedCasesSheet, 'Failed Cases');
    xlsx.writeFile(failedCasesWorkbook, failedCasesFilePath);

    // Clean up temporary files
    for (const tempFilePath of tempFilePaths) {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

 
module.exports = { readUrlsFromExcel, writeUrlsToExcel, verifyUrls, mergeResults };