const { execSync } = require("child_process");
const { logSuccess, logError, logWarning, logInfo, logStep } = require("../utils/logUtils");

function installDependencies(useNpm = false) {
    logStep("Installing dependencies...");
    const installTimeout = 600000; 
    const installOptions = {
        stdio: "inherit",
        timeout: installTimeout,
        maxBuffer: 1024 * 1024 * 20 
    };

    try {
        if (useNpm) {
            logInfo("Using npm to install dependencies...");
            execSync("npm install", installOptions);
        } else {
            logInfo("Using yarn to install dependencies...");

            try {
                execSync("yarn --version", { stdio: "ignore" });
            } catch (yarnError) {
                logWarning("Yarn not found. Installing yarn globally...");
                execSync("npm install -g yarn", { stdio: "inherit" });
            }

            try {
                execSync("yarn install", installOptions);
            } catch (yarnInstallError) {
                logWarning("Yarn install failed, trying with --network-timeout...");
                execSync("yarn install --network-timeout 300000", installOptions);
            }
        }
        logSuccess("Dependencies installed successfully");
        return true;
    } catch (error) {
        logError("Failed to install dependencies", error);
        logWarning("\nPossible solutions:");
        logWarning("1. Check your internet connection");
        logWarning("2. Try installing with npm: npm install");
        logWarning("3. Try installing with yarn: yarn install --network-timeout 300000");
        logWarning("4. Clear npm/yarn cache and try again:");
        logWarning("   - npm: npm cache clean --force");
        logWarning("   - yarn: yarn cache clean");
        return false;
    }
}

function setupEnvironment() {
    logStep("Setting up environment...");
    try {
        execSync("yarn env:setup", { stdio: "inherit" });
        logSuccess("Environment setup completed successfully");
        return true;
    } catch (error) {
        logError("Failed to set up environment", error);
        logWarning("You can set it up manually later by running 'yarn env:setup'");
        return false;
    }
}

module.exports = {
    installDependencies,
    setupEnvironment
};