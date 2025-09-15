const fs = require("fs");
const path = require("path");
const { replaceInFile } = require("../utils/fileUtils");
const { logSuccess, logWarning, logInfo, logStep, logError } = require("../utils/logUtils");

const TEMPLATE_SOURCES = {
    redux: "newreactnative",
    zustand: "newreactnativezustandrnq"
};

function updateAndroidFiles(projectDir, oldPackageId, newPackageId, projectName, architecture) {
    logStep("Updating Android files...");

    if (!/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(projectName)) {
        throw new Error(`Invalid Android project name "${projectName}". Name must be in PascalCase format (e.g., MyApp, MyReactApp).`);
    }

    if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(newPackageId)) {
        throw new Error(`Invalid Android package ID "${newPackageId}". Package ID must follow Java package naming conventions (e.g., com.example.myapp).`);
    }

    const androidSrcDir = path.join(projectDir, "android/app/src/main/java/com");
    
    const sourceDir = TEMPLATE_SOURCES[architecture] || TEMPLATE_SOURCES.redux;
    
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
                
                content = content.replace(
                    /namespace\s+["'][^"']*zustandrnq[^"']*["']/gi,
                    `namespace "com.${projectName.toLowerCase()}"`
                );
                
                content = content.replace(
                    /namespace\s+["'][^"']*["']/gi,
                    `namespace "com.${projectName.toLowerCase()}"`
                );

                content = content.replace(
                    /applicationId\s+["'][^"']*["']/gi,
                    `applicationId "com.${projectName.toLowerCase()}"`
                );
                
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
                                `resValue 'string', 'build_config_package', '${baseAppId}'`);
                        } else if (inProductionFlavor) {
                            lines[i] = lines[i].replace(/resValue ['"]string['"],\s*['"]build_config_package['"],\s*['"][^'"]+['"]/g, 
                                `resValue 'string', 'build_config_package', '${baseAppId}'`);
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

            const manifestPath = path.join(projectDir, "android/app/src/main/AndroidManifest.xml");
            if (fs.existsSync(manifestPath)) {
                let content = fs.readFileSync(manifestPath, "utf8");
                
                content = content.replace(
                    /package="[^"]+"/g,
                    `package="com.${projectName.toLowerCase()}"`
                );
                
                fs.writeFileSync(manifestPath, content);
                logSuccess("Updated AndroidManifest.xml");
            }

            const settingsPath = path.join(projectDir, "android/settings.gradle");
            if (fs.existsSync(settingsPath)) {
                let content = fs.readFileSync(settingsPath, "utf8");
                
                content = content.replace(
                    /rootProject\.name\s*=\s*['"][^'"]*['"]/g,
                    `rootProject.name = '${projectName}'`
                );
                
                fs.writeFileSync(settingsPath, content);
                logSuccess("Updated settings.gradle");
            }

            try {                
                const searchAndReplaceZustandRNQ = (dir) => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        
                        if (fullPath.includes('node_modules') || fullPath.includes('.git') || 
                            fullPath.includes('build') || fullPath.includes('.gradle')) {
                            continue;
                        }
                        
                        if (entry.isDirectory()) {
                            searchAndReplaceZustandRNQ(fullPath);
                        } else {
                            const relevantExtensions = [
                                '.kt', '.java', '.xml', '.gradle', '.properties', 
                                '.json', '.pro', '.txt', '.md', '.yaml', '.yml'
                            ];
                            
                            if (relevantExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
                                try {
                                    let content = fs.readFileSync(fullPath, "utf8");
                                    
                                    if (content.toLowerCase().includes("zustandrnq")) {
                                        const modifiedContent = content
                                            .replace(/[Zz]ustandRNQ/g, "")
                                            .replace(/zustandrnq/gi, "");
                                            
                                        if (content !== modifiedContent) {
                                            fs.writeFileSync(fullPath, modifiedContent);
                                        }
                                    }
                                } catch (error) {
                                }
                            }
                        }
                    }
                };
                
                const androidDir = path.join(projectDir, "android");
                searchAndReplaceZustandRNQ(androidDir);
            } catch (error) {
                logError(`Error during deep scan: ${error.message}`);
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