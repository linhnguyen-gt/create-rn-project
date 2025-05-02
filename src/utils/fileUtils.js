const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

function replaceInFile(filePath, searchValue, replaceValue) {
    if (fs.existsSync(filePath)) {
        try {
            let content = fs.readFileSync(filePath, "utf8");
            content = content.replace(searchValue, replaceValue);
            fs.writeFileSync(filePath, content);
            return true;
        } catch (error) {
            console.log(chalk.red(`Error replacing in file ${filePath}: ${error.message}`));
            return false;
        }
    }
    return false;
}

function findAndReplaceInDirectory(directory, searchValue, replaceValue, fileExtensions = []) {
    try {
        if (!fs.existsSync(directory)) return;

        const items = fs.readdirSync(directory, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(directory, item.name);

            if (item.isDirectory()) {
                if (item.name !== "node_modules" && item.name !== ".git") {
                    findAndReplaceInDirectory(fullPath, searchValue, replaceValue, fileExtensions);
                }
            } else if (item.isFile()) {
                if (fileExtensions.length === 0 || fileExtensions.some((ext) => item.name.endsWith(ext))) {
                    replaceInFile(fullPath, searchValue, replaceValue);
                }
            }
        }
    } catch (error) {
        console.log(chalk.red(`Error searching directory ${directory}: ${error.message}`));
    }
}

module.exports = {
    replaceInFile,
    findAndReplaceInDirectory
};