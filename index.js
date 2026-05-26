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

const ARCHITECTURES = {
    redux: {
        name: "Redux + Redux Saga",
        repo: "https://github.com/linhnguyen-gt/new-react-native.git",
        description: "State management with Redux and Redux Saga",
        originalName: "NewReactNative",
        documentation: [
            { name: "Redux Toolkit", url: "https://redux-toolkit.js.org/introduction/getting-started" },
            { name: "Redux Saga", url: "https://redux-saga.js.org/docs/introduction/GettingStarted" }
        ],
        community: [
            { name: "Redux community", url: "https://stackoverflow.com/questions/tagged/redux" },
            { name: "Redux Saga community", url: "https://github.com/redux-saga/redux-saga/discussions" }
        ]
    },
    zustand: {
        name: "Zustand + React Query",
        repo: "https://github.com/linhnguyen-gt/new-react-native-zustand-react-query.git",
        description: "State management with Zustand and data fetching with React Query",
        originalName: "NewReactNativeZustandRNQ",
        documentation: [
            { name: "Zustand", url: "https://github.com/pmndrs/zustand" },
            { name: "React Query", url: "https://tanstack.com/query/latest/docs/react/overview" }
        ],
        community: [
            { name: "Zustand community", url: "https://github.com/pmndrs/zustand/discussions" },
            { name: "React Query community", url: "https://github.com/TanStack/query/discussions" }
        ]
    }
};

const TEMPLATE_BRANCH = "main";
const ZUSTAND_REQUIRED_PACKAGE_MANAGER = "pnpm";

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
        .option("--use-npm", "Use npm instead of the template package manager")
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
                        "Version/branch selection is no longer supported. Use only the project name; templates are always cloned from main."
                    );
                }

                projectName = projectDirectory;

                if (!/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(projectName)) {
                    throw new Error(
                        "Invalid project name. Name must be in PascalCase:\n" +
                            "  • Start with uppercase letter\n" +
                            "  • Each word must start with uppercase\n" +
                            "  • All other letters must be lowercase\n" +
                            "  • No numbers or special characters\n\n" +
                            "Examples:\n" +
                            "  ✅ Good: MyApp, MyReactApp\n" +
                            "  ❌ Bad: myApp, MYAPP, myapp, My-App, MyApp1, my_app"
                    );
                }

                if (
                    projectName.toLowerCase() === "newreactnative" ||
                    projectName.toLowerCase() === "new-react-native" ||
                    projectName.toLowerCase() === "newreactnativezustandrn" ||
                    projectName.toLowerCase() === "new-react-native-zustand-rn" ||
                    projectName.toLowerCase() === "newreactnativezustandrnq" ||
                    projectName.toLowerCase() === "new-react-native-zustand-rnq"
                ) {
                    throw new Error("Cannot use reserved template names");
                }

                if (!projectName.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
                    throw new Error(
                        "Project name must start with a letter and can only contain letters, numbers, dashes, and underscores"
                    );
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

                if (architecture === "zustand" && options.useNpm) {
                    throw new Error(
                        "The Zustand template requires pnpm. Remove --use-npm and use the template package manager."
                    );
                }

                const selectedArch = ARCHITECTURES[architecture];

                logInfo(`🔍 Validating inputs...`);
                logInfo(`  • Project Name: ${projectName}`);
                logInfo(`  • Template Branch: ${TEMPLATE_BRANCH}`);
                logInfo(`  • Architecture: ${selectedArch.name}`);
                console.log();

                if (architecture === "zustand") {
                    await ensureZustandPackageManager();
                }

                logInfo(`🚀 Creating a new React Native project with ${selectedArch.name}`);
                logSuccess(`\n📦 Creating project ${projectName} from latest main template...`);

                const currentDir = process.cwd();
                const projectPath = path.join(currentDir, projectName);

                if (fs.existsSync(projectPath)) {
                    throw new Error(`Directory ${projectName} already exists`);
                }

                execSync(`git clone -b ${TEMPLATE_BRANCH} ${selectedArch.repo} "${projectName}"`, {
                    stdio: "inherit",
                    cwd: currentDir
                });

                process.chdir(projectPath);

                process.env.ARCHITECTURE = architecture;

                const originalProjectName = selectedArch.originalName;
                setupNewProject(projectPath, projectName, originalProjectName, options.bundleId, architecture);

                const packageManager = detectPackageManager(projectPath, options.useNpm, architecture);

                if (architecture === "zustand" && packageManager !== ZUSTAND_REQUIRED_PACKAGE_MANAGER) {
                    throw new Error("The Zustand template must be installed with pnpm.");
                }

                if (!options.skipInstall) {
                    dependencyInstallFailed = !installDependencies({ packageManager, useNpm: options.useNpm });
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

                const runScript = (scriptName) =>
                    packageManager === "npm" ? `npm run ${scriptName}` : `${packageManager} ${scriptName}`;

                logSuccess(`\n✅ Project ${projectName} created successfully with ${selectedArch.name} architecture!`);
                logInfo("\n📝 Next steps:");
                console.log(`1. cd ${projectName}`);

                if (options.skipInstall) {
                    console.log("2. Install dependencies:");
                    console.log(`   - With ${packageManager}: ${packageManager} install`);
                    console.log(`3. Set up environment: ${runScript("env:setup")}`);
                    console.log(`4. Run the app: ${runScript("ios")} or ${runScript("android")}`);
                } else if (dependencyInstallFailed) {
                    console.log("2. Try installing dependencies again:");
                    console.log(`   - With ${packageManager}: ${packageManager} install`);
                    console.log("   - With npm: npm install --legacy-peer-deps");
                    console.log(`3. Run the app: ${runScript("ios")} or ${runScript("android")}`);
                } else {
                    console.log(`2. Run the app: ${runScript("ios")} or ${runScript("android")}`);
                }

                logInfo("\n📚 Documentation:");
                console.log("- React Native: https://reactnative.dev/docs/getting-started");

                selectedArch.documentation.forEach((doc) => {
                    console.log(`- ${doc.name}: ${doc.url}`);
                });

                console.log("- React Navigation: https://reactnavigation.org/docs/getting-started");
                console.log("- Expo: https://docs.expo.dev/get-started/installation/");
                console.log("- Expo CLI: https://docs.expo.dev/workflow/expo-cli/");

                logInfo("\n🐞 Troubleshooting:");
                console.log("- If you encounter issues with iOS, try: cd ios && pod install");
                console.log(
                    "- For Android issues, check your Android SDK setup and try: cd android && ./gradlew clean"
                );

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

function detectPackageManager(projectPath, useNpm = false, architecture = null) {
    if (architecture === "zustand") {
        return ZUSTAND_REQUIRED_PACKAGE_MANAGER;
    }

    if (useNpm) {
        return "npm";
    }

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

async function ensureZustandPackageManager() {
    if (commandExists(ZUSTAND_REQUIRED_PACKAGE_MANAGER)) {
        return;
    }

    logWarning("The Zustand template requires pnpm, but pnpm was not found.");

    const prompt = new Confirm({
        name: "enableCorepack",
        message: "Enable Corepack now so pnpm can be used?",
        initial: true
    });

    const shouldEnableCorepack = await prompt.run();

    if (!shouldEnableCorepack) {
        throw new Error("pnpm is required for the Zustand template. Run `corepack enable` and try again.");
    }

    try {
        execSync("corepack enable", { stdio: "inherit" });
    } catch (error) {
        throw new Error("Failed to enable Corepack. Install pnpm or run `corepack enable` manually.");
    }

    if (!commandExists(ZUSTAND_REQUIRED_PACKAGE_MANAGER)) {
        throw new Error("pnpm is still unavailable after enabling Corepack. Install pnpm and try again.");
    }
}
