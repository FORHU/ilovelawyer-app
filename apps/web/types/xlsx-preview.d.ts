// xlsx-preview ships its own dist/types/*.d.ts but doesn't declare a "types" field in
// package.json (only "main", a UMD bundle) — TypeScript's module resolution never finds them
// on its own, so this mirrors the package's real shape (verified against
// node_modules/xlsx-preview/dist/types/index.d.ts and dist/index.d.ts) rather than falling
// back to a bare `declare module "xlsx-preview";`, which would type everything as `any`.
declare module "xlsx-preview" {
  export type XlsxData = Blob | File | ArrayBuffer;

  export interface XlsxOptions {
    output?: "string" | "arrayBuffer";
    separateSheets?: boolean;
    minimumRows?: number;
    minimumCols?: number;
  }

  export function xlsx2Html(
    data: XlsxData,
    options?: XlsxOptions,
  ): Promise<string | ArrayBuffer | string[] | Promise<ArrayBuffer>[]>;

  const xlsxPreview: { xlsx2Html: typeof xlsx2Html };
  export default xlsxPreview;
}
