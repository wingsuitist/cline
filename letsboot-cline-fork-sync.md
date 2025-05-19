- Understand what the letsboot.ch fork changes do by reading the README.md.
- Create branch called fork-diff-X.X.X use `npm pkg get version | sed 's/"//g'` to get version of current cline branch based on local main.
- Switch back to main branch.
- Get newest "tag" from already configured upstream: https://github.com/cline/cline.git
- Merge the fork-diff-X.X.X branch into the main branch.
- Ensure the letsboot changes are preserved and work with the new code.
- You can find the changes of letsboot looking for "letsboot" in the code (not all of the code we changed have that markers)

```
// <letsboot.ch fork change>
import { updateOverwrittenState, updateOverwrittenSecret } from "../../fork/letsboot/state-override"
// </letsboot.ch fork change>
```
- Identify and solve all merge request - thereby adapt the letsboot implemented fixes according to the new code.
