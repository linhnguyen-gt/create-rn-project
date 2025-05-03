const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { replaceInFile } = require("../utils/fileUtils");
const { logSuccess, logWarning, logInfo, logStep } = require("../utils/logUtils");
const { updateIOSSchemes } = require("./schemeManager");

function updateIOSProjectFiles(projectDir, oldName, newName) {
    logStep("Updating iOS project files...");

    if (!/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(newName)) {
        throw new Error(`Invalid iOS project name "${newName}". Name must be in PascalCase format (e.g., MyApp, MyReactApp).`);
    }

    const iosDir = path.join(projectDir, "ios");

    if (!fs.existsSync(iosDir)) {
        logWarning(`iOS directory not found: ${iosDir}`);
        return;
    }

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

    const pbxprojPath = path.join(iosDir, `${newName}.xcodeproj/project.pbxproj`);
    if (fs.existsSync(pbxprojPath)) {
        let content = fs.readFileSync(pbxprojPath, "utf8");
        
        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}";`
        );

        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.stg";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.stg";`
        );

        content = content.replace(
            /PRODUCT_BUNDLE_IDENTIFIER = "org\.reactjs\.native\.example\.[^"]+\.pro";/g,
            `PRODUCT_BUNDLE_IDENTIFIER = "${newName.toLowerCase()}.pro";`
        );

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
        replaceInFile(podfilePath, new RegExp(`project '${oldName}'`, 'g'), `project '${newName}'`);
        replaceInFile(podfilePath, new RegExp(`target '${oldName}'`, 'g'), `target '${newName}'`);
        replaceInFile(podfilePath, new RegExp(`target '${oldName}-Staging'`, 'g'), `target '${newName}-Staging'`);
        replaceInFile(podfilePath, new RegExp(`target '${oldName}-Production'`, 'g'), `target '${newName}-Production'`);
        replaceInFile(podfilePath, new RegExp(`if target\\.name == '${oldName}'`, 'g'), `if target.name == '${newName}'`);
        logSuccess("Podfile updated successfully");
    }

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