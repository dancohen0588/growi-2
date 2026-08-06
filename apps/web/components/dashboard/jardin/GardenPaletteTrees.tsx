'use client'

import { useEffect, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { ChevronDown, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTreeCatalog, type CatalogTreeItem } from '@/lib/actions/catalog.actions'
import type { PaletteItem } from '@/lib/garden/palette'
import { FALLBACK_TREE_ITEMS, TREE_TYPES, TREE_TYPE_LABELS } from '@/lib/garden/palette'

const PAGE_SIZE = 10

/** Emoji de repli selon le sous-type, quand la fiche catalogue n'en a pas. */
const TYPE_EMOJI: Record<string, string> = {
  CONIFER: '🌲',
  FRUIT: '🍎',
  SHRUB: '🌿',
  DECIDUOUS: '🌳',
}

// ── Component ─────────────────────────────────────────────────────────────

export function GardenPaletteTrees({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen]             = useState(defaultOpen)
  const [treeType, setTreeType]     = useState<string>('all')
  const [query, setQuery]           = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [items, setItems]           = useState<CatalogTreeItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [hasMore, setHasMore]       = useState(false)
  const [failed, setFailed]         = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(query), 200)
    return () => clearTimeout(h)
  }, [query])

  // Fetch on first open, then on any filter change (only while open)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    getTreeCatalog(treeType, debouncedQ, PAGE_SIZE, 0)
      .then(data => {
        if (cancelled) return
        setItems(data)
        setHasMore(data.length === PAGE_SIZE)
        setLoadedOnce(true)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, treeType, debouncedQ])

  async function loadMore() {
    if (loading) return
    setLoading(true)
    try {
      const next = await getTreeCatalog(treeType, debouncedQ, PAGE_SIZE, items.length)
      setItems(prev => [...prev, ...next])
      setHasMore(next.length === PAGE_SIZE)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-forest/10 last:border-0">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-sand transition-colors"
        aria-expanded={open}
      >
        <span className="font-poppins font-semibold text-[11px] text-forest uppercase tracking-wide">
          Arbres & arbustes
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn('text-forest/40 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-2 p-2">
          {/* Tree type dropdown */}
          <select
            value={treeType}
            onChange={e => setTreeType(e.target.value)}
            aria-label="Filtrer par type d'arbre"
            className="w-full rounded-md border border-forest/15 bg-white px-2 py-1 font-raleway text-[11px] text-forest focus:outline-none focus:ring-1 focus:ring-lime"
          >
            {TREE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Search input */}
          <div className="relative">
            <Search
              size={11}
              aria-hidden
              className="absolute left-2 top-1/2 -translate-y-1/2 text-forest/40 pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher un arbre ou un arbuste"
              className="w-full rounded-md border border-forest/15 bg-white pl-6 pr-6 py-1 font-raleway text-[11px] text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-lime"
            />
            {loading && (
              <Loader2
                size={11}
                aria-hidden
                className="absolute right-2 top-1/2 -translate-y-1/2 text-forest/40 animate-spin"
              />
            )}
          </div>

          {/* Fallback list when fetch failed */}
          {failed && !loading && items.length === 0 && (
            <>
              <p className="font-raleway text-[10px] text-forest/40 px-1">
                Catalogue indisponible — suggestions par défaut
              </p>
              <div className="flex flex-col gap-1">
                {FALLBACK_TREE_ITEMS.map(item => (
                  <FallbackRow key={item.label} item={item} />
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {!failed && loadedOnce && items.length === 0 && !loading && (
            <p className="font-raleway text-[10px] text-forest/40 px-1 py-2 text-center">
              Aucun résultat
            </p>
          )}

          {/* Dynamic list */}
          {items.length > 0 && (
            <ul className="flex flex-col gap-1">
              {items.map(tree => (
                <DraggableTreeRow key={tree.id} tree={tree} />
              ))}
            </ul>
          )}

          {/* Load more */}
          {hasMore && !loading && items.length > 0 && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-md border border-forest/15 bg-white px-2 py-1 font-raleway text-[10px] font-semibold text-forest/70 hover:bg-sand hover:text-forest transition-colors"
            >
              Charger plus
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Draggable row ─────────────────────────────────────────────────────────

function DraggableTreeRow({ tree }: { tree: CatalogTreeItem }) {
  const emoji = tree.emoji ?? TYPE_EMOJI[tree.treeType ?? 'DECIDUOUS'] ?? '🌳'
  const isShrub = tree.treeType === 'SHRUB'

  const paletteItem: PaletteItem = {
    type:            'arbre',
    emoji,
    label:           tree.commonName,
    defaultWidth:    isShrub ? 60 : 80,
    defaultHeight:   isShrub ? 60 : 80,
    isCircular:      true,
    catalogPlantId:  tree.id,
    catalogCategory: 'TREES_SHRUBS',
    catalogTreeType: tree.treeType ?? undefined,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `catalog-tree-${tree.id}`,
    data: paletteItem,
  })

  const [imgFailed, setImgFailed] = useState(false)
  const showImg = tree.imageUrl && !imgFailed

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Glisser ${tree.commonName} sur le canvas`}
      title={tree.commonName}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-sand px-2 py-1.5 cursor-grab select-none',
        'hover:border-lime hover:bg-[#f0fae0] transition-all duration-150',
        isDragging && 'opacity-50 cursor-grabbing',
      )}
    >
      <div className="shrink-0 h-9 w-9 overflow-hidden rounded-md bg-white border border-forest/10 flex items-center justify-center">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tree.imageUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg leading-none" aria-hidden>{emoji}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-poppins font-semibold text-[11px] text-forest truncate">
          {tree.commonName}
        </p>
        <p className="font-raleway text-[9px] text-forest/50 truncate">
          {TREE_TYPE_LABELS[tree.treeType ?? ''] ?? 'Arbre'}
          {tree.family ? ` · ${tree.family}` : ''}
        </p>
      </div>

      <span className="text-forest/30 text-sm leading-none" aria-hidden>⠿</span>
    </li>
  )
}

// ── Fallback row (static PaletteItem, drag-enabled) ───────────────────────

function FallbackRow({ item }: { item: PaletteItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `fallback-tree-${item.label}`,
    data: item,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Glisser ${item.label} sur le canvas`}
      title={item.label}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-sand px-2 py-1.5 cursor-grab select-none',
        'hover:border-lime hover:bg-[#f0fae0] transition-all duration-150',
        isDragging && 'opacity-50 cursor-grabbing',
      )}
    >
      <span className="text-xl leading-none" aria-hidden>{item.emoji}</span>
      <span className="flex-1 font-poppins font-semibold text-[11px] text-forest truncate">
        {item.label}
      </span>
      <span className="text-forest/30 text-sm leading-none" aria-hidden>⠿</span>
    </div>
  )
}
