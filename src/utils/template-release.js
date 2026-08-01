const { execFileSync } = require("child_process");

/**
 * Only `1.2.3` and `v1.2.3`. Prereleases are deliberately excluded, matching what GitHub
 * itself treats as "the latest release" — a tagged beta should not become the default a
 * `create-rn-project` run generates from.
 */
const RELEASE_TAG = /^v?(\d+)\.(\d+)\.(\d+)$/;

function compareVersions(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a.version[i] !== b.version[i]) return b.version[i] - a.version[i];
    }
    return 0;
}

/**
 * Resolves the newest released version of a template, reading tags straight off the remote.
 *
 * `git ls-remote` rather than the GitHub releases API on purpose: git is already a hard
 * requirement of this CLI, so this adds no dependency, no token, and no rate limit — and it
 * keeps working for a template hosted anywhere. The trade is that a release must carry a
 * semver tag to be seen, which is how both templates already publish.
 *
 * Returns `null` when the repository has no release tag yet, leaving the caller to decide
 * what to fall back to. A failure to reach the remote throws instead: falling back silently
 * would clone a different version of the template than the one that was asked for.
 */
function resolveLatestRelease(repo) {
    let output;
    try {
        output = execFileSync("git", ["ls-remote", "--tags", "--refs", repo], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        });
    } catch (error) {
        throw new Error(`Could not read release tags from ${repo}.\n${error.stderr || error.message}`);
    }

    const releases = output
        .split("\n")
        .map((line) => line.split("\t")[1])
        .filter(Boolean)
        .map((ref) => ref.replace("refs/tags/", ""))
        .map((tag) => {
            const match = RELEASE_TAG.exec(tag);
            return match ? { tag, version: [+match[1], +match[2], +match[3]] } : null;
        })
        .filter(Boolean)
        .sort(compareVersions);

    return releases[0] || null;
}

module.exports = { resolveLatestRelease };
