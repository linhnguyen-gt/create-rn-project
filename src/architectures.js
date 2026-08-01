/**
 * The template catalogue, shared by the CLI and the regression harness.
 *
 * It lives here rather than inside index.js because scripts/probe-template.js needs the same
 * repo URLs and original names to generate from. A second copy is how the CLI drifted away
 * from the templates in the first place.
 */
const ARCHITECTURES = {
    redux: {
        name: "Redux + Redux Saga",
        repo: "https://github.com/linhnguyen-gt/new-react-native.git",
        description: "State management with Redux and Redux Saga",
        originalName: "NewReactNative",
        documentation: [
            { name: "Redux Toolkit", url: "https://redux-toolkit.js.org/introduction/getting-started" },
            { name: "Redux Saga", url: "https://redux-saga.js.org/docs/introduction/GettingStarted" }
        ],
        community: [
            { name: "Redux community", url: "https://stackoverflow.com/questions/tagged/redux" },
            { name: "Redux Saga community", url: "https://github.com/redux-saga/redux-saga/discussions" }
        ]
    },
    zustand: {
        name: "Zustand + React Query",
        repo: "https://github.com/linhnguyen-gt/new-react-native-zustand-react-query.git",
        description: "State management with Zustand and data fetching with React Query",
        originalName: "NewReactNativeZustandRNQ",
        documentation: [
            { name: "Zustand", url: "https://github.com/pmndrs/zustand" },
            { name: "React Query", url: "https://tanstack.com/query/latest/docs/react/overview" }
        ],
        community: [
            { name: "Zustand community", url: "https://github.com/pmndrs/zustand/discussions" },
            { name: "React Query community", url: "https://github.com/TanStack/query/discussions" }
        ]
    }
};

/**
 * Where a template is cloned from when it has no release tag yet. Generation normally uses the
 * newest release instead — see `resolveLatestRelease` — so this is the bootstrap case only.
 */
const TEMPLATE_FALLBACK_BRANCH = "main";

/**
 * Both templates pin pnpm via `packageManager` and rely on pnpm-only workspace settings —
 * hoisted node linker, `overrides`, `patchedDependencies`. npm ignores all of it and the
 * project fails later, during a build, with an error that points anywhere but here.
 */
const REQUIRED_PACKAGE_MANAGER = "pnpm";

module.exports = { ARCHITECTURES, TEMPLATE_FALLBACK_BRANCH, REQUIRED_PACKAGE_MANAGER };
