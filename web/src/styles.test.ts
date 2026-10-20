import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(__dirname)
const css = readFileSync(join(srcDir, 'styles.css'), 'utf8')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

describe('styles.css', () => {
  it('memiliki style untuk setiap className statis di komponen', () => {
    const missing = new Set<string>()
    for (const file of tsxFiles(srcDir)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/className="([^"]+)"/g)) {
        for (const name of match[1]!.split(/\s+/)) {
          if (!new RegExp(`\\.${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`).test(css)) missing.add(`${name} (${file.split(/[\\/]/).pop()})`)
        }
      }
    }
    expect([...missing]).toEqual([])
  })

  it('tidak memiliki aturan kosong (tanda properti terhapus tanpa sengaja)', () => {
    const empty = [...css.matchAll(/([^{}]+)\{\s*\}/g)].map((m) => m[1]!.trim())
    expect(empty).toEqual([])
  })
})
