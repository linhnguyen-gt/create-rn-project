#!/usr/bin/env node

/**
 * Generates a project from a template and asserts the result, without installing anything.
 *
 * The CLI drifted away from both boilerplates because nothing ever compared its assumptions
 * against the templates it generates from. This is that comparison.
 *
 *   node scripts/probe-template.js --arch redux --source ../new-react-native
 *   node scripts/probe-template.js --arch zustand --bundle-id com.acme.probe
 *   node scripts/probe-template.js --all
 *
 * `--source` matters for more than speed: template changes are reviewed before they are
 * pushed, and the CLI clones from `main`, so without a local mode the only way to test an
 * unpushed template change is to push it first.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { ARCHITECTURES, TEMPLATE_FALLBACK_BRANCH } = require("../src/architectures");
const { setupNewProject, cleanupProject } = require("../src/project/projectManager");
const { runAssertions } = require("../src/lib/template-assertions");
const { resolveLatestRelease } = require("../src/utils/template-release");

function parseArgs(argv) {
    const options = { all: false, keep: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--all") options.all = true;
        else if (arg === "--keep") options.keep = true;
        else if (arg === "--arch") options.arch = argv[++i];
        else if (arg === "--source") options.source = argv[++i];
        else if (arg === "--bundle-id") options.bundleId = argv[++i];
        else if (arg === "--name") options.name = argv[++i];
        else {
            console.error(`Unknown argument: ${arg}`);
            process.exit(2);
        }
    }
    return options;
}

/**
 * Copies what the template repository *would* contain once its work is committed.
 *
 * That phrasing is the whole specification, and each flag earns its place by ruling out a
 * false pass this harness was built to catch:
 *
 * `--cached` — files already tracked.
 *
 * `--others` — files created but not yet `git add`ed. Without it the harness reads a
 * half-finished template: the Redux boilerplate's `eas.json` and its entire `scripts/lib/`
 * were untracked, so a probe run generated a project missing them and every assertion still
 * passed, because identifiers cannot leak from files that were never copied.
 *
 * `--exclude-standard` — honours `.gitignore`, which is what keeps untracked *build output*
 * out. The Redux template gitignores `/ios/` and `/android/`, but a local `expo prebuild`
 * leaves them on disk; an earlier ad-hoc probe used `rsync`, copied them, and reported the
 * iOS rename as working for a template where a real clone has no `ios/` at all.
 *
 * Contents are read from the working tree rather than via `git archive HEAD`, because
 * template changes are reviewed before they are committed — reading HEAD would test the
 * previous version and pass for the wrong reason.
 */
function copyTrackedFiles(source, destination) {
    const tracked = execFileSync(
        "git",
        ["-C", source, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        { maxBuffer: 64 * 1024 * 1024 }
    )
        .toString()
        .split("\0")
        .filter(Boolean);

    let copied = 0;
    for (const relativePath of tracked) {
        const from = path.join(source, relativePath);
        // A staged deletion leaves the index entry gone but a rename in progress can leave a
        // listed path with no file. Skip rather than crash.
        if (!fs.existsSync(from)) continue;

        const to = path.join(destination, relativePath);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        copied++;
    }

    if (copied === 0) throw new Error(`No tracked files found in ${source} — is it a git repository?`);
    return copied;
}

/** Resolves the same ref the CLI would, so a probe run tests what a user would receive. */
function cloneTemplate(repo, destination) {
    const release = resolveLatestRelease(repo);
    const ref = release ? release.tag : TEMPLATE_FALLBACK_BRANCH;

    execFileSync("git", ["clone", "--depth", "1", "-b", ref, repo, destination], {
        stdio: ["ignore", "ignore", "inherit"]
    });
    fs.rmSync(path.join(destination, ".git"), { recursive: true, force: true });
    return ref;
}

/** Silences the CLI's own generation chatter without hiding this script's output. */
const quiet = (fn) => {
    const originalLog = console.log;
    console.log = () => {};
    try {
        return fn();
    } finally {
        console.log = originalLog;
    }
};

function probe({ arch, source, bundleId, name, keep }) {
    const architecture = ARCHITECTURES[arch];
    if (!architecture) {
        console.error(`Unknown architecture "${arch}". Use one of: ${Object.keys(ARCHITECTURES).join(", ")}`);
        process.exit(2);
    }

    const projectName = name || (arch === "redux" ? "ReduxProbe" : "ZustandProbe");
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `probe-${arch}-`));
    const projectDir = path.join(workDir, projectName);
    fs.mkdirSync(projectDir, { recursive: true });

    const origin = source ? `local ${source}` : `clone ${architecture.repo}`;
    console.log(`\n▶ ${arch} · ${projectName}${bundleId ? ` · ${bundleId}` : ""} · ${origin}`);

    try {
        if (source) copyTrackedFiles(path.resolve(source), projectDir);
        else console.log(`   ref: ${cloneTemplate(architecture.repo, projectDir)}`);

        // Exactly what index.js does, minus install, env setup and git. Its progress chatter
        // is silenced so the assertion result is what the reader sees.
        process.env.ARCHITECTURE = arch;
        quiet(() => {
            setupNewProject(projectDir, projectName, architecture.originalName, bundleId, arch);
            cleanupProject(projectDir);
        });

        const failures = runAssertions(projectDir, { architecture: arch, projectName, bundleId });

        if (failures.length === 0) {
            console.log(`✅ ${arch}: all assertions passed`);
            return true;
        }

        console.error(`❌ ${arch}: ${failures.length} assertion(s) failed`);
        for (const failure of failures) console.error(`   • ${failure.name}\n     ${failure.error}`);
        console.error(`   generated at ${projectDir}`);
        return false;
    } catch (error) {
        // `setupNewProject` throws on a failed rename. Report it as this probe failing rather
        // than letting a stack trace stand in for a result.
        console.error(`❌ ${arch}: generation threw\n   ${error.message.split("\n")[0]}`);
        return false;
    } finally {
        if (keep) console.log(`   kept: ${projectDir}`);
        else fs.rmSync(workDir, { recursive: true, force: true });
    }
}

const options = parseArgs(process.argv.slice(2));

let ok = true;

if (options.all) {
    for (const arch of Object.keys(ARCHITECTURES)) {
        // Both paths matter: the default derives the id from the name, the explicit one is
        // where --bundle-id was being dropped.
        ok = probe({ ...options, arch }) && ok;
        ok = probe({ ...options, arch, bundleId: "com.acme.probe" }) && ok;
    }
} else if (options.arch) {
    ok = probe(options);
} else {
    console.error(
        "Usage: probe-template.js (--arch <redux|zustand> | --all) [--source <path>] [--bundle-id <id>] [--keep]"
    );
    process.exit(2);
}

process.exit(ok ? 0 : 1);
