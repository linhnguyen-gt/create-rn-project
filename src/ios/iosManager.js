const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { replaceInFile } = require("../utils/fileUtils");
const { logSuccess, logWarning, logInfo, logStep } = require("../utils/logUtils");
const { updateIOSSchemes } = require("./schemeManager");

function updateIOSProjectFiles(projectDir, oldName, newName) {
    logStep("Updating iOS project files...");

    const iosDir = path.join(projectDir, "ios");

    if (!fs.existsSync(iosDir)) {
        logWarning(`iOS directory not found: ${iosDir}`);
        return;
    }

    // Handle directory renames
    if (fs.existsSync(`${iosDir}/${oldName}`)) {
        execSync(`mv ${iosDir}/${oldName} ${iosDir}/${newName}`, { stdio: "inherit" });
    }
    if (fs.existsSync(`${iosDir}/${oldName}-Staging`)) {
        execSync(`mv ${iosDir}/${oldName}-Staging ${iosDir}/${newName}-Staging`, { stdio: "inherit" });
    }
    if (fs.existsSync(`${iosDir}/${oldName}-Production`)) {
        execSync(`mv ${iosDir}/${oldName}-Production ${iosDir}/${newName}-Production`, { stdio: "inherit" });
    }

    if (fs.existsSync(`${iosDir}/${oldName}.xcodeproj`)) {
        execSync(`mv ${iosDir}/${oldName}.xcodeproj ${iosDir}/${newName}.xcodeproj`, { stdio: "inherit" });
    }
    if (fs.existsSync(`${iosDir}/${oldName}.xcworkspace`)) {
        execSync(`mv ${iosDir}/${oldName}.xcworkspace ${iosDir}/${newName}.xcworkspace`, { stdio: "inherit" });
    }

    // Update project.pbxproj for all environments
    const pbxprojPath = path.join(iosDir, `${newName}.xcodeproj/project.pbxproj`);
    if (fs.existsSync(pbxprojPath)) {
        let content = fs.readFileSync(pbxprojPath, "utf8");
        
        // Update dev bundle ID
        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}";`
        );

        // Update staging bundle ID
        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.stg";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.stg";`
        );

        // Update production bundle ID
        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.pro";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.pro";`
        );

        fs.writeFileSync(pbxprojPath, content);
        logSuccess("Updated project.pbxproj with all environment configurations");
    }

    // Update Info.plist
    const infoPlistPath = path.join(iosDir, `${newName}/Info.plist`);
    if (fs.existsSync(infoPlistPath)) {
        replaceInFile(
            infoPlistPath,
            /<string>org\.reactjs\.native\.example\.[^<]+<\/string>/g,
            `<string>${newName.toLowerCase()}</string>`
        );
        logSuccess("Updated Info.plist");
    }

    // Update AppDelegate.swift
    const appDelegatePath = path.join(iosDir, newName, "AppDelegate.swift");
    if (fs.existsSync(appDelegatePath)) {
        const branchName = process.env.BRANCH_NAME;
        const isRN079OrHigher = branchName && (branchName.startsWith('rn-0.79') || branchName.startsWith('rn-0.8'));
        
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

    // Update Podfile
    const podfilePath = path.join(iosDir, "Podfile");
    if (fs.existsSync(podfilePath)) {
        logStep("Updating Podfile...");
        replaceInFile(podfilePath, new RegExp(`project '${oldName}'`, 'g'), `project '${newName}'`);
        replaceInFile(podfilePath, new RegExp(`target '${oldName}'`, 'g'), `target '${newName}'`);
        replaceInFile(podfilePath, new RegExp(`target '${oldName}-Staging'`, 'g'), `target '${newName}-Staging'`);
        replaceInFile(podfilePath, new RegExp(`target '${oldName}-Production'`, 'g'), `target '${newName}-Production'`);
        replaceInFile(podfilePath, new RegExp(`if target\\.name == '${oldName}'`, 'g'), `if target.name == '${newName}'`);
        logSuccess("Podfile updated successfully");
    }

    // Update schemes
    updateIOSSchemes(projectDir, oldName, newName);

    const podsDir = path.join(iosDir, "Pods");
    if (fs.existsSync(podsDir)) {
        const fileExtensions = [".xcscheme", ".xcconfig", ".xcworkspacedata", ".pbxproj", ".plist"];
        for (const ext of fileExtensions) {
            const files = fs.readdirSync(podsDir).filter(file => file.endsWith(ext));
            for (const file of files) {
                const filePath = path.join(podsDir, file);
                replaceInFile(filePath, new RegExp(oldName, "g"), newName);
            }
        }
        logSuccess("Updated Pods directory");
    }

    logSuccess("All iOS files updated successfully");
}

module.exports = {
    updateIOSProjectFiles
};