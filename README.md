# create-rn-project

CLI for scaffolding React Native projects from Linh Nguyen's boilerplate templates.

## Overview

`create-rn-project` clones a selected template, renames native identifiers, updates bundle/package IDs, installs dependencies with the template package manager, and optionally initializes Git.

Available templates:

- `redux`: Redux + Redux Saga, based on [new-react-native](https://github.com/linhnguyen-gt/new-react-native)
- `zustand`: Zustand + TanStack React Query, based on [new-react-native-zustand-react-query](https://github.com/linhnguyen-gt/new-react-native-zustand-react-query)

The Zustand template is an Expo prebuild project, not a pure managed Expo app. Its native iOS and Android projects are generated and extended through config plugins for environment support.

## Requirements

- Node.js. Use the version required by the selected template. The current Zustand template expects Node.js `>=22.11.0`.
- Git.
- React Native iOS/Android development environment.
- Corepack enabled when using templates that declare `pnpm`.

Enable Corepack if needed:

```bash
corepack enable
```

## Installation

```bash
npm install -g https://github.com/linhnguyen-gt/create-rn-project.git
```

## Usage

Interactive architecture selection:

```bash
create-rn-project MyApp
```

Select an architecture directly:

```bash
create-rn-project MyApp -a zustand
create-rn-project MyApp -a redux
```

Templates are cloned from their latest release — the highest semver tag on the template
repository, prereleases excluded. A template with no release tag yet falls back to `main`, with
a warning. Version or branch selection with `MyApp@branch` is not supported.

```bash
create-rn-project MyApp -a zustand
```

Use a custom base bundle/package ID:

```bash
create-rn-project MyApp -a zustand -b com.example.myapp
```

With a custom Git remote and no automatic install:

```bash
create-rn-project MyApp -a zustand -b com.example.myapp --repo https://github.com/your-org/my-app.git --skip-install
```

Important: pass the bundle identifier with `-b` or `--bundle-id`.

```bash
# Correct
create-rn-project MyApp -b com.example.myapp

# Incorrect
create-rn-project MyApp com.example.myapp
```

## Options

- `-a, --arch <architecture>`: Template architecture, either `redux` or `zustand`.
- `-b, --bundle-id <id>`: Base bundle/package identifier. Defaults to `com.<project-name>`.
- `-r, --repo <url>`: Git remote URL for the generated project.
- `--skip-install`: Skip dependency installation.
- `--skip-env-setup`: Skip the template environment setup script.
- `--skip-git`: Skip Git initialization.
- `--help`: Show CLI help.

## Package Manager Behavior

**Both templates require `pnpm`.** They pin it through `packageManager` in `package.json` and
rely on pnpm-only workspace settings — a hoisted node linker, `overrides`, and
`patchedDependencies`. npm and Yarn ignore all of it, producing a project that installs
successfully and then fails during a build, with an error that points anywhere but at the
package manager.

If `pnpm` is missing, the CLI offers to enable Corepack before continuing.

`--use-npm` was removed for this reason. Passing it now fails with an explanation rather than
silently generating a broken project.

## Environments

Both templates manage environment values through EAS:

```bash
pnpm env:setup   # scaffold .env, .env.staging, .env.production locally
pnpm env:pull    # pull values from EAS
pnpm env:push    # push values to EAS
```

Only `env:setup` is needed to run the app. The pull/push commands need an EAS project, and
the templates deliberately ship none — run `npx eas init` in the generated project so it owns
its own project id rather than inheriting a shared one.

## Development

The CLI is verified against both templates by generating a project and asserting the result:

```bash
pnpm probe:all                                   # clone both templates at their latest release
pnpm probe --arch redux --source ../new-react-native   # test an unpushed template change
```

`--source` reads a local checkout's tracked files at their working-tree contents, so template
changes can be tested before they are committed or pushed. Run `pnpm probe:all` before
publishing a new version.

## Zustand Template Output

For `-a zustand`, the generated project uses:

- Expo SDK 56
- React Native 0.85.3
- TypeScript
- Zustand
- TanStack React Query
- Gluestack UI
- NativeWind
- Expo Updates
- Expo prebuild with config-plugin-generated native environments

Environment source of truth:

- `app.config.ts`
- `plugins/with-environment-support.cjs`
- `.env`
- `.env.staging`
- `.env.production`

The generated native identifiers follow this pattern when the base ID is `com.example.myapp`:

- Development: `com.example.myapp.dev`
- Staging: `com.example.myapp.stg`
- Production: `com.example.myapp`

Generated native run scripts are backed by `scripts/run-native.cjs`; the CLI rewrites that runner with the generated project name and bundle/package IDs.

## After Creating A Zustand Project

```bash
cd MyApp
pnpm install
pnpm env:setup
```

Run development builds:

```bash
pnpm ios
pnpm android
```

Run staging builds:

```bash
pnpm ios:stg
pnpm android:stg
```

Run production builds:

```bash
pnpm ios:prod
pnpm android:prod
```

Regenerate native folders:

```bash
pnpm prebuild:clean
```

One clean prebuild should regenerate all supported environments. Do not add separate prebuild scripts for each environment unless the template intentionally changes its native generation model.

## Native Environment Mapping

Zustand iOS schemes:

- Development: project-name scheme, for example `MyApp`
- Staging: `Staging`
- Production: `Production`

Zustand Android variants:

- Development: `developmentDebug`
- Staging: `stagingDebug`
- Production: `productionDebug`

Android keeps a `development` flavor because Gradle requires every environment to be represented once a flavor dimension exists.

## Redux Template Notes

The Redux template is kept for compatibility with the existing `new-react-native` boilerplate. It may use different package-manager and native-environment conventions from the Zustand template. The CLI preserves those older conventions unless the selected template itself is updated.

## Troubleshooting

If dependency installation fails:

```bash
pnpm install
pnpm store prune
```

For iOS native dependency issues:

```bash
cd ios
pod install
```

For Android native build issues:

```bash
cd android
./gradlew clean
```

For template-specific issues:

- Zustand template: https://github.com/linhnguyen-gt/new-react-native-zustand-react-query/issues
- Redux template: https://github.com/linhnguyen-gt/new-react-native/issues

## License

MIT
