/**
 * Browser-local storage for a generated project's full source code.
 *
 * Replaces the old Base44 private-file upload (UploadPrivateFile +
 * CreateFileSignedUrl) so projects persist and reopen with ZERO integration
 * credits. The serialized project text is stored under a per-project key in
 * localStorage and referenced by a local handle "local:<key>"; the same key is
 * reused across updates for one conversation so storage never accumulates
 * duplicate blobs.
 */
import { serializeFiles } from './files';

const PREFIX = 'vibe_code_';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function isLocalCodeUri(codeUri) {
  return typeof codeUri === 'string' && codeUri.startsWith('local:');
}

// Saves the full project as text in localStorage. Pass an existing local
// handle to overwrite the same blob (one key per project). Returns a local
// handle "local:<key>", or null if the project is empty / storage is full.
export function saveLocalCode(files, existingUri = null) {
  const text = serializeFiles(files);
  if (!text || !text.trim()) return null;
  const key =
    existingUri && isLocalCodeUri(existingUri)
      ? existingUri.slice('local:'.length)
      : PREFIX + uid();
  try {
    localStorage.setItem(key, text);
    return 'local:' + key;
  } catch {
    // Quota exceeded — drop the oldest stored code blobs and retry once so a
    // large project doesn't silently vanish from Home.
    try {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .sort((a, b) => (localStorage.getItem(a + '_ts') || '').localeCompare(localStorage.getItem(b + '_ts') || ''));
      for (let i = 0; i < Math.min(3, keys.length); i++) localStorage.removeItem(keys[i]);
      localStorage.setItem(key, text);
      return 'local:' + key;
    } catch {
      return null;
    }
  }
}

// Returns the serialized project text for a local handle, or null if it isn't
// one / can't be read. Non-local handles (legacy Base44 file_uri) return null so
// the caller can fall back to the signed-URL path.
export function readLocalCode(codeUri) {
  if (!isLocalCodeUri(codeUri)) return null;
  const key = codeUri.slice('local:'.length);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}