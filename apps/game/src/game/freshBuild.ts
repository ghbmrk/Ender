import { freshOnNewBuild } from "./reset";

// Imported first by main.tsx, so it runs before any other module reads the save.
freshOnNewBuild();
