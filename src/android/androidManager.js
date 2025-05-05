const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { replaceInFile } = require("../utils/fileUtils");
const { logSuccess, logWarning, logInfo, logStep, logError } = require("../utils/logUtils");

function updateAndroidFiles(projectDir, oldPackageId, newPackageId, projectName, architecture) {
    logStep("Updating Android files...");

    if (!/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(projectName)) {
        throw new Error(`Invalid Android project name "${projectName}". Name must be in PascalCase format (e.g., MyApp, MyReactApp).`);
    }

    if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(newPackageId)) {
        throw new Error(`Invalid Android package ID "${newPackageId}". Package ID must follow Java package naming conventions (e.g., com.example.myapp).`);
    }

    const androidSrcDir = path.join(projectDir, "android/app/src/main/java/com");
    
    let sourceDir = "newreactnative";
    if (architecture === "zustand") {
        sourceDir = "newreactnativezustandrnq";
    }
    
    const oldPath = path.join(androidSrcDir, sourceDir);
    
    const newPath = path.join(androidSrcDir, projectName.toLowerCase());

    logInfo(`Looking for Android source at: ${oldPath}`);

    if (fs.existsSync(oldPath)) {
        try {
            fs.mkdirSync(newPath, { recursive: true });
            logSuccess(`Created new package directory: ${newPath}`);

            const files = fs.readdirSync(oldPath);
            for (const file of files) {
                if (!file.endsWith(".kt")) {
                    continue;
                }
                
                const srcFile = path.join(oldPath, file);
                const destFile = path.join(newPath, file);

                fs.copyFileSync(srcFile, destFile);

                replaceInFile(
                    destFile, 
                    /package\s+com\.[a-zA-Z0-9._]+/g,
                    `package com.${projectName.toLowerCase()}`
                );
                
                replaceInFile(destFile, new RegExp(oldPackageId, "g"), newPackageId);
                
                replaceInFile(destFile, /zustandrnq/gi, "");

                const baseFileName = path.basename(file, path.extname(file));
                if (baseFileName === "MainActivity") {
                    replaceInFile(
                        destFile,
                        /getMainComponentName\(\)\s*=\s*"[^"]+"/g,
                        `getMainComponentName() = "${projectName}"`
                    );
                    logSuccess(`Updated ${file}`);
                }
            }

            fs.rmSync(oldPath, { recursive: true, force: true });
            logSuccess(`Android package renamed`);

            const buildGradlePath = path.join(projectDir, "android/app/build.gradle");
            if (fs.existsSync(buildGradlePath)) {
                let content = fs.readFileSync(buildGradlePath, "utf8");
                
                if (!content.includes("kotlin-android")) {
                    content = content.replace(
                        /apply plugin: "com.android.application"/,
                        'apply plugin: "com.android.application"\napply plugin: "kotlin-android"'
                    );
                }
                
                content = content.replace(/zustandrnq/gi, "");
                
                const baseAppId = `com.${projectName.toLowerCase()}`;
                const lines = content.split('\n');
                let inDevFlavor = false;
                let inStagingFlavor = false;
                let inProductionFlavor = false;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    if (line === 'dev {' || (line.startsWith('dev') && line.includes('{'))) {
                        inDevFlavor = true;
                        inStagingFlavor = false;
                        inProductionFlavor = false;
                    } else if (line === 'staging {' || (line.startsWith('staging') && line.includes('{'))) {
                        inDevFlavor = false;
                        inStagingFlavor = true; 
                        inProductionFlavor = false;
                    } else if (line === 'production {' || (line.startsWith('production') && line.includes('{'))) {
                        inDevFlavor = false;
                        inStagingFlavor = false;
                        inProductionFlavor = true;
                    } else if (line === '}') {
                        inDevFlavor = false;
                        inStagingFlavor = false;
                        inProductionFlavor = false;
                    }
                    
                    if (line.includes('applicationId')) {
                        if (inDevFlavor) {
                            lines[i] = lines[i].replace(/applicationId ['"][^'"]+['"]/g, `applicationId '${baseAppId}'`);
                        } else if (inStagingFlavor) {
                            lines[i] = lines[i].replace(/applicationId ['"][^'"]+['"]/g, `applicationId '${baseAppId}.stg'`);
                        } else if (inProductionFlavor) {
                            lines[i] = lines[i].replace(/applicationId ['"][^'"]+['"]/g, `applicationId '${baseAppId}.prod'`);
                        }
                    }
                    
                    if (line.includes('resValue') && line.includes('build_config_package')) {
                        if (inDevFlavor) {
                            lines[i] = lines[i].replace(/resValue ['"]string['"],\s*['"]build_config_package['"],\s*['"][^'"]+['"]/g, 
                                `resValue 'string', 'build_config_package', '${baseAppId}'`);
                        } else if (inStagingFlavor) {
                            lines[i] = lines[i].replace(/resValue ['"]string['"],\s*['"]build_config_package['"],\s*['"][^'"]+['"]/g, 
                                `resValue 'string', 'build_config_package', '${baseAppId}.stg'`);
                        } else if (inProductionFlavor) {
                            lines[i] = lines[i].replace(/resValue ['"]string['"],\s*['"]build_config_package['"],\s*['"][^'"]+['"]/g, 
                                `resValue 'string', 'build_config_package', '${baseAppId}.prod'`);
                        }
                    }
                }
                
                content = lines.join('\n');
                
                fs.writeFileSync(buildGradlePath, content);
                logSuccess("Updated build.gradle with all environment configurations");
                
                logInfo(`Application ID (dev): ${baseAppId}`);
                logInfo(`Application ID (staging): ${baseAppId}.stg`);
                logInfo(`Application ID (production): ${baseAppId}.prod`);
            }

            const projectBuildGradlePath = path.join(projectDir, "android/build.gradle");
            if (fs.existsSync(projectBuildGradlePath)) {
                let content = fs.readFileSync(projectBuildGradlePath, "utf8");
                
                if (!content.includes("kotlin_version")) {
                    const kotlinVersionDefinition = 
                        'ext {\n' +
                        '        kotlin_version = "1.8.10"\n' +
                        '    }';
                    
                    content = content.replace(
                        /buildscript\s*{/,
                        'buildscript {\n    ' + kotlinVersionDefinition
                    );
                }
                
                if (!content.includes("kotlin-gradle-plugin")) {
                    content = content.replace(
                        /dependencies\s*{/,
                        'dependencies {\n        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"'
                    );
                }
                
                fs.writeFileSync(projectBuildGradlePath, content);
                logSuccess("Updated project build.gradle with Kotlin support");
            }

            const manifestPath = path.join(projectDir, "android/app/src/main/AndroidManifest.xml");
            if (fs.existsSync(manifestPath)) {
                let content = fs.readFileSync(manifestPath, "utf8");
                
                content = content.replace(/zustandrnq/gi, "");
                
                content = content.replace(
                    /package="[^"]+"/g,
                    `package="com.${projectName.toLowerCase()}"`
                );
                
                fs.writeFileSync(manifestPath, content);
                logSuccess("Updated AndroidManifest.xml");
            }

            const stringsPath = path.join(projectDir, "android/app/src/main/res/values/strings.xml");
            if (fs.existsSync(stringsPath)) {
                replaceInFile(
                    stringsPath,
                    /<string name="app_name">[^<]+<\/string>/,
                    `<string name="app_name">${projectName}</string>`
                );
                logSuccess("Updated strings.xml");
            }

            const settingsPath = path.join(projectDir, "android/settings.gradle");
            if (fs.existsSync(settingsPath)) {
                let content = fs.readFileSync(settingsPath, "utf8");
                
                content = content.replace(/zustandrnq/gi, "");
                
                fs.writeFileSync(settingsPath, content);
                logSuccess("Updated settings.gradle");
            }

        } catch (error) {
            logError("Error updating Android files", error);
            throw error;
        }
    } else {
        logWarning(`Android source directory not found: ${oldPath}`);
    }
}

module.exports = {
    updateAndroidFiles
};