const HASH_PREFIX = '#i=';
const INVENTORY_VERSION = 1;

export interface SharedInventory {
  v: number;
  inventory: Record<string, number>;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function encodeInventoryHash(inventory: ReadonlyMap<string, number>): string {
  const payload: SharedInventory = {
    v: INVENTORY_VERSION,
    inventory: Object.fromEntries(
      [...inventory.entries()]
        .filter(([, count]) => Number.isInteger(count) && count > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  return `${HASH_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export function decodeInventoryHash(
  hash: string,
  validCounts: ReadonlyMap<string, number>,
): Map<string, number> | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const decoded = fromBase64Url(hash.slice(HASH_PREFIX.length));
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as Partial<SharedInventory>;
    if (payload.v !== INVENTORY_VERSION || !payload.inventory || typeof payload.inventory !== 'object') return null;
    const inventory = new Map<string, number>();
    for (const [id, value] of Object.entries(payload.inventory)) {
      const max = validCounts.get(id);
      if (max === undefined || typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
        return null;
      }
      inventory.set(id, value);
    }
    return inventory;
  } catch {
    return null;
  }
}

export function writeInventoryHash(inventory: ReadonlyMap<string, number>): void {
  history.replaceState(null, '', `${location.pathname}${location.search}${encodeInventoryHash(inventory)}`);
}

let pendingHashUpdate: ReturnType<typeof setTimeout> | undefined;

export function scheduleInventoryHash(inventory: ReadonlyMap<string, number>, delay = 150): void {
  if (pendingHashUpdate !== undefined) clearTimeout(pendingHashUpdate);
  pendingHashUpdate = setTimeout(() => {
    pendingHashUpdate = undefined;
    writeInventoryHash(inventory);
  }, delay);
}
