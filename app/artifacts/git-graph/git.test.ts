import { describe, expect, it } from 'vitest'
import { ancestors, headId, init, layout, mergeBase, resolve, run, tokenize, tracking, type Repo } from './git'

/** Run several lines, failing the test on the first error. */
function play(repo: Repo, ...lines: string[]): Repo {
  for (const line of lines) {
    const result = run(repo, line)
    if (result.error) throw new Error(`${line}: ${result.output.join(' ')}`)
    repo = result.repo
  }
  return repo
}

const messageAt = (repo: Repo, rev: string) => repo.commits[resolve(repo, rev)].message

describe('tokenize', () => {
  it('keeps quoted strings together', () => {
    expect(tokenize('git commit -m "Fix the bug"  now')).toEqual(['git', 'commit', '-m', 'Fix the bug', 'now'])
    expect(tokenize("git commit -m 'single'")).toEqual(['git', 'commit', '-m', 'single'])
  })
})

describe('commit and resolve', () => {
  it('commits on the current branch and walks back with ~ and ^', () => {
    const repo = play(init(), 'git commit -m A', 'git commit -m B')
    expect(messageAt(repo, 'main')).toBe('B')
    expect(messageAt(repo, 'HEAD~1')).toBe('A')
    expect(messageAt(repo, 'HEAD^^')).toBe('Initial commit')
    expect(messageAt(repo, headId(repo).slice(0, 4))).toBe('B')
  })

  it('refuses to go past the root', () => {
    expect(run(init(), 'git reset HEAD~1')).toMatchObject({ error: true })
  })

  it('asks for git add when only unstaged changes exist', () => {
    const repo = play(init(), 'touch app.ts')
    expect(run(repo, 'git commit -m x').error).toBe(true)
    const done = play(repo, 'git add .', 'git commit')
    expect(messageAt(done, 'HEAD')).toBe('edit app.ts')
    expect(done.staged).toEqual([])
  })
})

describe('reset', () => {
  // The exact thing we did to the real repo: drop two pushed commits but keep their changes.
  const pushed = () => play(init(), 'git commit -m "Finish the project"', 'git commit -m "Add artifacts"', 'git commit -m "Better Huffman text"', 'git push')

  it('--mixed moves the branch and leaves the changes unstaged', () => {
    const repo = play(pushed(), 'git reset HEAD~2')
    expect(messageAt(repo, 'main')).toBe('Finish the project')
    expect(repo.unstaged).toEqual(['Add artifacts', 'Better Huffman text'])
    expect(tracking(repo, 'main')).toEqual({ ahead: 0, behind: 2 })
  })

  it('--soft keeps them staged, --hard throws them away', () => {
    expect(play(pushed(), 'git reset --soft HEAD~2').staged).toEqual(['Add artifacts', 'Better Huffman text'])
    const hard = play(pushed(), 'git reset --hard HEAD~2')
    expect(hard.staged).toEqual([])
    expect(hard.unstaged).toEqual([])
  })

  it('needs a force push to rewrite the remote, and the old commits become unreachable', () => {
    const repo = play(pushed(), 'git reset HEAD~2', 'git commit -am "Re-add"')
    const rejected = run(repo, 'git push')
    expect(rejected.error).toBe(true)
    expect(rejected.repo).toBe(repo)
    const forced = play(repo, 'git push --force-with-lease')
    expect(forced.remote.main).toBe(forced.branches.main)
    const orphans = layout(forced).filter((p) => !p.reachable).map((p) => p.commit.message)
    expect(orphans).toEqual(['Add artifacts', 'Better Huffman text'])
  })

  it('can be undone from the reflog', () => {
    const repo = play(pushed(), 'git reset --hard HEAD~2')
    const before = repo.reflog[1].id
    expect(messageAt(play(repo, `git reset --hard ${before}`), 'HEAD')).toBe('Better Huffman text')
  })
})

describe('branches, merge and rebase', () => {
  const diverged = () =>
    play(init(), 'git commit -m base', 'git switch -c feature', 'git commit -m F1', 'git commit -m F2', 'git switch main', 'git commit -m M1')

  it('fast-forwards when possible', () => {
    const repo = play(init(), 'git branch topic', 'git switch topic', 'git commit -m T', 'git switch main')
    const merged = run(repo, 'git merge topic')
    expect(merged.output).toContain('Fast-forward')
    expect(merged.repo.branches.main).toBe(merged.repo.branches.topic)
  })

  it('makes a merge commit with two parents when histories diverged', () => {
    const repo = play(diverged(), 'git merge feature')
    const tip = repo.commits[repo.branches.main]
    expect(tip.parents).toEqual([resolve(repo, 'HEAD^1'), repo.branches.feature])
    expect(messageAt(repo, 'HEAD^2')).toBe('F2')
  })

  it('finds the merge base', () => {
    const repo = diverged()
    expect(repo.commits[mergeBase(repo, repo.branches.main, repo.branches.feature)!].message).toBe('base')
  })

  it('rebase replays copies on top and leaves the originals behind', () => {
    const before = diverged()
    const repo = play(before, 'git switch feature', 'git rebase main')
    expect(messageAt(repo, 'feature')).toBe('F2')
    expect(messageAt(repo, 'feature~1')).toBe('F1')
    expect(messageAt(repo, 'feature~2')).toBe('M1')
    expect(repo.branches.feature).not.toBe(before.branches.feature)
    expect(ancestors(repo, repo.branches.feature).has(before.branches.feature)).toBe(false)
  })

  it('refuses to delete an unmerged branch without -D', () => {
    expect(run(diverged(), 'git branch -d feature').error).toBe(true)
    expect(play(diverged(), 'git branch -D feature').branches.feature).toBeUndefined()
  })

  it('cherry-picks and reverts as new commits', () => {
    const repo = play(diverged(), `git cherry-pick feature~1`, 'git revert HEAD~1')
    expect(messageAt(repo, 'HEAD~1')).toBe('F1')
    expect(messageAt(repo, 'HEAD')).toBe('Revert "M1"')
  })

  it('detaches HEAD on checkout of a commit', () => {
    const repo = play(diverged(), 'git checkout HEAD~1')
    expect('detached' in repo.head).toBe(true)
    expect(run(repo, 'git branch').output[0]).toMatch(/HEAD detached/)
  })
})

describe('layout', () => {
  it('keeps main in lane 0 and gives a side branch its own lane', () => {
    const repo = play(init(), 'git switch -c feature', 'git commit -m F', 'git switch main', 'git commit -m M')
    const placed = layout(repo)
    const lane = (msg: string) => placed.find((p) => p.commit.message === msg)!.lane
    expect(lane('Initial commit')).toBe(0)
    expect(lane('M')).toBe(0)
    expect(lane('F')).toBe(1)
  })

  it('places every parent left of its children', () => {
    const repo = play(init(), 'git commit -m a', 'git switch -c x', 'git commit -m b', 'git switch main', 'git merge --no-ff x')
    const placed = layout(repo)
    const depth = new Map(placed.map((p) => [p.commit.id, p.depth]))
    for (const p of placed) for (const parent of p.commit.parents) expect(depth.get(parent)!).toBeLessThan(p.depth)
  })
})
