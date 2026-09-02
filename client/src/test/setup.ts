import "@testing-library/jest-dom/vitest";

/**
 * Polyfill de Storage para testes.
 * Node 26+ expõe um `localStorage` global experimental que retorna `undefined`
 * quando `--localstorage-file` não é fornecido, sobrescrevendo a implementação
 * real do jsdom (que normalmente forneceria window.localStorage). Sem este
 * polyfill, qualquer teste que toque em localStorage/sessionStorage falha com
 * "Cannot read properties of undefined (reading 'setItem')".
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(window, "sessionStorage", {
    writable: true,
    value: new MemoryStorage(),
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
