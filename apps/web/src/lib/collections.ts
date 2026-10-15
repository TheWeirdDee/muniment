import { type Collection, type CollectionItem, type Hex, type Observation, isEntityKey } from "muniment-query"
import { createStore } from "./store"

const validate = (v: unknown): Collection[] | null => {
  if (!Array.isArray(v)) return null
  return v.filter(
    (c): c is Collection =>
      typeof c === "object" && c !== null && typeof (c as Collection).id === "string" && typeof (c as Collection).name === "string" && Array.isArray((c as Collection).items),
  ).map((c) => ({ ...c, items: c.items.filter((i) => isEntityKey(i?.key)) }))
}

export const collectionsStore = createStore<Collection[]>("muniment.collections.v1", [], validate)

export function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
}

export function createCollection(name: string): Collection {
  const c: Collection = { id: newId(), name: name.trim().slice(0, 80) || "Untitled collection", createdAtMs: Date.now(), items: [] }
  collectionsStore.set((all) => [...all, c])
  return c
}

export function renameCollection(id: string, name: string) {
  collectionsStore.set((all) => all.map((c) => (c.id === id ? { ...c, name: name.trim().slice(0, 80) || c.name } : c)))
}

export function deleteCollection(id: string) {
  collectionsStore.set((all) => all.filter((c) => c.id !== id))
}

export function addToCollection(id: string, key: Hex, observation: Observation | null): "added" | "exists" {
  let result: "added" | "exists" = "added"
  collectionsStore.set((all) =>
    all.map((c) => {
      if (c.id !== id) return c
      if (c.items.some((i) => i.key === key)) {
        result = "exists"
        return { ...c, items: c.items.map((i) => (i.key === key && observation ? { ...i, observation } : i)) }
      }
      const item: CollectionItem = { key, addedAtMs: Date.now(), observation }
      return { ...c, items: [...c.items, item] }
    }),
  )
  return result
}

export function removeFromCollection(id: string, key: Hex) {
  collectionsStore.set((all) => all.map((c) => (c.id === id ? { ...c, items: c.items.filter((i) => i.key !== key) } : c)))
}

export function setNote(id: string, key: Hex, note: string) {
  collectionsStore.set((all) =>
    all.map((c) =>
      c.id === id ? { ...c, items: c.items.map((i) => (i.key === key ? { ...i, note: note.slice(0, 2000) || undefined } : i)) } : c,
    ),
  )
}

export function mergeImported(imported: Collection[]) {
  collectionsStore.set((all) => [...all, ...imported])
}
