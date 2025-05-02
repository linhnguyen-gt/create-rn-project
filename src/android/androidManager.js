const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { replaceInFile } = require("../utils/fileUtils");
const { logSuccess, logWarning, logInfo, logStep } = require("../utils/logUtils");

function updateAndroidFiles(projectDir, oldPackageId, newPackageId, projectName) {
    logStep("Updating Android files...");

    const androidSrcDir = path.join(projectDir, "android/app/src/main/java/com");
    const oldPath = `${androidSrcDir}/newreactnative`;
    const packagePath = newPackageId.split(".").slice(1).join("/");
    const newPath = path.join(androidSrcDir, packagePath);

    if (fs.existsSync(oldPath)) {
        try {
            fs.mkdirSync(newPath, { recursive: true });
            logSuccess(`Created new package directory: ${newPath}`);

            // Copy and update Java/Kotlin files
            const files = fs.readdirSync(oldPath);
            for (const file of files) {
                const srcFile = path.join(oldPath, file);
                const destFile = path.join(newPath, file);

                fs.copyFileSync(srcFile, destFile);

                if (file.endsWith(".java") || file.endsWith(".kt")) {
                    replaceInFile(
                        destFile, 
                        /package com\.newreactnative/g,
                        `package ${newPackageId}`
                    );
                    replaceInFile(destFile, new RegExp(oldPackageId, "g"), newPackageId);

                    if (file === "MainActivity.java") {
                        replaceInFile(
                            destFile,
                            /getMainComponentName\(\)\s*{\s*return\s*"[^"]+";/g,
                            `getMainComponentName() { return "${projectName}";`
                        );
                        logSuccess("Updated MainActivity.java");
                    }
                }
            }

            fs.rmSync(oldPath, { recursive: true, force: true });
            logSuccess(`Android package renamed`);

            // Update build.gradle for all environments
            const buildGradlePath = path.join(projectDir, "android/app/build.gradle");
            if (fs.existsSync(buildGradlePath)) {
                let content = fs.readFileSync(buildGradlePath, "utf8");
                
                // Update dev flavor
                content = content.replace(
                    /applicationId ['"]com\.newreactnative['"]/g,
                    `applicationId '${newPackageId}'`
                );
                content = content.replace(
                    /resValue ['"]string['"], ['"]build_config_package['"], ['"]com\.newreactnative['"]/g,
                    `resValue 'string', 'build_config_package', '${newPackageId}'`
                );

                // Update staging flavor
                content = content.replace(
                    /applicationId ['"]com\.newreactnative\.stg['"]/g,
                    `applicationId '${newPackageId}.stg'`
                );

                // Update production flavor
                content = content.replace(
                    /applicationId ['"]com\.newreactnative\.production['"]/g,
                    `applicationId '${newPackageId}.production'`
                );

                fs.writeFileSync(buildGradlePath, content);
                logSuccess("Updated build.gradle with all environment configurations");
            }

            // Update AndroidManifest.xml
            const manifestPath = path.join(projectDir, "android/app/src/main/AndroidManifest.xml");
            if (fs.existsSync(manifestPath)) {
                replaceInFile(
                    manifestPath,
                    new RegExp(`package="${oldPackageId}"`, "g"),
                    `package="${newPackageId}"`
                );
                replaceInFile(manifestPath, new RegExp(oldPackageId, "g"), newPackageId);
                logSuccess("Updated AndroidManifest.xml");
            }

            // Update strings.xml
            const stringsPath = path.join(projectDir, "android/app/src/main/res/values/strings.xml");
            if (fs.existsSync(stringsPath)) {
                replaceInFile(
                    stringsPath,
                    /<string name="app_name">[^<]+<\/string>/,
                    `<string name="app_name">${projectName}</string>`
                );
                logSuccess("Updated strings.xml");
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