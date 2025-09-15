const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { logSuccess, logError, logWarning, logStep } = require("../utils/logUtils");
const { updateAndroidFiles } = require("../android/androidManager");
const { updateIOSProjectFiles } = require("../ios/iosManager");
const { findAndReplaceInDirectory } = require("../utils/fileUtils");

const TEMPLATE_PACKAGE_IDS = {
    redux: "com.newreactnative",
    zustand: "com.newreactnativezustandrnq"
};

function setupNewProject(projectDir, projectName, oldName, bundleId, architecture) {
    logStep("Setting up new project...");

    try {
        const baseAppId = `com.${projectName.toLowerCase()}`;
        
        const packageJsonPath = path.join(projectDir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
                
                packageJson.name = projectName;
                
                if (packageJson.scripts) {
                    const oldAppId = TEMPLATE_PACKAGE_IDS[architecture] || TEMPLATE_PACKAGE_IDS.redux;
                    
                    if (packageJson.scripts.android) {
                        packageJson.scripts.android = packageJson.scripts.android
                            .replace(new RegExp(oldAppId, 'g'), baseAppId);
                    }
                    
                    if (packageJson.scripts["android:stg"]) {
                        packageJson.scripts["android:stg"] = packageJson.scripts["android:stg"]
                            .replace(new RegExp(`${oldAppId}\\.stg`, 'g'), `${baseAppId}.stg`);
                    }
                    
                    if (packageJson.scripts["android:prod"]) {
                        packageJson.scripts["android:prod"] = packageJson.scripts["android:prod"]
                            .replace(new RegExp(`${oldAppId}\\.production`, 'g'), `${baseAppId}.prod`);
                    }
                }
                
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                logSuccess("Updated package.json");
            } catch (error) {
                logError("Error updating package.json", error);
            }
        }

        const appJsonPath = path.join(projectDir, "app.json");
        if (fs.existsSync(appJsonPath)) {
            try {
                const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
                
                appJson.name = projectName;
                
                if (appJson.displayName) {
                    appJson.displayName = projectName;
                }
                if(appJson.ios) {
                   appJson.ios.bundleIdentifier = 'com.' + projectName.toLowerCase();
                }
                if(appJson.android) {
                    appJson.android.package = 'com.' + projectName.toLowerCase();
                }
                
                fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
                logSuccess("Updated app.json");
            } catch (error) {
                logError("Error updating app.json", error);
            }
        }

        const fileExtensions = [
            ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".swift",
            ".m", ".h", ".gradle", ".pbxproj", ".plist", ".xml",
            ".yaml", ".yml", ".xcscheme", ".xcworkspacedata",
            ".storyboard", ".xib", ".podspec"
        ];

    
        findAndReplaceInDirectory(projectDir, /NewReactNative/g, projectName, fileExtensions);
        findAndReplaceInDirectory(projectDir, /newreactnative/g, projectName.toLowerCase(), fileExtensions);

        const baseAndroidId = bundleId || baseAppId;
        const baseIosId = bundleId || projectName.toLowerCase();

        const oldPackageId = TEMPLATE_PACKAGE_IDS[architecture] || TEMPLATE_PACKAGE_IDS.redux;

        logStep("Updating Android configuration...");
        updateAndroidFiles(projectDir, oldPackageId, baseAndroidId, projectName, architecture);

        logStep("Updating iOS configuration...");
        updateIOSProjectFiles(projectDir, oldName, projectName, baseIosId, architecture);

        updateReadmeFile(projectDir, projectName, architecture);

        logSuccess("Project setup completed successfully");
        return true;
    } catch (error) {
        logError("Error setting up project", error);
        return false;
    }
}

function updateReadmeFile(projectDir, projectName, architecture) {
    logStep("Updating README.md...");
    const readmePath = path.join(projectDir, "README.md");
    
    if (fs.existsSync(readmePath)) {
        try {
            let content = fs.readFileSync(readmePath, "utf8");
            
            const patterns = {
                zustand: [
                    {
                        find: /<h1>🚀 React Native Modern Architecture<\/h1>/,
                        replace: `<h1>🚀 ${projectName}</h1>`
                    },
                    {
                        find: /<p>A modern React Native boilerplate with Zustand, React Query and best practices<\/p>/,
                        replace: `<p>A modern React Native project built with Zustand and React Query</p>`
                    },
                    {
                        find: /<p><strong>Create a new project using our CLI:.*?<\/p>/,
                        replace: ``
                    },
                    {
                        find: /# 🚀 React Native Modern Architecture/,
                        replace: `# 🚀 ${projectName}`
                    },
                    {
                        find: /### Clone the repository\\\*\\*\s*```bash\s*git clone https:\/\/github\.com\/linhnguyen-gt\/new-react-native-zustand-react-query\s*cd new-react-native-zustand-react-query\s*```/g,
                        replace: ``
                    },
                    {
                        find: /project\s+'NewReactNativeZustandRNQ'/g,
                        replace: `project '${projectName}'`
                    },
                    {
                        find: /applicationId 'com\.newreactnativezustandrnq'/g,
                        replace: `applicationId 'com.${projectName.toLowerCase()}'`
                    },
                    {
                        find: /resValue 'string', 'build_config_package', 'com\.newreactnativezustandrnq'/g,
                        replace: `resValue 'string', 'build_config_package', 'com.${projectName.toLowerCase()}'`
                    },
                    {
                        find: /applicationId 'com\.newreactnativezustandrnq\.stg'/g,
                        replace: `applicationId 'com.${projectName.toLowerCase()}.stg'`
                    },
                    {
                        find: /applicationId 'com\.newreactnativezustandrnq\.production'/g,
                        replace: `applicationId 'com.${projectName.toLowerCase()}.production'`
                    },
                    {
                        find: /--app-id com\.newreactnativezustandrnq/g,
                        replace: `--app-id com.${projectName.toLowerCase()}`
                    },
                    {
                        find: /--app-id com\.newreactnativezustandrnq\.stg/g,
                        replace: `--app-id com.${projectName.toLowerCase()}.stg`
                    },
                    {
                        find: /--app-id com\.newreactnativezustandrnq\.production/g,
                        replace: `--app-id com.${projectName.toLowerCase()}.production`
                    }
                ],
                redux: [
                    {
                        find: /<h1>🚀 New React Native Project<\/h1>/,
                        replace: `<h1>🚀 ${projectName} Project</h1>`
                    },
                    {
                        find: /### Clone the repository\\\*\\*\s*```bash\s*git clone https:\/\/github\.com\/linhnguyen-gt\/new-react-native\s*cd new-react-native\s*```/g,
                        replace: ``
                    },
                    {
                        find: /project\s+'NewReactNative'/g,
                        replace: `project '${projectName}'`
                    },
                    // Replace old package names in Android Configuration for Redux template
                    {
                        find: /applicationId 'com\.newreactnative'/g,
                        replace: `applicationId 'com.${projectName.toLowerCase()}'`
                    },
                    {
                        find: /resValue 'string', 'build_config_package', 'com\.newreactnative'/g,
                        replace: `resValue 'string', 'build_config_package', 'com.${projectName.toLowerCase()}'`
                    },
                    {
                        find: /applicationId 'com\.newreactnative\.stg'/g,
                        replace: `applicationId 'com.${projectName.toLowerCase()}.stg'`
                    },
                    {
                        find: /applicationId 'com\.newreactnative\.production'/g,
                        replace: `applicationId 'com.${projectName.toLowerCase()}.production'`
                    },
                    // Replace old package names in package.json scripts for Redux template
                    {
                        find: /--app-id com\.newreactnative/g,
                        replace: `--app-id com.${projectName.toLowerCase()}`
                    },
                    {
                        find: /--app-id com\.newreactnative\.stg/g,
                        replace: `--app-id com.${projectName.toLowerCase()}.stg`
                    },
                    {
                        find: /--app-id com\.newreactnative\.production/g,
                        replace: `--app-id com.${projectName.toLowerCase()}.production`
                    }
                ]
            };
            
            const commonPatterns = [
                {
                    find: /### Clone the repository.*?git clone https:\/\/github\.com\/linhnguyen-gt\/[^\n]*\s*cd [^\n]*\s*```/gs,
                    replace: ``
                }
            ];
            
            const replacements = patterns[architecture] || patterns.redux;
            replacements.forEach(({ find, replace }) => {
                content = content.replace(find, replace);
            });
            
            commonPatterns.forEach(({ find, replace }) => {
                content = content.replace(find, replace);
            });
            
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
        ".serena",
        "expo-debug.log",
        "npm-debug.log",
        "yarn-debug.log",
        "yarn-error.log",
        ".env.vault",
        "create-rn-with-redux-project",
        "package-lock.json",
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