/**
 * The identifier both platforms build from: `applicationId` on Android, `bundleIdentifier`
 * on iOS. Android is the stricter of the two, so its rules are the ones enforced here.
 */
const BUNDLE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

const BUNDLE_ID_RULES_MESSAGE =
    "A bundle id must follow Java package naming (reverse DNS):\n" +
    "  • Lowercase letters, digits and underscores only\n" +
    "  • Each segment starts with a letter or underscore, never a digit\n" +
    "  • Segments separated by single dots, no leading or trailing dot\n" +
    "  • No spaces, no hyphens\n\n" +
    "Examples:\n" +
    "  ✅ Good: com.acme.myapp, com.acme.my_app\n" +
    "  ❌ Bad: COM.Acme.MyApp, com..myapp, 9com.acme, com.acme my-app";

function isValidBundleId(bundleId) {
    return typeof bundleId === "string" && BUNDLE_ID_PATTERN.test(bundleId);
}

function assertValidBundleId(bundleId) {
    if (!isValidBundleId(bundleId)) {
        throw new Error(`Invalid bundle id "${bundleId}".\n\n${BUNDLE_ID_RULES_MESSAGE}`);
    }
}

module.exports = { BUNDLE_ID_PATTERN, BUNDLE_ID_RULES_MESSAGE, isValidBundleId, assertValidBundleId };
