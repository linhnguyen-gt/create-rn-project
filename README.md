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

Templates are always cloned from the latest `main` branch. Version or branch selection with `MyApp@branch` is not supported.

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
- `--use-npm`: Use npm instead of the template package manager. This is not allowed for the Zustand template.
- `--skip-env-setup`: Skip the template environment setup script.
- `--skip-git`: Skip Git initialization.
- `--help`: Show CLI help.

## Package Manager Behavior

The CLI detects the package manager from the cloned template:

- `packageManager` in `package.json`
- lockfiles such as `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`
- fallback to `yarn` for older templates

The current Zustand template uses `pnpm`, so generated next steps use `pnpm install`, `pnpm env:setup`, `pnpm ios`, and `pnpm android`.

The Zustand template requires `pnpm`. If `pnpm` is missing, the CLI asks whether it should enable Corepack before continuing.

Use `--use-npm` only when you intentionally want to override a template package manager that supports npm. The Redux template still uses Yarn by default.

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
