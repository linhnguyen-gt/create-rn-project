<div align="center">
  <h1>🚀 create-rn-project</h1>
  <p>A powerful CLI tool to create React Native projects with multiple architecture options</p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Integrated-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="typescript" />
  <img src="https://img.shields.io/badge/Multiple_Architectures-Available-28A745?style=for-the-badge" alt="architectures" />
</p>

## 📋 Overview

`create-rn-project` is a command-line tool that helps you quickly set up a new React Native project with a production-ready structure and configuration. It supports multiple architecture options:

### Available Architectures

- **Redux + Redux Saga** - Based on [new-react-native](https://github.com/linhnguyen-gt/new-react-native) template
- **Zustand + React Query** - Based on [new-react-native-zustand-react-query](https://github.com/linhnguyen-gt/new-react-native-zustand-react-query) template

Each architecture includes:

- TypeScript for type safety
- NativeWind for styling with Tailwind CSS
- Multi-environment support (Development, Staging, Production)
- Pre-configured folder structure
- Gluestack UI components
- And much more!

## 🚀 Installation

### Global Installation

```bash
# Install globally from the official repository
npm install -g https://github.com/linhnguyen-gt/create-rn-with-redux-project.git
```

### Requirements

Make sure you have the following installed:

- Node.js (v16 or newer)
- npm or yarn
- Git
- React Native development environment set up (for running the generated project)

## 📱 Usage

### Creating a New Project

```bash
# Basic usage with interactive architecture selection
create-rn-project MyApp

# You'll see a menu like:
# ? Choose an architecture: (Use arrow keys)
# ❯ Redux + Redux Saga - State management with Redux and Redux Saga
#   Zustand + React Query - State management with Zustand and data fetching with React Query
```

You can also specify the architecture directly using the `-a` or `--arch` flag:

```bash
# Directly specify Zustand + React Query architecture
create-rn-project MyApp -a zustand

# Directly specify Redux + Redux Saga architecture
create-rn-project MyApp -a redux
```

Additional options:

```bash
# With specific React Native version branch
create-rn-project MyApp@rn-0.78.xx

# With custom bundle ID
create-rn-project MyApp -b com.example.myapp

# With all options
create-rn-project MyApp@rn-0.78.xx -b com.example.myapp --repo https://github.com/yourusername/your-repo.git --skip-install --use-npm
```

❗ **Note**: To set a custom bundle identifier, you must use the `-b` or `--bundle-id` flag. For example:
- ✅ Correct: `create-rn-project MyApp -b com.example.myapp`
- ❌ Incorrect: `create-rn-project MyApp com.example.myapp`

### Available React Native Versions

- `main` - Latest stable version (default)
- `rn-0.78.xx` - React Native 0.78.x
- `rn-0.79.xx` - React Native 0.79.x

Examples:

```bash
# Use React Native 0.78.x
create-rn-project MyApp@rn-0.78.xx

# Use React Native 0.79.x
create-rn-project MyApp@rn-0.79.xx

# Use latest stable version
create-rn-project MyApp
```

### Available Options

- `-a, --arch <architecture>`: Choose architecture (redux, zustand)
- `-b, --bundle-id <id>`: Set custom bundle identifier (default: "com.example.app")
- `-r, --repo <url>`: Specify GitHub repository URL
- `--skip-install`: Skip installing dependencies
- `--use-npm`: Use npm instead of yarn for installing dependencies
- `--skip-env-setup`: Skip environment setup
- `--skip-git`: Skip git initialization
- `--help`: Show help information

### After Creating a Project

Once your project is created, you can:

```bash
# Navigate to your project
cd MyApp

# Start the development server
yarn start

# Run on iOS
yarn ios

# Run on Android
yarn android

# Run on specific environments
yarn ios:stg    # Staging environment for iOS
yarn android:pro  # Production environment for Android
```

## ✨ Features

The generated project comes with:

- 🏗️ **TypeScript Integration**: Full TypeScript support for type safety
- 🔄 **State Management**: Choose between Redux Toolkit with Redux Saga or Zustand
- 🔍 **Data Fetching**: React Query available in Zustand architecture
- 🎨 **Styling**: NativeWind (Tailwind CSS for React Native)
- 🌐 **Multi-Environment**: Development, Staging, and Production environments
- 📱 **Cross-Platform**: iOS and Android support with environment-specific configurations
- 🛠️ **Developer Tools**: Reactotron integration for debugging
- 📦 **Organized Structure**: Pre-configured folder structure following best practices
- 🔍 **Code Quality**: ESLint and Prettier pre-configured

## 🔧 Environment Configuration

The generated project supports multiple environments:

- **Development**: Default environment for development
- **Staging**: For testing before production
- **Production**: For production releases

Each environment has its own configuration files and build scripts.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Linh Nguyen** - [GitHub](https://github.com/linhnguyen-gt)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/linhnguyen-gt">Linh Nguyen</a>
</p>
