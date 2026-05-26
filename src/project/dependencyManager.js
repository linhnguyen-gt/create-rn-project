const { execSync } = require("child_process");
const { logSuccess, logError, logWarning, logInfo, logStep } = require("../utils/logUtils");

function ensureCommand(command, installCommand) {
    try {
        execSync(`${command} --version`, { stdio: "ignore" });
        return true;
    } catch (error) {
        if (!installCommand) {
            return false;
        }

        logWarning(`${command} not found. Running ${installCommand}...`);
        try {
            execSync(installCommand, { stdio: "inherit" });
            return true;
        } catch (installError) {
            return false;
        }
    }
}

function installDependencies(options = {}) {
    const packageManager = typeof options === "boolean" ? (options ? "npm" : "yarn") : options.packageManager || "yarn";

    logStep("Installing dependencies...");
    const installTimeout = 600000;
    const installOptions = {
        stdio: "inherit",
        timeout: installTimeout,
        maxBuffer: 1024 * 1024 * 20
    };

    try {
        if (packageManager === "npm") {
            logInfo("Using npm to install dependencies...");
            execSync("npm install", installOptions);
        } else if (packageManager === "pnpm") {
            logInfo("Using pnpm to install dependencies...");

            if (!ensureCommand("pnpm", "corepack enable")) {
                throw new Error("pnpm is not available. Install pnpm or enable Corepack.");
            }

            execSync("pnpm install", installOptions);
        } else {
            logInfo("Using yarn to install dependencies...");

            if (!ensureCommand("yarn")) {
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
        logWarning("2. Try installing with the template package manager");
        logWarning("3. Try installing with npm: npm install --legacy-peer-deps");
        logWarning("4. Clear package manager cache and try again:");
        logWarning("   - pnpm: pnpm store prune");
        logWarning("   - npm: npm cache clean --force");
        logWarning("   - yarn: yarn cache clean");
        return false;
    }
}

function scriptCommand(packageManager, scriptName) {
    return packageManager === "npm" ? `npm run ${scriptName}` : `${packageManager} ${scriptName}`;
}

function setupEnvironment(packageManager = "yarn") {
    logStep("Setting up environment...");
    const command = scriptCommand(packageManager, "env:setup");

    try {
        execSync(command, { stdio: "inherit" });
        logSuccess("Environment setup completed successfully");
        return true;
    } catch (error) {
        logError("Failed to set up environment", error);
        logWarning(`You can set it up manually later by running '${command}'`);
        return false;
    }
}

module.exports = {
    installDependencies,
    setupEnvironment
};
