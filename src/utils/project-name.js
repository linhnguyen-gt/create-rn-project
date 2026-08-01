/**
 * The one definition of a valid project name.
 *
 * It used to be three: `index.js` validated user input, and `androidManager` and
 * `iosManager` each re-ran the same literal before renaming. All three agreed with each
 * other and disagreed with the error message they printed.
 *
 * The old pattern was `/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/`. Because `[a-z]*` matches empty, it
 * accepted consecutive capitals — `MYAPP`, `ABC`, `MyAPP` and even `A` all generated a
 * project, while the message beside it listed `MYAPP` under "Bad". Requiring `[a-z]+` per
 * word is what the message always described.
 */
const PROJECT_NAME_PATTERN = /^(?:[A-Z][a-z]+)+$/;

/** Reserved template names, lowercased. Generating over one of these confuses the rename. */
const RESERVED_NAMES = new Set([
    "newreactnative",
    "new-react-native",
    "newreactnativezustandrn",
    "new-react-native-zustand-rn",
    "newreactnativezustandrnq",
    "new-react-native-zustand-rnq"
]);

const NAME_RULES_MESSAGE =
    "Invalid project name. Name must be in PascalCase:\n" +
    "  • Start with an uppercase letter\n" +
    "  • Each word starts uppercase and continues lowercase\n" +
    "  • Every word needs at least one lowercase letter\n" +
    "  • No numbers, no separators, no runs of capitals\n\n" +
    "Examples:\n" +
    "  ✅ Good: MyApp, MyReactApp, Shopping\n" +
    "  ❌ Bad: myApp, MYAPP, MyAPP, ABC, myapp, My-App, MyApp1, my_app";

function isValidProjectName(name) {
    return typeof name === "string" && PROJECT_NAME_PATTERN.test(name);
}

function isReservedProjectName(name) {
    return typeof name === "string" && RESERVED_NAMES.has(name.toLowerCase());
}

/** Throws with the shared rules message. Used wherever a name reaches a rename step. */
function assertValidProjectName(name, context = "project") {
    if (!isValidProjectName(name)) {
        throw new Error(`Invalid ${context} name "${name}".\n\n${NAME_RULES_MESSAGE}`);
    }
}

module.exports = {
    PROJECT_NAME_PATTERN,
    NAME_RULES_MESSAGE,
    isValidProjectName,
    isReservedProjectName,
    assertValidProjectName
};
