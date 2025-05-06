#!/usr/bin/env node

const { program } = require("commander");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { Select } = require("enquirer");

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
    originalName: "NewReactNativeZustandRN",
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

let chalk;
(async () => {
    chalk = (await import("chalk")).default;

    program
        .name("create-rn-project")
        .description("Create a new React Native project from template")
        .argument('<project-directory>', 'Project name or name@branch')
        .option("-b, --bundle-id <id>", "Bundle identifier", "com.example.app")
        .option("-r, --repo <url>", "GitHub repository URL")
        .option("-a, --arch <architecture>", "Project architecture (redux, zustand)")
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

                if (!/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(projectName)) {
                    throw new Error(
                        'Invalid project name. Name must be in PascalCase:\n' +
                        '  • Start with uppercase letter\n' +
                        '  • Each word must start with uppercase\n' +
                        '  • All other letters must be lowercase\n' +
                        '  • No numbers or special characters\n\n' +
                        'Examples:\n' +
                        '  ✅ Good: MyApp, MyReactApp\n' +
                        '  ❌ Bad: myApp, MYAPP, myapp, My-App, MyApp1, my_app'
                    );
                }

                if (projectName.toLowerCase() === 'newreactnative' || 
                    projectName.toLowerCase() === 'new-react-native' ||
                    projectName.toLowerCase() === 'newreactnativezustandrn' ||
                    projectName.toLowerCase() === 'new-react-native-zustand-rn') {
                    throw new Error('Cannot use reserved template names');
                }


                if (!projectName.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
                    throw new Error('Project name must start with a letter and can only contain letters, numbers, dashes, and underscores');
                }

                let architecture = options.arch ? options.arch.toLowerCase() : null;
                
                if (!architecture) {
                    console.log();
                    logInfo("🏗️ Select an architecture for your project:");
                    
                    const archOptions = Object.keys(ARCHITECTURES).map(key => ({
                        name: key,
                        message: `${ARCHITECTURES[key].name} - ${ARCHITECTURES[key].description}`,
                        value: key
                    }));
                    
                    const prompt = new Select({
                        name: 'architecture',
                        message: 'Choose an architecture:',
                        choices: archOptions
                    });
                    
                    architecture = await prompt.run();
                    console.log();
                }

                if (!ARCHITECTURES[architecture]) {
                    throw new Error(`Invalid architecture "${architecture}". Available architectures: ${Object.keys(ARCHITECTURES).join(', ')}`);
                }

                const selectedArch = ARCHITECTURES[architecture];

                logInfo(`🔍 Validating inputs...`);
                logInfo(`  • Project Name: ${projectName}`);
                logInfo(`  • Branch: ${branchName}`);
                logInfo(`  • Architecture: ${selectedArch.name}`);
                console.log();

                logInfo(`🚀 Creating a new React Native project with ${selectedArch.name}`);
                logSuccess(`\n📦 Creating project ${projectName} from branch ${branchName}...`);

                const currentDir = process.cwd();
                const projectPath = path.join(currentDir, projectName);

                if (fs.existsSync(projectPath)) {
                    throw new Error(`Directory ${projectName} already exists`);
                }

                execSync(
                    `git clone -b ${branchName} ${selectedArch.repo} "${projectName}"`,
                    { stdio: "inherit", cwd: currentDir }
                );

                process.chdir(projectPath);

                process.env.BRANCH_NAME = branchName;
                process.env.ARCHITECTURE = architecture;

                const originalProjectName = selectedArch.originalName;
                setupNewProject(projectPath, projectName, originalProjectName, options.bundleId, architecture);

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

                logSuccess(`\n✅ Project ${projectName} created successfully with ${selectedArch.name} architecture!`);
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
                
                selectedArch.documentation.forEach(doc => {
                    console.log(`- ${doc.name}: ${doc.url}`);
                });
                
                console.log("- React Navigation: https://reactnavigation.org/docs/getting-started");
                console.log("- Expo: https://docs.expo.dev/get-started/installation/");
                console.log("- Expo CLI: https://docs.expo.dev/workflow/expo-cli/");

                logInfo("\n🐞 Troubleshooting:");
                console.log("- If you encounter issues with iOS, try: cd ios && pod install");
                console.log("- For Android issues, check your Android SDK setup and try: cd android && ./gradlew clean");
                
                const repoUrl = ARCHITECTURES[architecture]?.repo || "https://github.com/linhnguyen-gt/new-react-native";
                const issuesUrl = repoUrl.replace(/\.git$/, '') + "/issues";
                console.log(`- For more help, visit: ${issuesUrl}`);
                
                selectedArch.community.forEach(community => {
                    console.log(`- ${community.name}: ${community.url}`);
                });

            } catch (error) {
                logError("\n❌ Error creating project:", error);
                process.exit(1);
            }
        });

    program.parse();
})();
