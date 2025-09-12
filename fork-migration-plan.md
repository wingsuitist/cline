
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
2. Switch back to main branch and create a branch 3.28-fork from the upstream v3.28 tag.
3. Copy this file to the new 3.28-fork branch.
???
???
8. Put the fork info header on top of the README.md file.
9. Overwrite main branch with 3.28-fork branch to make it the new main branch.

## Implementation details to consider for reimplementation with code snippets:


### Mark the extension to be a fork by extending placeholderText with "(letsboot fork v3.18.1)".

...


### ...



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