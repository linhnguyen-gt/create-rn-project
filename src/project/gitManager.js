const { execSync } = require("child_process");
const { logSuccess, logError, logWarning, logStep } = require("../utils/logUtils");

function initializeGit() {
    logStep("Initializing Git repository...");

    try {
        execSync("rm -rf .git", { stdio: "inherit" });
        
        execSync("git init", { stdio: "inherit" });
        execSync("git add .", { stdio: "inherit" });
        execSync('git commit -m "Initial commit from template"', { stdio: "inherit" });
        logSuccess("Git repository initialized successfully");
        return true;
    } catch (error) {
        logError("Failed to initialize git repository", error);
        return false;
    }
}

function setupGitRemote(repoUrl) {
    if (!repoUrl) return false;

    logStep(`Pushing to GitHub repository: ${repoUrl}`);
    try {
        execSync(`git remote add origin ${repoUrl}`, { stdio: "inherit" });
        execSync("git push -u origin main", { stdio: "inherit" });
        logSuccess("Code pushed to GitHub repository successfully");
        return true;
    } catch (error) {
        logError("Failed to push to GitHub repository", error);
        logWarning("You can push manually later with:");
        logWarning(`git remote add origin ${repoUrl}`);
        logWarning("git push -u origin main");
        return false;
    }
}

module.exports = {
    initializeGit,
    setupGitRemote
};