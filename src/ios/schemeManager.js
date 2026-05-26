const fs = require("fs");
const path = require("path");
const { logSuccess, logStep } = require("../utils/logUtils");

function replaceAll(value, from, to) {
    return value.split(from).join(to);
}

function updateSchemeFile(filePath, oldName, newName) {
    let content = fs.readFileSync(filePath, "utf8");
    content = replaceAll(content, oldName, newName);
    fs.writeFileSync(filePath, content);
}

function updateIOSSchemes(projectDir, oldName, newName) {
    logStep("Updating iOS schemes...");

    const schemesDir = path.join(projectDir, "ios", `${newName}.xcodeproj/xcshareddata/xcschemes`);
    if (!fs.existsSync(schemesDir)) {
        fs.mkdirSync(schemesDir, { recursive: true });
    }

    const oldMainSchemePath = path.join(schemesDir, `${oldName}.xcscheme`);
    const newMainSchemePath = path.join(schemesDir, `${newName}.xcscheme`);

    if (fs.existsSync(oldMainSchemePath)) {
        fs.renameSync(oldMainSchemePath, newMainSchemePath);
    }

    for (const file of fs.readdirSync(schemesDir)) {
        if (file.endsWith(".xcscheme")) {
            updateSchemeFile(path.join(schemesDir, file), oldName, newName);
        }
    }

    logSuccess("iOS schemes updated successfully");
}

module.exports = {
    updateIOSSchemes
};
