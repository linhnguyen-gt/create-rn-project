const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { logSuccess, logError, logWarning, logStep } = require("../utils/logUtils");
const { updateAndroidFiles } = require("../android/androidManager");
const { updateIOSProjectFiles } = require("../ios/iosManager");
const { findAndReplaceInDirectory } = require("../utils/fileUtils");

function setupNewProject(projectDir, projectName, oldName, bundleId) {
    logStep("Setting up new project...");

    try {
        // Update package.json and app.json
        const packageJsonPath = path.join(projectDir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            packageJson.name = projectName;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            logSuccess("Updated package.json");
        }

        const appJsonPath = path.join(projectDir, "app.json");
        if (fs.existsSync(appJsonPath)) {
            const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
            appJson.name = projectName;
            fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
            logSuccess("Updated app.json");
        }

        const fileExtensions = [
            ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".swift",
            ".m", ".h", ".gradle", ".pbxproj", ".plist", ".xml",
            ".json", ".yaml", ".yml", ".xcscheme", ".xcworkspacedata",
            ".storyboard", ".xib", ".podspec"
        ];

        // Replace project name occurrences
        findAndReplaceInDirectory(projectDir, /NewReactNative/g, projectName, fileExtensions);
        findAndReplaceInDirectory(projectDir, /newreactnative/g, projectName.toLowerCase(), fileExtensions);

        // Format bundle ID correctly for each platform and environment
        const baseAndroidId = bundleId || `com.${projectName.toLowerCase()}`;
        const baseIosId = bundleId || projectName.toLowerCase();

        // Update Android configuration with proper bundle IDs for each environment
        logStep("Updating Android configuration...");
        updateAndroidFiles(projectDir, "com.newreactnative", baseAndroidId, projectName);

        // Update iOS configuration with proper bundle IDs for each environment
        logStep("Updating iOS configuration...");
        updateIOSProjectFiles(projectDir, oldName, projectName, baseIosId);

        updateReadmeFile(projectDir, projectName);

        logSuccess("Project setup completed successfully");
        return true;
    } catch (error) {
        logError("Error setting up project", error);
        return false;
    }
}

function updateReadmeFile(projectDir, projectName) {
    logStep("Updating README.md...");
    const readmePath = path.join(projectDir, "README.md");
    
    if (fs.existsSync(readmePath)) {
        try {
            let content = fs.readFileSync(readmePath, "utf8");

            content = content.replace(
                /<h1>🚀 New React Native Project<\/h1>/,
                `<h1>🚀 ${projectName} Project</h1>`
            );

            if (!content.includes("Created with [Linh Nguyen]")) {
                content += `\n\n## Created with [Linh Nguyen](https://github.com/linhnguyen-gt).\n`;
            }

            fs.writeFileSync(readmePath, content);
            logSuccess("README.md updated successfully");
        } catch (error) {
            logError("Error updating README.md", error);
        }
    }
}

function cleanupProject(projectDir) {
    logStep("Cleaning up project...");

    const tempDirsToRemove = [
        ".expo-shared",
        ".expo",
        "expo-debug.log",
        "npm-debug.log",
        "yarn-debug.log",
        "yarn-error.log",
        ".env.vault",
        "create-rn-with-redux-project"
    ];

    for (const item of tempDirsToRemove) {
        const itemPath = path.join(projectDir, item);
        if (fs.existsSync(itemPath)) {
            try {
                if (fs.lstatSync(itemPath).isDirectory()) {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(itemPath);
                }
            } catch (error) {
                logError(`Error removing ${item}`, error);
            }
        }
    }
}

module.exports = {
    setupNewProject,
    cleanupProject
};