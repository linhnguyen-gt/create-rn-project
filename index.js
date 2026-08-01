#!/usr/bin/env node

const { program } = require("commander");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { Confirm, Select } = require("enquirer");

const { logSuccess, logError, logWarning, logInfo } = require("./src/utils/logUtils");
const { setupNewProject, cleanupProject } = require("./src/project/projectManager");
const { installDependencies, setupEnvironment } = require("./src/project/dependencyManager");
const { initializeGit, setupGitRemote } = require("./src/project/gitManager");

const { ARCHITECTURES, TEMPLATE_FALLBACK_BRANCH, REQUIRED_PACKAGE_MANAGER } = require("./src/architectures");
const { isValidProjectName, isReservedProjectName, NAME_RULES_MESSAGE } = require("./src/utils/project-name");
const { resolveLatestRelease } = require("./src/utils/template-release");
const { assertValidBundleId } = require("./src/utils/bundle-id");

let chalk;
(async () => {
    chalk = (await import("chalk")).default;

    program
        .name("create-rn-project")
        .description("Create a new React Native project from template")
        .argument("<project-directory>", "Project name")
        .option("-b, --bundle-id <id>", "Bundle identifier. Defaults to com.<project-name>")
        .option("-r, --repo <url>", "GitHub repository URL")
        .option("-a, --arch <architecture>", "Project architecture (redux, zustand)")
        .option("--skip-install", "Skip installing dependencies")
        // Kept registered so passing it reaches an explanation instead of commander's
        // "unknown option" — scripted invocations should learn why, not just fail.
        .option("--use-npm", "Removed: both templates require pnpm")
        .option("--skip-env-setup", "Skip environment setup")
        .option("--skip-git", "Skip git initialization")
        .action(async (projectDirectory, options) => {
            let projectName;
            let dependencyInstallFailed = false;

            try {
                if (!projectDirectory) {
                    throw new Error("Project name is required");
                }

                projectDirectory = projectDirectory.trim();

                if (projectDirectory.includes("@")) {
                    throw new Error(
                        "Version/branch selection is not supported. Use only the project name; templates are always cloned from their latest release."
                    );
                }

                projectName = projectDirectory;

                if (!isValidProjectName(projectName)) {
                    throw new Error(NAME_RULES_MESSAGE);
                }

                if (isReservedProjectName(projectName)) {
                    throw new Error("Cannot use reserved template names");
                }

                // Checked here as well as in setupNewProject so a typo fails now rather than
                // after cloning the template.
                if (options.bundleId) {
                    assertValidBundleId(options.bundleId);
                }

                let architecture = options.arch ? options.arch.toLowerCase() : null;

                if (!architecture) {
                    console.log();
                    logInfo("🏗️ Select an architecture for your project:");

                    const archOptions = Object.keys(ARCHITECTURES).map((key) => ({
                        name: key,
                        message: `${ARCHITECTURES[key].name} - ${ARCHITECTURES[key].description}`,
                        value: key
                    }));

                    const prompt = new Select({
                        name: "architecture",
                        message: "Choose an architecture:",
                        choices: archOptions
                    });

                    architecture = await prompt.run();
                    console.log();
                }

                if (!ARCHITECTURES[architecture]) {
                    throw new Error(
                        `Invalid architecture "${architecture}". Available architectures: ${Object.keys(ARCHITECTURES).join(", ")}`
                    );
                }

                if (options.useNpm) {
                    throw new Error(
                        "--use-npm is no longer supported. Both templates require pnpm: they pin it via\n" +
                            "`packageManager` and depend on pnpm-only workspace settings (hoisted node linker,\n" +
                            "overrides, patched dependencies) that npm ignores, producing a project that installs\n" +
                            "but fails later during a build.\n\n" +
                            "Remove --use-npm. If pnpm is missing, run `corepack enable`."
                    );
                }

                const selectedArch = ARCHITECTURES[architecture];

                logInfo(`🔍 Validating inputs...`);
                logInfo(`  • Project Name: ${projectName}`);
                logInfo(`  • Architecture: ${selectedArch.name}`);
                console.log();

                await ensurePackageManager();

                const currentDir = process.cwd();
                const projectPath = path.join(currentDir, projectName);

                // Checked before the network call, so an existing directory fails immediately
                // rather than after a tag lookup.
                if (fs.existsSync(projectPath)) {
                    throw new Error(`Directory ${projectName} already exists`);
                }

                // A release is a version the template author decided was ready. `main` is
                // whatever landed last, which is why generation no longer tracks it.
                const release = resolveLatestRelease(selectedArch.repo);
                const templateRef = release ? release.tag : TEMPLATE_FALLBACK_BRANCH;

                if (!release) {
                    logWarning(
                        `${selectedArch.name} has no tagged release yet — falling back to ${TEMPLATE_FALLBACK_BRANCH}.`
                    );
                }

                logInfo(`🚀 Creating a new React Native project with ${selectedArch.name}`);
                logSuccess(`\n📦 Creating project ${projectName} from template ${templateRef}...`);

                execSync(`git clone -b ${templateRef} ${selectedArch.repo} "${projectName}"`, {
                    stdio: "inherit",
                    cwd: currentDir
                });

                process.chdir(projectPath);

                process.env.ARCHITECTURE = architecture;

                const originalProjectName = selectedArch.originalName;
                setupNewProject(projectPath, projectName, originalProjectName, options.bundleId, architecture);

                const packageManager = detectPackageManager(projectPath);

                if (packageManager !== REQUIRED_PACKAGE_MANAGER) {
                    throw new Error(
                        `This template must be installed with ${REQUIRED_PACKAGE_MANAGER}, but it declares "${packageManager}".`
                    );
                }

                if (!options.skipInstall) {
                    dependencyInstallFailed = !installDependencies({ packageManager });
                }

                if (!options.skipEnvSetup) {
                    setupEnvironment(packageManager);
                }

                if (!options.skipGit) {
                    if (initializeGit() && options.repo) {
                        setupGitRemote(options.repo);
                    }
                }

                cleanupProject(projectPath);

                const runScript = (scriptName) => `${packageManager} ${scriptName}`;
                const hasNativeProjects =
                    fs.existsSync(path.join(projectPath, "ios")) || fs.existsSync(path.join(projectPath, "android"));

                logSuccess(`\n✅ Project ${projectName} created successfully with ${selectedArch.name} architecture!`);
                logInfo("\n📝 Next steps:");

                const steps = [`cd ${projectName}`];

                if (options.skipInstall) {
                    steps.push(`Install dependencies: ${packageManager} install`);
                    steps.push(`Set up environment: ${runScript("env:setup")}`);
                } else if (dependencyInstallFailed) {
                    steps.push(`Install dependencies again: ${packageManager} install`);
                }

                steps.push(`Run the app: ${runScript("ios")} or ${runScript("android")}`);

                // Optional, and placed last on purpose: the app runs off the local .env files
                // alone. EAS is only needed to sync values with a team, and the templates ship
                // no project id — each project runs `eas init` for its own.
                steps.push(
                    `Optional, only to sync env values with your team: \`npx eas init\`, then ${runScript("env:pull")}`
                );

                steps.forEach((step, index) => console.log(`${index + 1}. ${step}`));

                logInfo("\n📚 Documentation:");
                console.log("- React Native: https://reactnative.dev/docs/getting-started");

                selectedArch.documentation.forEach((doc) => {
                    console.log(`- ${doc.name}: ${doc.url}`);
                });

                console.log("- React Navigation: https://reactnavigation.org/docs/getting-started");
                console.log("- Expo: https://docs.expo.dev/get-started/installation/");
                console.log("- Expo CLI: https://docs.expo.dev/workflow/expo-cli/");

                logInfo("\n🐞 Troubleshooting:");
                if (hasNativeProjects) {
                    console.log("- If you encounter issues with iOS, try: cd ios && pod install");
                    console.log(
                        "- For Android issues, check your Android SDK setup and try: cd android && ./gradlew clean"
                    );
                } else {
                    console.log(
                        `- ios/ and android/ do not exist yet: they are generated by \`expo prebuild\`, which ${runScript("ios")} and ${runScript("android")} run for you`
                    );
                    console.log(`- To regenerate them from scratch: ${runScript("prebuild")}`);
                }

                const repoUrl =
                    ARCHITECTURES[architecture]?.repo || "https://github.com/linhnguyen-gt/new-react-native";
                const issuesUrl = repoUrl.replace(/\.git$/, "") + "/issues";
                console.log(`- For more help, visit: ${issuesUrl}`);

                selectedArch.community.forEach((community) => {
                    console.log(`- ${community.name}: ${community.url}`);
                });
            } catch (error) {
                logError("\n❌ Error creating project:", error);
                process.exit(1);
            }
        });

    program.parse();
})();

/**
 * Reads the package manager the template declares, rather than assuming one per architecture.
 * Both currently pin pnpm; the caller enforces that, this only reports what was found.
 */
function detectPackageManager(projectPath) {
    const packageJsonPath = path.join(projectPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            const packageManager = packageJson.packageManager;

            if (typeof packageManager === "string") {
                if (packageManager.startsWith("pnpm@")) return "pnpm";
                if (packageManager.startsWith("yarn@")) return "yarn";
                if (packageManager.startsWith("npm@")) return "npm";
            }
        } catch (error) {}
    }

    if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(projectPath, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(projectPath, "package-lock.json"))) return "npm";

    return "yarn";
}

function commandExists(command) {
    try {
        execSync(`${command} --version`, { stdio: "ignore" });
        return true;
    } catch (error) {
        return false;
    }
}

async function ensurePackageManager() {
    if (commandExists(REQUIRED_PACKAGE_MANAGER)) {
        return;
    }

    logWarning(`Both templates require ${REQUIRED_PACKAGE_MANAGER}, but it was not found.`);

    const prompt = new Confirm({
        name: "enableCorepack",
        message: "Enable Corepack now so pnpm can be used?",
        initial: true
    });

    const shouldEnableCorepack = await prompt.run();

    if (!shouldEnableCorepack) {
        throw new Error(`${REQUIRED_PACKAGE_MANAGER} is required. Run \`corepack enable\` and try again.`);
    }

    try {
        execSync("corepack enable", { stdio: "inherit" });
    } catch (error) {
        throw new Error("Failed to enable Corepack. Install pnpm or run `corepack enable` manually.");
    }

    if (!commandExists(REQUIRED_PACKAGE_MANAGER)) {
        throw new Error(
            `${REQUIRED_PACKAGE_MANAGER} is still unavailable after enabling Corepack. Install it and try again.`
        );
    }
}
