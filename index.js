#!/usr/bin/env node

const { program } = require("commander");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const { logSuccess, logError, logWarning, logInfo } = require("./src/utils/logUtils");
const { setupNewProject, cleanupProject } = require("./src/project/projectManager");
const { installDependencies, setupEnvironment } = require("./src/project/dependencyManager");
const { initializeGit, setupGitRemote } = require("./src/project/gitManager");

let chalk;
(async () => {
    chalk = (await import("chalk")).default;

    program
        .name("create-rn-with-redux-project")
        .description("Create a new React Native project from template")
        .argument('<project-directory>', 'Project name or name@branch')
        .option("-b, --bundle-id <id>", "Bundle identifier", "com.example.app")
        .option("-r, --repo <url>", "GitHub repository URL")
        .option("--skip-install", "Skip installing dependencies")
        .option("--use-npm", "Use npm instead of yarn for installing dependencies")
        .option("--skip-env-setup", "Skip environment setup")
        .option("--skip-git", "Skip git initialization")
        .action(async (projectDirectory, options) => {
            let projectName, branchName;
            let dependencyInstallFailed = false;
            
            try {
                if (!projectDirectory) {
                    throw new Error('Project name is required');
                }

                projectDirectory = projectDirectory.trim();

                if (projectDirectory.includes('@')) {
                    [projectName, branchName] = projectDirectory.split('@').map(part => part.trim());

                    if (!projectName) {
                        throw new Error('Project name cannot be empty when using @branch syntax');
                    }
                    if (!branchName) {
                        throw new Error('Branch name cannot be empty when using @branch syntax');
                    }
                    if (!branchName.match(/^(main|rn-\d+\.\d+\.\d+|rn-\d+\.\d+\.xx)$/)) {
                        throw new Error('Invalid branch format. Must be "main" or "rn-X.Y.Z" or "rn-X.Y.xx"');
                    }
                } else {
                    projectName = projectDirectory;
                    branchName = 'main';
                }

                if (projectName.toLowerCase() === 'newreactnative' || 
                    projectName.toLowerCase() === 'new-react-native') {
                    throw new Error('Cannot use reserved name "NewReactNative" or its variations');
                }

                if (!projectName.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
                    throw new Error('Project name must start with a letter and can only contain letters, numbers, dashes, and underscores');
                }

                logInfo(`🔍 Validating inputs...`);
                logInfo(`  • Project Name: ${projectName}`);
                logInfo(`  • Branch: ${branchName}`);
                console.log();

                logInfo("🚀 Creating a new React Native project from template");
                logSuccess(`\n📦 Creating project ${projectName} from branch ${branchName}...`);

                const currentDir = process.cwd();
                const projectPath = path.join(currentDir, projectName);

                if (fs.existsSync(projectPath)) {
                    throw new Error(`Directory ${projectName} already exists`);
                }

                execSync(
                    `git clone -b ${branchName} https://github.com/linhnguyen-gt/new-react-native.git "${projectName}"`,
                    { stdio: "inherit", cwd: currentDir }
                );

                process.chdir(projectPath);

                process.env.BRANCH_NAME = branchName;

                setupNewProject(projectPath, projectName, "NewReactNative", options.bundleId);

                if (!options.skipInstall) {
                    dependencyInstallFailed = !installDependencies(options.useNpm);
                }

                if (!options.skipEnvSetup) {
                    setupEnvironment();
                }

                if (!options.skipGit) {
                    if (initializeGit() && options.repo) {
                        setupGitRemote(options.repo);
                    }
                }

                cleanupProject(projectPath);

                logSuccess(`\n✅ Project ${projectName} created successfully!`);
                logInfo("\n📝 Next steps:");
                console.log(`1. cd ${projectName}`);

                if (options.skipInstall) {
                    console.log("2. Install dependencies:");
                    console.log("   - With yarn: yarn install");
                    console.log("   - With npm: npm install");
                    console.log("3. Set up environment: yarn env:setup");
                    console.log("4. Run the app: yarn ios or yarn android");
                } else if (dependencyInstallFailed) {
                    console.log("2. Try installing dependencies again:");
                    console.log("   - With yarn: yarn install --network-timeout 600000");
                    console.log("   - With npm: npm install --legacy-peer-deps");
                    console.log("3. Run the app: yarn ios or yarn android");
                } else {
                    console.log("2. Run the app: yarn ios or yarn android");
                }

                logInfo("\n📚 Documentation:");
                console.log("- React Native: https://reactnative.dev/docs/getting-started");
                console.log("- Redux Toolkit: https://redux-toolkit.js.org/introduction/getting-started");
                console.log("- React Navigation: https://reactnavigation.org/docs/getting-started");
                console.log("- Expo: https://docs.expo.dev/get-started/installation/");
                console.log("- Expo CLI: https://docs.expo.dev/workflow/expo-cli/");

                logInfo("\n🐞 Troubleshooting:");
                console.log("- If you encounter issues with iOS, try: cd ios && pod install");
                console.log("- For Android issues, check your Android SDK setup and try: cd android && ./gradlew clean");
                console.log("- For more help, visit: https://github.com/linhnguyen-gt/new-react-native/issues");

            } catch (error) {
                logError("\n❌ Error creating project:", error);
                process.exit(1);
            }
        });

    program.parse();
})();
