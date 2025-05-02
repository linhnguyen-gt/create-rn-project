const chalk = require("chalk");

function logSuccess(message) {
    console.log(chalk.green(`✅ ${message}`));
}

function logError(message, error) {
    console.log(chalk.red(`❌ ${message}`));
    if (error) {
        console.log(chalk.red(error.message || "Unknown error"));
    }
}

function logWarning(message) {
    console.log(chalk.yellow(`⚠️ ${message}`));
}

function logInfo(message) {
    console.log(chalk.blue(`ℹ️ ${message}`));
}

function logStep(message) {
    console.log(chalk.yellow(`\n🔄 ${message}`));
}

module.exports = {
    logSuccess,
    logError,
    logWarning,
    logInfo,
    logStep
};