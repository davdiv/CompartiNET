// Plain JavaScript entry point for the manage-netns helper.
// Used when spawning the helper from source (tests / dev) where there is no TypeScript
// loader available in the child process.  The production build instead uses the compiled
// dist/manage-netns bundle found next to the bundled spawnUtils.

import "../../dist/manage-netns";
