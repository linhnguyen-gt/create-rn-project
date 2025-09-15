const fs = require("fs");
const path = require("path");
const { logSuccess, logStep } = require("../utils/logUtils");

function updateIOSSchemes(projectDir, oldName, newName) {
    logStep("Updating iOS schemes...");

    const oldSchemeDirs = [
        path.join(projectDir, "ios", `${oldName}.xcodeproj/xcshareddata/xcschemes`),
        path.join(projectDir, "ios", `${newName}.xcodeproj/xcshareddata/xcschemes`)
    ];

    oldSchemeDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            const mainSchemeFiles = fs.readdirSync(dir).filter(file => 
                (file === `${oldName}.xcscheme` || file === `${newName}.xcscheme`) &&
                !file.includes('Staging') && 
                !file.includes('Production')
            );
            
            mainSchemeFiles.forEach(file => {
                const filePath = path.join(dir, file);
                fs.unlinkSync(filePath);
                logSuccess(`Success Updated iOS scheme file`);
            });
        }
    });

    const newSchemesDir = path.join(projectDir, "ios", `${newName}.xcodeproj/xcshareddata/xcschemes`);
    if (!fs.existsSync(newSchemesDir)) {
        fs.mkdirSync(newSchemesDir, { recursive: true });
        logSuccess(`Created schemes directory: ${newSchemesDir}`);
    }

    createNewIOSScheme(projectDir, newName);

    logSuccess("iOS scheme updated successfully");
}

function createNewIOSScheme(projectDir, projectName) {
    logStep(`Creating main scheme for ${projectName}...`);
    
    const schemesDir = path.join(projectDir, "ios", `${projectName}.xcodeproj/xcshareddata/xcschemes`);
    const schemeFilePath = path.join(schemesDir, `${projectName}.xcscheme`);
    
    const schemeContent = generateSchemeContent(projectName);
    fs.writeFileSync(schemeFilePath, schemeContent);
    logSuccess(`Created main scheme: ${projectName}.xcscheme`);
}

function generateSchemeContent(projectName) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1130"
   version = "1.3">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
               BuildableName = "${projectName}.app"
               BlueprintName = "${projectName}"
               ReferencedContainer = "container:${projectName}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "00E356ED1AD99517003FC87E"
               BuildableName = "${projectName}Tests.xctest"
               BlueprintName = "${projectName}Tests"
               ReferencedContainer = "container:${projectName}.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
            BuildableName = "${projectName}.app"
            BlueprintName = "${projectName}"
            ReferencedContainer = "container:${projectName}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
            BuildableName = "${projectName}.app"
            BlueprintName = "${projectName}"
            ReferencedContainer = "container:${projectName}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>`;
}

module.exports = {
    updateIOSSchemes,
    createNewIOSScheme
};