// Plain JavaScript entry point for the netns worker.
// Used when spawning the worker from source (tests / dev) where there is no TypeScript
// loader available in the child process.  The production build instead uses the compiled
// dist/netns-worker bundle found next to the bundled create.js.

import "../../../dist/netns-worker";
