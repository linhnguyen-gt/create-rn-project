const fs = require("fs");
const path = require("path");
const { logSuccess, logError, logInfo, logStep } = require("../utils/logUtils");
const { updateAndroidFiles } = require("../android/androidManager");
const { updateIOSProjectFiles } = require("../ios/iosManager");
const { findAndReplaceInDirectory } = require("../utils/fileUtils");
const { assertValidProjectName } = require("../utils/project-name");
const { assertValidBundleId } = require("../utils/bundle-id");

const TEMPLATE_PACKAGE_IDS = {
    redux: "com.newreactnative",
    zustand: "com.newreactnativezustandrnq"
};

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updateTemplateIdentifiers(projectDir, oldName, projectName, oldPackageId, newPackageId, architecture) {
    const fileExtensions = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".kt",
        ".swift",
        ".m",
        ".h",
        ".gradle",
        ".pbxproj",
        ".plist",
        ".xml",
        ".yaml",
        ".yml",
        ".xcscheme",
        ".xcworkspacedata",
        ".storyboard",
        ".xib",
        ".podspec",
        ".json",
        ".md",
        ".cjs",
        // Both templates ship `scripts/lib/*.d.cts` sidecars so TypeScript can type the
        // CommonJS module that holds the identifiers.
        ".cts"
    ];

    if (architecture === "zustand") {
        findAndReplaceInDirectory(
            projectDir,
            new RegExp(escapeRegExp(oldPackageId), "g"),
            newPackageId,
            fileExtensions
        );
        findAndReplaceInDirectory(projectDir, new RegExp(escapeRegExp(oldName), "g"), projectName, fileExtensions);
        findAndReplaceInDirectory(
            projectDir,
            new RegExp(escapeRegExp(oldName.toLowerCase()), "g"),
            projectName.toLowerCase(),
            fileExtensions
        );
        findAndReplaceInDirectory(projectDir, /new-react-native-zustand-react-query/g, projectName, fileExtensions);
        return;
    }

    // Package id before bare name. `com.newreactnative` contains `newreactnative`, so
    // replacing the bare name first leaves nothing for the package-id pattern to match and
    // --bundle-id is silently dropped — the project builds, with the wrong identifier.
    findAndReplaceInDirectory(projectDir, new RegExp(escapeRegExp(oldPackageId), "g"), newPackageId, fileExtensions);
    findAndReplaceInDirectory(projectDir, /NewReactNative/g, projectName, fileExtensions);
    findAndReplaceInDirectory(projectDir, /newreactnative/g, projectName.toLowerCase(), fileExtensions);
}

/**
 * Whether the template ships native projects in git, as opposed to generating them.
 *
 * Under Continuous Native Generation `ios/` and `android/` are gitignored build output, so a
 * fresh clone has neither and the rename machinery has nothing to act on.
 */
function hasCommittedNativeProjects(projectDir) {
    return fs.existsSync(path.join(projectDir, "ios")) || fs.existsSync(path.join(projectDir, "android"));
}

function setupNewProject(projectDir, projectName, oldName, bundleId, architecture) {
    logStep("Setting up new project...");

    try {
        // Validated here, not only inside the native renamers. Those are skipped entirely for
        // a Continuous Native Generation template, which left the only check on that path
        // being the CLI's own argument parsing — so any other caller could generate a project
        // with an unusable name and see nothing go wrong.
        assertValidProjectName(projectName);

        const baseAppId = `com.${projectName.toLowerCase()}`;
        const basePackageId = bundleId || baseAppId;

        // Same reason as the name above: `updateAndroidFiles` used to be the only thing
        // checking this, and it does not run for a Continuous Native Generation template. A
        // malformed `--bundle-id` was written straight into the generated project's config and
        // only surfaced at build time. The derived default cannot fail this — the name is
        // already PascalCase letters — so in practice it guards the `--bundle-id` path.
        assertValidBundleId(basePackageId);

        const packageJsonPath = path.join(projectDir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

                // Only the name. Both templates launch through a script that reads the
                // variant table, so no `--app-id` literal survives in `scripts` for the CLI
                // to rewrite.
                packageJson.name = projectName;

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

                // Bundle identifiers deliberately not written here. Both templates reduced
                // app.json to `{ name }` and moved identity into scripts/lib/variant-config.cjs,
                // which the generic replacement covers. Writing them back would recreate the
                // second source of truth the templates just removed.

                fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
                logSuccess("Updated app.json");
            } catch (error) {
                logError("Error updating app.json", error);
            }
        }

        const oldPackageId = TEMPLATE_PACKAGE_IDS[architecture] || TEMPLATE_PACKAGE_IDS.redux;
        updateTemplateIdentifiers(projectDir, oldName, projectName, oldPackageId, basePackageId, architecture);

        // Continuous Native Generation templates ship no ios/ or android/ — they are produced
        // by `expo prebuild` at build time, so there is nothing to rename yet. Detecting this
        // beats keying on the architecture name: either template may adopt CNG later, and
        // guessing wrong fails silently, shipping a project full of template identifiers.
        if (hasCommittedNativeProjects(projectDir)) {
            logStep("Updating Android configuration...");
            updateAndroidFiles(projectDir, oldPackageId, basePackageId, projectName, architecture);

            logStep("Updating iOS configuration...");
            updateIOSProjectFiles(projectDir, oldName, projectName, basePackageId, architecture);
        } else {
            logInfo("No native projects to rename — they are generated by `expo prebuild`.");
        }

        updateReadmeFile(projectDir, projectName, architecture);

        logSuccess("Project setup completed successfully");
    } catch (error) {
        // Rethrow rather than returning a status nobody checked.
        //
        // This used to `return false`, and the only caller discarded it — so a throw from the
        // iOS or Android rename skipped every remaining step and generation still ran on to
        // install, cleanup and a green success banner, leaving a half-renamed project that
        // looked fine. A partially set-up project is not a project.
        logError("Error setting up project", error);
        throw error;
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
                        replace: `applicationId 'com.${projectName.toLowerCase()}'`
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
                        replace: `--app-id com.${projectName.toLowerCase()}`
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

    // Build caches and stray lockfiles a clone may carry.
    //
    // `.env.vault` stays even though both templates have dropped dotenv-vault: it is an
    // encrypted copy of the template author's environments, and deleting it here costs one
    // line while leaving it in a generated project ships someone else's secrets. A defensive
    // removal is worth keeping past the point where the template stopped producing it.
    const tempDirsToRemove = [
        ".expo-shared",
        ".expo",
        "expo-debug.log",
        "npm-debug.log",
        "yarn-debug.log",
        "yarn-error.log",
        ".env.vault",
        "package-lock.json"
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
