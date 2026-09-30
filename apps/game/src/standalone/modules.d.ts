declare module "sql.js/dist/sql-asm-memory-growth.js" {
  import type { SqlJsStatic } from "sql.js";
  const init: (config?: object) => Promise<SqlJsStatic>;
  export default init;
}
