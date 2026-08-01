const fs = require("fs");
const path = require("path");

/** Directories that never contain template identifiers worth checking, and are huge. */
const SKIP_DIRS = new Set(["node_modules", ".git", "Pods", "build", ".gradle", "plans"]);

/** Files that are not text and would produce meaningless matches. */
const BINARY_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
    ".zip",
    ".jar",
    ".keystore",
    ".car"
]);

function walkFiles(dir, results = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walkFiles(fullPath, results);
        } else if (entry.isFile() && !BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            results.push(fullPath);
        }
    }
    return results;
}

/** Every occurrence of `needle`, as `relative/path:line` strings. */
function findOccurrences(projectDir, needle) {
    const hits = [];
    for (const file of walkFiles(projectDir)) {
        let content;
        try {
            content = fs.readFileSync(file, "utf8");
        } catch {
            continue;
        }
        if (!content.includes(needle)) continue;

        content.split("\n").forEach((line, index) => {
            if (line.includes(needle)) {
                hits.push(`${path.relative(projectDir, file)}:${index + 1}`);
            }
        });
    }
    return hits;
}

/**
 * Identifiers that must not survive generation.
 *
 * `org.reactjs.native.example` is the Expo default bundle prefix — its presence means a
 * bundle identifier was never rewritten, which is the failure mode that is easiest to ship
 * without noticing because the project still builds.
 */
const TEMPLATE_IDENTIFIERS = [
    "NewReactNativeZustandRNQ",
    "newreactnativezustandrnq",
    "ZustandRNQ",
    "NewReactNative",
    "newreactnative",
    "org.reactjs.native.example"
];

/** The author's Apple Team ID, removed from both templates. A regression would re-leak it. */
const LEAKED_IDENTITY = ["ZUAY5K8CWJ"];

/**
 * Which templates ship committed native projects.
 *
 * Redux is Continuous Native Generation — a clone has no `ios/` or `android/`, they are
 * produced by `expo prebuild`. The CLI's native rename must therefore be skipped for it.
 * When a template changes side here, this assertion is meant to fail: the CLI's behaviour
 * needs reviewing, not the assertion.
 */
const EXPECTS_NATIVE_DIRS = { redux: false, zustand: true };

const ASSERTIONS = [
    {
        name: "no template identifiers survive",
        run(projectDir) {
            const failures = [];
            for (const identifier of TEMPLATE_IDENTIFIERS) {
                const hits = findOccurrences(projectDir, identifier);
                if (hits.length > 0) {
                    failures.push(
                        `"${identifier}" at ${hits.slice(0, 5).join(", ")}${hits.length > 5 ? ` (+${hits.length - 5} more)` : ""}`
                    );
                }
            }
            return failures.length === 0 ? null : failures.join("; ");
        }
    },
    {
        name: "no leaked author identity",
        run(projectDir) {
            const failures = [];
            for (const secret of LEAKED_IDENTITY) {
                const hits = findOccurrences(projectDir, secret);
                if (hits.length > 0) failures.push(`"${secret}" at ${hits.slice(0, 3).join(", ")}`);
            }
            if (fs.existsSync(path.join(projectDir, ".env.vault"))) failures.push(".env.vault present");
            return failures.length === 0 ? null : failures.join("; ");
        }
    },
    {
        name: "package.json name is the project name",
        run(projectDir, ctx) {
            const packageJsonPath = path.join(projectDir, "package.json");
            if (!fs.existsSync(packageJsonPath)) return "package.json missing";
            const actual = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).name;
            return actual === ctx.projectName ? null : `expected "${ctx.projectName}", got "${actual}"`;
        }
    },
    {
        name: "requested --bundle-id is applied",
        skip: (ctx) => !ctx.bundleId,
        run(projectDir, ctx) {
            const applied = findOccurrences(projectDir, ctx.bundleId);
            if (applied.length === 0) {
                return `"${ctx.bundleId}" appears nowhere in the generated project`;
            }

            // The bug this exists for: the requested id is dropped and the name-derived
            // default silently takes its place, so generation still "succeeds".
            const fallback = `com.${ctx.projectName.toLowerCase()}`;
            const leaked = findOccurrences(projectDir, fallback);
            return leaked.length === 0
                ? null
                : `name-derived "${fallback}" used instead at ${leaked.slice(0, 5).join(", ")}`;
        }
    },
    {
        name: "default bundle id is derived from the project name",
        skip: (ctx) => Boolean(ctx.bundleId),
        run(projectDir, ctx) {
            const expected = `com.${ctx.projectName.toLowerCase()}`;
            return findOccurrences(projectDir, expected).length > 0 ? null : `"${expected}" appears nowhere`;
        }
    },
    {
        name: "native directories match the template's build model",
        run(projectDir, ctx) {
            const expected = EXPECTS_NATIVE_DIRS[ctx.architecture];
            if (expected === undefined) return null;

            const hasIos = fs.existsSync(path.join(projectDir, "ios"));
            const hasAndroid = fs.existsSync(path.join(projectDir, "android"));
            const actual = hasIos || hasAndroid;

            if (actual === expected) return null;
            return expected
                ? "expected committed ios/ and android/, found neither"
                : `expected none (CNG), found ${[hasIos && "ios/", hasAndroid && "android/"].filter(Boolean).join(" and ")}`;
        }
    }
];

/** Runs every applicable assertion. Returns `[{ name, error }]` for the ones that failed. */
function runAssertions(projectDir, ctx) {
    const failures = [];
    for (const assertion of ASSERTIONS) {
        if (assertion.skip && assertion.skip(ctx)) continue;
        const error = assertion.run(projectDir, ctx);
        if (error) failures.push({ name: assertion.name, error });
    }
    return failures;
}

module.exports = { runAssertions, findOccurrences, walkFiles, ASSERTIONS };
