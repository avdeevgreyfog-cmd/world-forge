import {spawnSync} from "node:child_process";

const result=spawnSync(
  process.execPath,
  ["--experimental-strip-types","--experimental-specifier-resolution=node","--test","tests/heightfield.test.ts"],
  {stdio:"inherit",env:process.env},
);

process.exit(result.status??1);
