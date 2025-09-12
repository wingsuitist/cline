
# Letsboot Labmachine specific Fork

This is a specific for for the Letsboot Labmachine project not intended to be pulled upstream.

- Overwrite any state using `cline.overwriteState` in the users `settings.json` to preconfigure the state of the extension.
- Mark the extension to be a fork by extending placeholderText with "(letsboot fork v3.18.1)".
- Button in the settings view to dump extension state into `.state.dump.json` in the workspace root. 
- Removed `.github/` folder from file ignore list (`src/services/search/file-search.ts`).
- Package as vsix in the fork project as cline-latest.vsix and the version from package.json (.github/workflows/letsboot-fork-package.yml).
- Disable windows tests, as this fork isn't used or tested on Windows (.github/workflows/test.yml).


## Goal:

Get v3.28 of the upstream cline extension and reimplement the Letsboot fork changes on top of it.

## Plan

1. Create a branch 3.18.1-fork from the current main branch to preserve the current state of the fork.
2. Add upstream remote and fetch v3.28 tag from the official cline repository.
3. Switch back to main branch and create a branch 3.28-fork from the upstream v3.28 tag.
4. Copy this file to the new 3.28-fork branch.
5. Reimplement the state overwrite functionality.
6. Reimplement the fork branding (placeholder text with updated version).
7. Reimplement the dump state feature.
8. Reimplement the file search changes (.github removal).
9. Reimplement the GitHub workflow changes.
10. Add .gitignore entry for state dumps.
11. Put the fork info header on top of the README.md file.
12. Update version number in fork branding to v3.28.
13. Overwrite main branch with 3.28-fork branch to make it the new main branch.

## Feature Analysis & Implementation Details

Before implementing on v3.28, let's capture the essence, goals, and mechanics of each fork feature:

## Implementation details to consider for reimplementation with code snippets:

### 1. Fork Branding - Mark the extension to be a fork by extending placeholderText

**Goal:** Clearly identify this as a fork version in the UI
**Essence:** Visual indication that users are running the Letsboot fork, not upstream Cline
**Key Mechanics:**
- **Placeholder Text Modification:** Add "(letsboot fork vX.XX)" to chat input placeholders
- **Version Tracking:** Update version number when migrating to new upstream versions
- **Minimal UI Impact:** Non-intrusive branding that doesn't interfere with functionality

**File: `webview-ui/src/components/chat/ChatView.tsx`**
```typescript
const placeholderText = useMemo(() => {
    // <letsboot fork>
    const text = task ? "Type a message... (letsboot fork v3.28)" : "Type your task here... (letsboot fork v3.28)"
    // </letsboot fork>
    return text
}, [task])
```

### 2. State Overwrite Support

**Goal:** Allow preconfiguration of any extension setting via user's `settings.json`
**Essence:** Provide a way for system administrators or power users to preconfigure Cline settings without manual UI interaction
**Key Mechanics:**
- **Startup Override:** Apply settings from `cline.overwriteState` in settings.json during extension activation
- **Bidirectional Sync:** When users change settings in the UI, write those changes back to settings.json if they were originally overridden
- **Deep Merge:** Preserve existing nested properties while applying overrides
- **Loop Prevention:** Track which properties were originally overridden to avoid circular updates
- **Storage Type Awareness:** Handle different storage types (global state, workspace state, secrets) correctly
- **Critical Timing:** Apply overrides after migrations but before webview creation

**Why This is Tricky:**
- Must intercept all state update paths without creating infinite loops
- Need to distinguish between user-initiated changes and system changes
- Must handle nested objects and different storage backends consistently
- Timing is critical - too early and migrations fail, too late and initial state is wrong

**File: `package.json` - Add configuration property:**
```json
"configuration": {
    "title": "Cline",
    "properties": {
        "cline.overwriteState": {
            "type": "object",
            "description": "[Letsboot Fork] Override state properties. Use state dump button to see possible settings to overwrite.",
            "additionalProperties": true
        }
    }
}
```

**File: `src/storage/state-overwrite.ts`** - Create the entire state overwrite system (393 lines of code from commit ed365b2a)

**File: `src/extension.ts` - Add startup override application:**
```typescript
// <letsboot fork>
import { applyStateOverridesOnStartup } from "./storage/state-overwrite"
// </letsboot fork>

// In activate function, after migrations:
// <letsboot fork>
// Apply state overrides from user settings.json (letsboot fork)
// This must be done after migrations but before creating the webview
await applyStateOverridesOnStartup(context)
// </letsboot fork>
```

**File: `src/core/controller/index.ts` - Update state management methods:**
```typescript
// <letsboot fork>
import {
    updateGlobalStateWithOverride,
    updateWorkspaceStateWithOverride,
    storeSecretWithOverride,
} from "../../storage/state-overwrite"
// </letsboot fork>

// Replace calls to updateGlobalState, updateWorkspaceState, storeSecret with override versions
```

**File: `src/core/storage/state.ts` - Add override hooks:**
```typescript
// <letsboot fork>
import { updateOverriddenProperty } from "../../storage/state-overwrite"
// </letsboot fork>

// Add override property updates in updateGlobalState, updateWorkspaceState, storeSecret functions
```

### 3. Dump State Feature

**Goal:** Allow users to export their current extension state for debugging/configuration purposes
**Essence:** Provide transparency into extension state and enable configuration discovery
**Key Mechanics:**
- **Complete State Export:** Dump the full extension state that would be sent to webview
- **File Output:** Write to `.state.dump.json` in workspace root
- **UI Integration:** Button in settings view for easy access
- **Error Handling:** Graceful handling when no workspace is open
- **gRPC Integration:** Use the protobuf RPC system for communication

**File: `proto/ui.proto` - Add RPC:**
```proto
// letsboot fork - Dumps the current extension state to a file in the workspace
rpc dumpStateToFile(EmptyRequest) returns (String);
```

**File: `src/core/controller/ui/dumpStateToFile.ts`** - Create the dump functionality (38 lines from commit 3302bb4c)

**File: `webview-ui/src/components/settings/SettingsView.tsx` - Add button:**
```tsx
// <letsboot fork>
import { UiServiceClient } from "@/services/grpc-client"
import { EmptyRequest } from "@shared/proto/common"
// </letsboot fork>

// Add button in settings header:
{/* letsboot fork */}
<VSCodeButton appearance="secondary" onClick={handleDumpStateToFile}>
    Dump State to File
</VSCodeButton>
{/* /letsboot fork */}

// Add handler function:
const handleDumpStateToFile = async () => {
    try {
        await UiServiceClient.dumpStateToFile(EmptyRequest.create({}))
    } catch (error) {
        console.error("Error dumping state to file:", error)
    }
}
```

### 4. File Search Enhancement - Remove .github from file search ignore list

**Goal:** Allow Cline to search and access `.github/` directory contents
**Essence:** Remove artificial limitation that prevents Cline from working with GitHub workflow files
**Key Mechanics:**
- **Search Pattern Modification:** Remove `.github` from ripgrep exclusion patterns
- **Workflow Access:** Enable Cline to read, modify, and create GitHub Actions workflows
- **CI/CD Integration:** Allow Cline to help with DevOps tasks

**File: `src/services/search/file-search.ts`:**
```typescript
// <letsboot fork> - removed ".github" from the exclusion list
"!**/{node_modules,.git,out,dist,__pycache__,.venv,.env,venv,env,.cache,tmp,temp}/**",
// </letsboot fork>
```

### 5. Fork Distribution System - GitHub Workflow Changes

**Goal:** Automated packaging and distribution of fork releases
**Essence:** Independent release pipeline that doesn't interfere with upstream
**Key Mechanics:**
- **Automated Packaging:** Build VSIX on every main branch push
- **Dual Versioning:** Create both "latest" and versioned releases
- **GitHub Releases:** Use GitHub releases for distribution
- **Test Integration:** Run tests before packaging
- **Windows Exclusion:** Skip Windows tests since fork targets Linux/macOS environments

**File: `.github/workflows/letsboot-fork-package.yml`** - Create entire packaging workflow (116 lines from commit ddb67677)

**File: `.github/workflows/test.yml` - Disable Windows tests:**
```yaml
matrix:
    # letsboot fork: Disable Windows tests
    os: [ubuntu-latest]
```

### 6. Development Workflow Optimizations - .gitignore Addition

**Goal:** Streamline development workflow for fork-specific needs
**Essence:** Remove friction and noise from development process
**Key Mechanics:**
- **Gitignore State Dumps:** Prevent accidental commit of debug files
- **Clean Repository:** Keep development artifacts out of version control

**File: `.gitignore`:**
```
# ignore state dumps
.state.dump.json
```

### 7. Fork Documentation - README Fork Header

**Goal:** Clear documentation and installation instructions for fork users
**Essence:** Provide complete information about fork differences and installation
**Key Mechanics:**
- **Feature Documentation:** List all fork-specific features
- **Installation Scripts:** Ready-to-use installation commands
- **Version Management:** Update version references during migration

**File: `README.md` - Add at the top:**
```markdown
# Letsboot Labmachine specific Fork

This is a specific for for the Letsboot Labmachine project not intended to be pulled upstream.

- Overwrite any state using `cline.overwriteState` in the users `settings.json` to preconfigure the state of the extension.
- Mark the extension to be a fork by extending placeholderText with "(letsboot fork v3.28)".
- Button in the settings view to dump extension state into `.state.dump.json` in the workspace root. 
- Removed `.github/` folder from file ignore list (`src/services/search/file-search.ts`).
- Package as vsix in the fork project as cline-latest.vsix and the version from package.json (.github/workflows/letsboot-fork-package.yml).
- Disable windows tests, as this fork isn't used or tested on Windows (.github/workflows/test.yml).

## Install fork:

```sh
# Local VS Code
curl -L -o /tmp/cline.vsix https://github.com/wingsuitist/cline/releases/download/latest/cline-latest.vsix
code --force  --install-extension /tmp/cline.vsix
rm /tmp/cline.vsix
```

```sh
# Code Server
curl -L -o /tmp/cline.vsix https://github.com/wingsuitist/cline/releases/download/latest/cline-latest.vsix
code-server --force --install-extension /tmp/cline.vsix
rm /tmp/cline.vsix
```

```sh
# or use a specific version (example for v3.28)
curl -L -o /tmp/cline.vsix https://github.com/wingsuitist/cline/releases/download/v3.28/cline-v3.28.vsix
code-server --force --install-extension /tmp/cline.vsix
rm /tmp/cline.vsix
```


## Critical Questions for v3.28 Analysis

When examining v3.28.0, we need to focus on these key areas that could affect our fork implementation:

### 1. State Management Architecture
- **Controller Structure:** Has the `src/core/controller/index.ts` structure changed?
- **State Storage:** Are `updateGlobalState`, `updateWorkspaceState`, `storeSecret` still in the same locations?
- **Extension Lifecycle:** Has the activation sequence in `src/extension.ts` changed?
- **Migration System:** Are there new migrations that could conflict with our state overrides?

### 2. gRPC/Protobuf System
- **Proto Structure:** Is `proto/ui.proto` still the correct location for UI RPCs?
- **RPC Handlers:** Are controller UI handlers still in `src/core/controller/ui/`?
- **Message Types:** Are `EmptyRequest` and `String` still available in common proto?
- **Client Generation:** Has the gRPC client generation process changed?

### 3. UI Component Architecture
- **Settings View:** Is `webview-ui/src/components/settings/SettingsView.tsx` still the main settings component?
- **Chat View:** Is `webview-ui/src/components/chat/ChatView.tsx` still where placeholder text is defined?
- **Import Paths:** Have the import paths for `UiServiceClient` or `EmptyRequest` changed?
- **Component Structure:** Are the button placement patterns still the same?

### 4. File Search System
- **Search Location:** Is file search still handled in `src/services/search/file-search.ts`?
- **Ripgrep Integration:** Is the exclusion pattern still using the same format?
- **Search Architecture:** Has the search system been refactored?

### 5. Build and Workflow System
- **GitHub Actions:** Are the workflow structures still compatible?
- **Package Scripts:** Have the build/test commands changed?
- **VSIX Generation:** Is `vsce package` still the packaging method?
- **Test Framework:** Are the test configurations still the same?

### 6. Package Configuration
- **VSCode Extension Manifest:** Has the `package.json` structure for VSCode extensions changed?
- **Configuration Schema:** Are custom configuration properties still defined the same way?
- **Dependencies:** Are there new dependencies that could conflict with our changes?

## Implementation Strategy for v3.28

Based on the analysis above, our implementation approach should be:

### Phase 1: Architecture Assessment
1. **Compare Key Files:** Examine the critical files listed above between v3.18.1 and v3.28
2. **Identify Breaking Changes:** Look for structural changes that would break our implementations
3. **Update Integration Points:** Adapt our code to work with any architectural changes

### Phase 2: Feature Implementation (Order of Complexity)
1. **Fork Branding** (Simplest) - Update placeholder text
2. **File Search Enhancement** - Remove .github from exclusions
3. **Development Optimizations** - Add .gitignore entries
4. **Fork Documentation** - Update README header
5. **Dump State Feature** (Medium) - Add gRPC endpoint and UI button
6. **GitHub Workflows** (Medium) - Update CI/CD pipelines
7. **State Overwrite System** (Most Complex) - Reimplement the bidirectional sync system

### Phase 3: Testing and Validation
1. **Feature Testing:** Verify each feature works independently
2. **Integration Testing:** Ensure features work together without conflicts
3. **State Overwrite Testing:** Thoroughly test loop prevention and timing
4. **Build Testing:** Verify packaging and distribution works

## Next Steps

1. **Examine v3.28.0:** Check the critical files and answer the architecture questions above
2. **Create Detailed Implementation Plan:** Based on actual v3.28 structure
3. **Execute Migration:** Implement features following the phased approach
4. **Validate and Test:** Ensure all features work correctly in the new version

## Relevant Commits

commit 0c9119aacbf803301be7ff457128c6e1b6047fa8 (HEAD -> main, origin/main, origin/fork-diff-3.18.1, origin/HEAD)
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Thu Jul 3 00:38:15 2025 +0200

    removed state overwrite test

commit e6b9a4a8dd8d8fc388c7e7c2b9272c1b3612cda7
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Thu Jul 3 00:30:57 2025 +0200

    Mark the extension to be a fork by extending placeholderText with "(letsboot fork v3.18.1)".

commit ed365b2a6295831b87a8f46aa245d1ba2bf9a796
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Thu Jul 3 00:28:51 2025 +0200

    overwrite state support

commit ad40ca45e59bf5399a523c19b83939d7048c84ab
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Thu Jul 3 00:11:00 2025 +0200

    ignore state dumps

commit b801257f9e29f7c000418e950362fe9a1b7cfce5
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Wed Jul 2 23:26:28 2025 +0200

    Removed `.github/` folder from file ignore list (`src/services/search/file-search.ts`).

commit b0a84a925e3ff4b61c2fc3e19b890b1124064913 (tag: v3.18.1, tag: latest)
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Wed Jul 2 23:16:11 2025 +0200

    fork note about state dump button

commit 3302bb4cabc6895bd8b77bcfdde33187cc227421
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Wed Jul 2 23:14:50 2025 +0200

    letsboot fork dump state feature

commit ddb67677b5eb4044a283d0b4324bc73fb15c25e2
Author: Jonas Felix <jonas.felix@felixideas.ch>
Date:   Wed Jul 2 22:55:40 2025 +0200

    - Package as vsix in the fork project as cline-latest.vsix and the version from package.json (.github/workflows/letsboot-fork-package.yml).
    - Disable windows tests, as this fork isn't used or tested on Windows (.github/workflows/test.yml).
---
