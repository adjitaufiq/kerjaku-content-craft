export const INTERNAL_BUCKETS = ["instagram-media", "viral-sources", "content-research"] as const;
export type AssetBucket = (typeof INTERNAL_BUCKETS)[number];
export function ownedAssetPath(userId: string, folder: string, filename: string) {
  if (
    !/^[a-f0-9-]{36}$/i.test(userId) ||
    [folder, filename].some((s) => !s || s.includes("..") || s.includes("/") || s.includes("\\"))
  ) {
    throw new Error("Path aset tidak valid.");
  }
  return `${userId}/${folder}/${filename}`;
}
export function parseAssetReference(
  reference: string,
  allowedOrigin: string,
  bucket: AssetBucket,
): string {
  if (reference.startsWith(`asset://${bucket}/`))
    return validatePath(reference.slice(`asset://${bucket}/`.length));
  const url = new URL(reference);
  if (url.origin !== new URL(allowedOrigin).origin || url.username || url.password)
    throw new Error("Aset harus berasal dari penyimpanan internal.");
  const patterns = [
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  const prefix = patterns.find((value) => url.pathname.startsWith(value));
  if (!prefix) throw new Error("Bucket aset tidak diizinkan.");
  return validatePath(decodeURIComponent(url.pathname.slice(prefix.length)));
}
function validatePath(path: string) {
  if (
    !path ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    path.includes("\\") ||
    path.includes("\0")
  )
    throw new Error("Path aset tidak valid.");
  return path;
}
export function assertOwnedPrefix(path: string, userId: string) {
  if (path.split("/")[0] !== userId) throw new Error("Forbidden: aset bukan milik pengguna ini.");
}
