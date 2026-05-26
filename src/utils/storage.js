function buildStoragePath(filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${Date.now()}-${safeName}`;
}

function extractStorageObjectPath(imageValue, storageBucket) {
  if (!imageValue) {
    return null;
  }

  const trimmedValue = String(imageValue).trim();
  if (!trimmedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    const publicPrefix = `/storage/v1/object/public/${storageBucket}/`;

    try {
      const parsedUrl = new URL(trimmedValue);
      const prefixIndex = parsedUrl.pathname.indexOf(publicPrefix);
      if (prefixIndex === -1) {
        return null;
      }

      return decodeURIComponent(
        parsedUrl.pathname.slice(prefixIndex + publicPrefix.length),
      );
    } catch {
      return null;
    }
  }

  return trimmedValue.replace(/^\/+/, "").replace(/^products\//, "");
}

module.exports = {
  buildStoragePath,
  extractStorageObjectPath,
};
