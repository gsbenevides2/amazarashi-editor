import path from "path";

export function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}
