import { useMemo, useState, type CSSProperties } from 'react'
import { categories, type Category } from './artifacts/types'
import { href } from './kit/router'
import { ThemeToggle } from './kit/theme'
import { artifacts, type Artifact } from './registry'
import { roadmap, type Planned } from './roadmap'
import { TilePreview } from './TilePreview'

type Tile = { built: true; item: Artifact } | { built: false; item: Planned }

const built = new Set(artifacts.map((a) => a.slug))
const tiles: Tile[] = [
  ...artifacts.map((item): Tile => ({ built: true, item })),
  ...roadmap.filter((p) => !built.has(p.slug)).map((item): Tile => ({ built: false, item })),
]

const matches = (tile: Tile, query: string) => {
  if (!query) return true
  const { item } = tile
  const text = [item.title, item.tagline, categories[item.category], ...(tile.built ? tile.item.tags : [])]
  return text.join(' ').toLowerCase().includes(query)
}

export function Gallery() {
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tiles.filter((t) => (category === 'all' || t.item.category === category) && matches(t, q))
  }, [category, query])

  return (
    <div className="page">
      <header className="gallery-header">
        <div>
          <h1 className="logo">
            <span className="logo-mark" aria-hidden>
              <i /> <i /> <i />
            </span>
            Bento
          </h1>
          <p className="muted">
            Small, self-contained interactive artifacts. Each one does a single thing; open one and play.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="filters">
        <input
          className="search"
          type="search"
          placeholder="Search artifacts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search artifacts"
        />
        <div className="presets" role="radiogroup" aria-label="Category">
          <button
            role="radio"
            aria-checked={category === 'all'}
            className={`chip${category === 'all' ? ' active' : ''}`}
            onClick={() => setCategory('all')}
          >
            All <span className="count">{tiles.length}</span>
          </button>
          {(Object.keys(categories) as Category[]).map((key) => (
            <button
              key={key}
              role="radio"
              aria-checked={category === key}
              className={`chip${category === key ? ' active' : ''}`}
              style={{ '--cat': `var(--cat-${key})` } as CSSProperties}
              onClick={() => setCategory(key)}
            >
              <i className="dot" /> {categories[key]}{' '}
              <span className="count">{tiles.filter((t) => t.item.category === key).length}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="muted empty">No artifact matches “{query}”.</p>
      ) : (
        <div className="bento">
          {visible.map((tile) => (
            <TileView key={tile.item.slug} tile={tile} />
          ))}
        </div>
      )}

      <footer className="footer muted small">
        {artifacts.length} artifacts
        {tiles.length > artifacts.length && ` · ${tiles.length - artifacts.length} on the way`}
      </footer>
    </div>
  )
}

function TileView({ tile }: { tile: Tile }) {
  const { item } = tile
  const [active, setActive] = useState(false)
  const style = { '--cat': `var(--cat-${item.category})` } as CSSProperties
  const body = (
    <>
      <TilePreview load={tile.built ? tile.item.loadPreview : undefined} glyph={item.glyph} active={active} />
      <div className="tile-body">
        <span className="tile-category">
          <i className="dot" /> {categories[item.category]}
          {!tile.built && <span className="soon">soon</span>}
        </span>
        <h2>{item.title}</h2>
        <p>{item.tagline}</p>
      </div>
    </>
  )
  return tile.built ? (
    <a
      className={`tile size-${item.size}`}
      style={style}
      href={href(item.slug)}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      {body}
    </a>
  ) : (
    <div className={`tile size-${item.size} planned`} style={style}>
      {body}
    </div>
  )
}
