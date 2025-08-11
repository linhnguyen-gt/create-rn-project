const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { replaceInFile } = require("../utils/fileUtils");
const { logSuccess, logWarning, logStep, logError } = require("../utils/logUtils");
const { updateIOSSchemes } = require("./schemeManager");

const TEMPLATE_NAMES = {
    redux: "NewReactNative",
    zustand: "NewReactNativeZustandRNQ"
};

function updateIOSProjectFiles(projectDir, oldName, newName, newPackageId, architecture) {
    logStep("Updating iOS project files...");

    if (!/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(newName)) {
        throw new Error(`Invalid iOS project name "${newName}". Name must be in PascalCase format (e.g., MyApp, MyReactApp).`);
    }

    const iosDir = path.join(projectDir, "ios");

    if (!fs.existsSync(iosDir)) {
        logWarning(`iOS directory not found: ${iosDir}`);
        return;
    }
    
    let originalOldName = oldName;
    if (architecture && TEMPLATE_NAMES[architecture]) {
        originalOldName = TEMPLATE_NAMES[architecture];
    }
    
    const possibleOldDirs = [originalOldName];
    if (originalOldName !== oldName) {
        possibleOldDirs.push(oldName);
    }

    for (const oldDir of possibleOldDirs) {
        if (fs.existsSync(`${iosDir}/${oldDir}`)) {
            execSync(`mv "${iosDir}/${oldDir}" "${iosDir}/${newName}"`, { stdio: "inherit" });
            break;
        }
    }

    for (const oldDir of possibleOldDirs) {
        if (fs.existsSync(`${iosDir}/${oldDir}-Staging`)) {
            execSync(`mv "${iosDir}/${oldDir}-Staging" "${iosDir}/${newName}-Staging"`, { stdio: "inherit" });
            break;
        }
    }

    for (const oldDir of possibleOldDirs) {
        if (fs.existsSync(`${iosDir}/${oldDir}-Production`)) {
            execSync(`mv "${iosDir}/${oldDir}-Production" "${iosDir}/${newName}-Production"`, { stdio: "inherit" });
            break;
        }
    }

    for (const oldDir of possibleOldDirs) {
        if (fs.existsSync(`${iosDir}/${oldDir}.xcodeproj`)) {
            execSync(`mv "${iosDir}/${oldDir}.xcodeproj" "${iosDir}/${newName}.xcodeproj"`, { stdio: "inherit" });
            break;
        }
    }

    for (const oldDir of possibleOldDirs) {
        if (fs.existsSync(`${iosDir}/${oldDir}.xcworkspace`)) {
            execSync(`mv "${iosDir}/${oldDir}.xcworkspace" "${iosDir}/${newName}.xcworkspace"`, { stdio: "inherit" });
            break;
        }
    }

    const pbxprojPath = path.join(iosDir, `${newName}.xcodeproj/project.pbxproj`);
    if (fs.existsSync(pbxprojPath)) {
        let content = fs.readFileSync(pbxprojPath, "utf8");
        
        for (const oldDir of possibleOldDirs) {
            content = content.replace(new RegExp(oldDir, 'g'), newName);
        }
        
        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.dev";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.dev";`
        );

        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.stg";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.stg";`
        );

        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.prod";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.prod";`
        );
        
        for (const oldDir of possibleOldDirs) {
            content = content.replace(
                new RegExp(`PRODUCT_NAME = ${oldDir};`, 'g'),
                `PRODUCT_NAME = ${newName};`
            );
        }

        content = content.replace(/ZustandRNQ/g, "");

        fs.writeFileSync(pbxprojPath, content);
        logSuccess("Updated project.pbxproj with all environment configurations");
    }

    const infoPlistPath = path.join(iosDir, `${newName}/Info.plist`);
    if (fs.existsSync(infoPlistPath)) {
        replaceInFile(
            infoPlistPath,
            /<string>org\.reactjs\.native\.example\.[^<]+<\/string>/g,
            `<string>${newName.toLowerCase()}</string>`
        );
        logSuccess("Updated Info.plist");
    }

    const appDelegatePath = path.join(iosDir, newName, "AppDelegate.swift");
    if (fs.existsSync(appDelegatePath)) {
        const branchName = process.env.BRANCH_NAME;
        const isRN079OrHigher = branchName && (branchName.startsWith('rn-0.79') || branchName.startsWith('rn-0.8'));
        
        for (const oldDir of possibleOldDirs) {
            replaceInFile(
                appDelegatePath,
                new RegExp(oldDir, 'g'),
                newName
            );
        }
        
        replaceInFile(
            appDelegatePath,
            /ZustandRNQ/g,
            ""
        );
        
        if (isRN079OrHigher) {
            replaceInFile(
                appDelegatePath,
                /withModuleName: "[^"]+"/g,
                `withModuleName: "${newName}"`
            );
        } else {
            replaceInFile(
                appDelegatePath,
                /self\.moduleName = "[^"]+"/g,
                `self.moduleName = "${newName}"`
            );
        }
        logSuccess("Updated AppDelegate.swift");
    }

    const podfilePath = path.join(iosDir, "Podfile");
    if (fs.existsSync(podfilePath)) {
        logStep("Updating Podfile...");
        
        let content = fs.readFileSync(podfilePath, "utf8");
        
        for (const oldDir of possibleOldDirs) {
            content = content.replace(new RegExp(`project '${oldDir}'`, 'g'), `project '${newName}'`);
            content = content.replace(new RegExp(`target '${oldDir}'`, 'g'), `target '${newName}'`);
            content = content.replace(new RegExp(`target '${oldDir}-Staging'`, 'g'), `target '${newName}-Staging'`);
            content = content.replace(new RegExp(`target '${oldDir}-Production'`, 'g'), `target '${newName}-Production'`);
            content = content.replace(new RegExp(`if target\\.name == '${oldDir}'`, 'g'), `if target.name == '${newName}'`);
        }
        
        content = content.replace(/ZustandRNQ/g, "");
        
        fs.writeFileSync(podfilePath, content);
        logSuccess("Podfile updated successfully");
    }

    updateIOSSchemes(projectDir, originalOldName, newName);

    const podsDir = path.join(iosDir, "Pods");
    if (fs.existsSync(podsDir)) {
        try {
            const fileExtensions = [".xcscheme", ".xcconfig", ".xcworkspacedata", ".pbxproj", ".plist"];
            const findPodFiles = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        findPodFiles(fullPath);
                    } else if (fileExtensions.some(ext => entry.name.endsWith(ext))) {
                        try {
                            let content = fs.readFileSync(fullPath, "utf8");
                            let modified = content;
                            
                            for (const oldDir of possibleOldDirs) {
                                modified = modified.replace(new RegExp(oldDir, 'g'), newName);
                            }
                            
                            modified = modified.replace(/ZustandRNQ/g, "");
                            
                            if (content !== modified) {
                                fs.writeFileSync(fullPath, modified);
                            }
                        } catch (error) {
                        }
                    }
                }
            };
            
            findPodFiles(podsDir);
            logSuccess("Updated Pods directory");
        } catch (error) {
            logError(`Error updating Pods directory: ${error.message}`);
        }
    }

    try {        
        const searchAndReplaceZustandRNQ = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (fullPath.includes('node_modules') || fullPath.includes('.git')) {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    searchAndReplaceZustandRNQ(fullPath);
                } else {
                    const textFileExtensions = [
                        '.h', '.m', '.swift', '.plist', '.pbxproj', '.xcscheme',
                        '.xcsettings', '.xcconfig', '.storyboard', '.xib', '.json',
                        '.strings', '.entitlements', '.xcworkspacedata', '.podspec'
                    ];
                    
                    if (textFileExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
                        try {
                            let content = fs.readFileSync(fullPath, "utf8");
                            
                            if (content.includes("ZustandRNQ")) {
                                const modifiedContent = content.replace(/ZustandRNQ/g, "");
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
        
        searchAndReplaceZustandRNQ(iosDir);
    } catch (error) {
        logError(`Error during deep scan: ${error.message}`);
    }

    logSuccess("All iOS files updated successfully");
}

module.exports = {
    updateIOSProjectFiles
};