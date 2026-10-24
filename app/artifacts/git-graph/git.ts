/**
 * A toy Git: just enough of the object model (commits, branches, HEAD, one remote, the index
 * and the reflog) to replay everyday commands and see what they do to the graph.
 * Commands never mutate: each one returns a new Repo plus the lines Git would print.
 */
export interface Commit {
  id: string
  parents: string[]
  message: string
  /** Creation order; also breaks ties so everything stays deterministic. */
  seq: number
}

export type Head = { branch: string } | { detached: string }

export interface Repo {
  commits: Record<string, Commit>
  branches: Record<string, string>
  /** Remote-tracking branches: what we last pushed to `origin/<name>`. */
  remote: Record<string, string>
  head: Head
  /** Changes in the index (ready to commit) and in the working tree (not added yet). */
  staged: string[]
  unstaged: string[]
  /** Where HEAD has been, newest first. */
  reflog: { id: string; action: string }[]
  seq: number
}

export interface Result {
  repo: Repo
  output: string[]
  error?: boolean
}

export class GitError extends Error {}

/** FNV-1a, printed as 7 hex digits: looks like a short SHA and is stable across runs. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

export function init(): Repo {
  const root: Commit = { id: hash('1:Initial commit'), parents: [], message: 'Initial commit', seq: 1 }
  return {
    commits: { [root.id]: root },
    branches: { main: root.id },
    remote: {},
    head: { branch: 'main' },
    staged: [],
    unstaged: [],
    reflog: [{ id: root.id, action: 'commit (initial): Initial commit' }],
    seq: 1,
  }
}

export const headId = (repo: Repo) => ('branch' in repo.head ? repo.branches[repo.head.branch] : repo.head.detached)
export const short = (id: string) => id.slice(0, 7)

/** Add a commit with a fresh id. */
function addCommit(repo: Repo, parents: string[], message: string): [Repo, Commit] {
  const seq = repo.seq + 1
  let id = hash(`${seq}:${message}:${parents.join(',')}`)
  for (let salt = 1; repo.commits[id]; salt++) id = hash(`${seq}:${message}:${salt}`)
  const commit: Commit = { id, parents, message, seq }
  return [{ ...repo, seq, commits: { ...repo.commits, [id]: commit } }, commit]
}

/** Point HEAD's branch (or detached HEAD) at `id` and log why. */
function moveHead(repo: Repo, id: string, action: string): Repo {
  const reflog = [{ id, action }, ...repo.reflog]
  if ('branch' in repo.head) return { ...repo, reflog, branches: { ...repo.branches, [repo.head.branch]: id } }
  return { ...repo, reflog, head: { detached: id } }
}

/** Every commit reachable from `ids` (inclusive). */
export function ancestors(repo: Repo, ...ids: string[]): Set<string> {
  const seen = new Set<string>()
  const stack = [...ids]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...repo.commits[id].parents)
  }
  return seen
}

export const isAncestor = (repo: Repo, a: string, b: string) => ancestors(repo, b).has(a)

/** The best common ancestor: a shared commit that no other shared commit descends from. */
export function mergeBase(repo: Repo, a: string, b: string): string | null {
  const ofB = ancestors(repo, b)
  const common = [...ancestors(repo, a)].filter((id) => ofB.has(id))
  const best = common.filter((c) => !common.some((d) => d !== c && isAncestor(repo, c, d)))
  return best.sort((x, y) => repo.commits[y].seq - repo.commits[x].seq)[0] ?? null
}

/**
 * Resolve a revision: `HEAD`, a branch, `origin/<branch>`, a unique id prefix (4+ characters),
 * each optionally followed by `~n` (n first parents back) and `^n` (the n-th parent).
 */
export function resolve(repo: Repo, rev: string): string {
  const match = /^([^~^]+)((?:[~^]\d*)*)$/.exec(rev)
  if (!match) throw new GitError(`fatal: ambiguous argument '${rev}': unknown revision`)
  const [, base, suffix] = match
  let id: string | undefined
  if (base === 'HEAD' || base === '@') id = headId(repo)
  else if (repo.branches[base]) id = repo.branches[base]
  else if (base.startsWith('origin/') && repo.remote[base.slice(7)]) id = repo.remote[base.slice(7)]
  else if (/^[0-9a-f]{4,}$/.test(base)) {
    const found = Object.keys(repo.commits).filter((c) => c.startsWith(base))
    if (found.length > 1) throw new GitError(`error: short object ID ${base} is ambiguous`)
    id = found[0]
  }
  if (!id) throw new GitError(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.`)
  for (const [, op, digits] of suffix.matchAll(/([~^])(\d*)/g)) {
    const n = digits === '' ? 1 : Number(digits)
    if (op === '~') {
      for (let i = 0; i < n; i++) {
        const parent: string | undefined = repo.commits[id].parents[0]
        if (!parent) throw new GitError(`fatal: '${rev}' goes back further than the first commit`)
        id = parent
      }
    } else if (n > 0) {
      const parent: string | undefined = repo.commits[id].parents[n - 1]
      if (!parent) throw new GitError(`fatal: '${rev}': commit ${short(id)} has no parent ${n}`)
      id = parent
    }
  }
  return id
}

/** Split a command line on spaces, keeping "quoted strings" together. */
export function tokenize(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3])
}

const validBranch = (name: string) => /^[A-Za-z0-9._/-]+$/.test(name) && !name.startsWith('-') && name !== 'HEAD'

/** Lines like `* main` for `git branch`. */
function listBranches(repo: Repo): string[] {
  const current = 'branch' in repo.head ? repo.head.branch : null
  const lines = Object.keys(repo.branches)
    .sort()
    .map((name) => `${name === current ? '*' : ' '} ${name}`)
  if (!current) lines.unshift(`* (HEAD detached at ${short(headId(repo))})`)
  return lines
}

/** The refs pointing at a commit, the way `git log --decorate` prints them. */
export function decorations(repo: Repo, id: string): string[] {
  const refs: string[] = []
  const current = 'branch' in repo.head ? repo.head.branch : null
  if ('detached' in repo.head && repo.head.detached === id) refs.push('HEAD')
  for (const [name, tip] of Object.entries(repo.branches).sort()) {
    if (tip === id) refs.push(name === current ? `HEAD -> ${name}` : name)
  }
  for (const [name, tip] of Object.entries(repo.remote).sort()) if (tip === id) refs.push(`origin/${name}`)
  return refs
}

/** Ahead/behind counts between a branch and its origin copy. */
export function tracking(repo: Repo, branch: string): { ahead: number; behind: number } | null {
  const remote = repo.remote[branch]
  if (!remote) return null
  const local = ancestors(repo, repo.branches[branch])
  const theirs = ancestors(repo, remote)
  return {
    ahead: [...local].filter((id) => !theirs.has(id)).length,
    behind: [...theirs].filter((id) => !local.has(id)).length,
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function status(repo: Repo): string[] {
  const lines: string[] = []
  if ('branch' in repo.head) {
    const branch = repo.head.branch
    lines.push(`On branch ${branch}`)
    const t = tracking(repo, branch)
    if (t) {
      if (t.ahead && t.behind)
        lines.push(`Your branch and 'origin/${branch}' have diverged: ${t.ahead} and ${t.behind} different commits each.`)
      else if (t.ahead) lines.push(`Your branch is ahead of 'origin/${branch}' by ${plural(t.ahead, 'commit')}.`)
      else if (t.behind) lines.push(`Your branch is behind 'origin/${branch}' by ${plural(t.behind, 'commit')}.`)
      else lines.push(`Your branch is up to date with 'origin/${branch}'.`)
    }
  } else lines.push(`HEAD detached at ${short(repo.head.detached)}`)
  if (repo.staged.length) lines.push('Changes to be committed:', ...repo.staged.map((c) => `    ${c}`))
  if (repo.unstaged.length) lines.push('Changes not staged for commit:', ...repo.unstaged.map((c) => `    ${c}`))
  if (!repo.staged.length && !repo.unstaged.length) lines.push('nothing to commit, working tree clean')
  return lines
}

function log(repo: Repo): string[] {
  const seen = [...ancestors(repo, headId(repo))].map((id) => repo.commits[id])
  return seen
    .sort((a, b) => b.seq - a.seq)
    .slice(0, 12)
    .map((c) => {
      const refs = decorations(repo, c.id)
      return `${c.id}${refs.length ? ` (${refs.join(', ')})` : ''} ${c.message}`
    })
}

function commit(repo: Repo, args: string[]): Result {
  let message: string | undefined
  let all = false
  let amend = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-m' || a === '-am' || a === '-a') {
      all ||= a !== '-m'
      if (a !== '-a') message = args[++i]
    } else if (a === '--amend') amend = true
    else if (a.startsWith('-')) throw new GitError(`error: unknown option '${a}'`)
  }
  let staged = repo.staged
  let unstaged = repo.unstaged
  if (all) [staged, unstaged] = [[...staged, ...unstaged], []]
  if (!staged.length && unstaged.length && !amend)
    throw new GitError('no changes added to commit (use "git add" and/or "git commit -a")')
  const tip = repo.commits[headId(repo)]
  if (amend) {
    const [next, c] = addCommit(repo, tip.parents, message ?? tip.message)
    const moved = moveHead(next, c.id, `commit (amend): ${c.message}`)
    return { repo: { ...moved, staged: [], unstaged }, output: [`[${branchLabel(repo)} ${c.id}] ${c.message}`] }
  }
  const text = message ?? (staged.length ? staged.join(', ') : `Commit ${repo.seq + 1}`)
  const [next, c] = addCommit(repo, [tip.id], text)
  const moved = moveHead(next, c.id, `commit: ${text}`)
  return { repo: { ...moved, staged: [], unstaged }, output: [`[${branchLabel(repo)} ${c.id}] ${text}`] }
}

const branchLabel = (repo: Repo) => ('branch' in repo.head ? repo.head.branch : 'detached HEAD')

function branch(repo: Repo, args: string[]): Result {
  if (!args.length) return { repo, output: listBranches(repo) }
  if (args[0] === '-d' || args[0] === '-D') {
    const name = args[1]
    if (!name || !repo.branches[name]) throw new GitError(`error: branch '${name ?? ''}' not found`)
    if ('branch' in repo.head && repo.head.branch === name)
      throw new GitError(`error: cannot delete branch '${name}' used by HEAD`)
    if (args[0] === '-d' && !isAncestor(repo, repo.branches[name], headId(repo)))
      throw new GitError(`error: the branch '${name}' is not fully merged (use -D to delete it anyway)`)
    const { [name]: gone, ...branches } = repo.branches
    return { repo: { ...repo, branches }, output: [`Deleted branch ${name} (was ${gone}).`] }
  }
  if (args[0] === '-m') {
    const [from, to] = args.length >= 3 ? [args[1], args[2]] : ['branch' in repo.head ? repo.head.branch : '', args[1]]
    if (!repo.branches[from]) throw new GitError(`error: no branch named '${from}'`)
    if (!to || !validBranch(to)) throw new GitError(`fatal: '${to ?? ''}' is not a valid branch name`)
    if (repo.branches[to]) throw new GitError(`fatal: a branch named '${to}' already exists`)
    const { [from]: tip, ...rest } = repo.branches
    const head = 'branch' in repo.head && repo.head.branch === from ? { branch: to } : repo.head
    return { repo: { ...repo, head, branches: { ...rest, [to]: tip } }, output: [] }
  }
  return { repo: createBranch(repo, args[0], args[1]), output: [] }
}

function createBranch(repo: Repo, name: string, start?: string): Repo {
  if (!validBranch(name)) throw new GitError(`fatal: '${name}' is not a valid branch name`)
  if (repo.branches[name]) throw new GitError(`fatal: a branch named '${name}' already exists`)
  return { ...repo, branches: { ...repo.branches, [name]: resolve(repo, start ?? 'HEAD') } }
}

function checkout(repo: Repo, args: string[], create: '-b' | '-c'): Result {
  const from = 'branch' in repo.head ? repo.head.branch : short(repo.head.detached)
  if (args[0] === create || (create === '-c' && args[0] === '-b')) {
    const name = args[1]
    if (!name) throw new GitError(`error: switch '${create}' requires a value`)
    const next = createBranch(repo, name, args[2])
    const id = next.branches[name]
    return {
      repo: { ...next, head: { branch: name }, reflog: [{ id, action: `checkout: moving from ${from} to ${name}` }, ...repo.reflog] },
      output: [`Switched to a new branch '${name}'`],
    }
  }
  const target = args.find((a) => !a.startsWith('-'))
  if (!target) throw new GitError('fatal: you must specify a branch to switch to')
  if (repo.branches[target]) {
    const id = repo.branches[target]
    return {
      repo: { ...repo, head: { branch: target }, reflog: [{ id, action: `checkout: moving from ${from} to ${target}` }, ...repo.reflog] },
      output: [`Switched to branch '${target}'`],
    }
  }
  if (create === '-c' && !args.includes('--detach'))
    throw new GitError(`fatal: a branch is expected, got '${target}' (use --detach to look at a commit)`)
  const id = resolve(repo, target)
  return {
    repo: { ...repo, head: { detached: id }, reflog: [{ id, action: `checkout: moving from ${from} to ${short(id)}` }, ...repo.reflog] },
    output: [`HEAD is now at ${short(id)} ${repo.commits[id].message}`, "You are in 'detached HEAD' state."],
  }
}

function merge(repo: Repo, args: string[]): Result {
  const noFf = args.includes('--no-ff')
  const name = args.find((a) => !a.startsWith('-'))
  if (!name) throw new GitError('fatal: no commit specified for merge')
  const theirs = resolve(repo, name)
  const ours = headId(repo)
  if (isAncestor(repo, theirs, ours)) return { repo, output: ['Already up to date.'] }
  if (!noFf && isAncestor(repo, ours, theirs)) {
    return {
      repo: moveHead(repo, theirs, `merge ${name}: Fast-forward`),
      output: [`Updating ${short(ours)}..${short(theirs)}`, 'Fast-forward'],
    }
  }
  const message = `Merge ${repo.branches[name] ? `branch '${name}'` : name} into ${branchLabel(repo)}`
  const [next, c] = addCommit(repo, [ours, theirs], message)
  return { repo: moveHead(next, c.id, `merge ${name}: Merge made by the 'ort' strategy.`), output: [`Merge made by the 'ort' strategy. (${c.id})`] }
}

/** Commits on HEAD that `upstream` doesn't have, oldest first, merges left out (like plain `git rebase`). */
export function toReplay(repo: Repo, upstream: string): Commit[] {
  const theirs = ancestors(repo, upstream)
  return [...ancestors(repo, headId(repo))]
    .filter((id) => !theirs.has(id))
    .map((id) => repo.commits[id])
    .filter((c) => c.parents.length === 1)
    .sort((a, b) => a.seq - b.seq)
}

function rebase(repo: Repo, args: string[]): Result {
  const name = args.find((a) => !a.startsWith('-'))
  if (!name) throw new GitError('fatal: no upstream configured; give a branch to rebase onto')
  if (repo.staged.length || repo.unstaged.length)
    throw new GitError('error: cannot rebase: You have unstaged changes. Please commit or stash them.')
  const onto = resolve(repo, name)
  const ours = headId(repo)
  if (isAncestor(repo, onto, ours)) return { repo, output: ['Current branch is up to date.'] }
  if (isAncestor(repo, ours, onto)) {
    return { repo: moveHead(repo, onto, `rebase (finish): returning to ${branchLabel(repo)}`), output: [`Fast-forwarded ${branchLabel(repo)} to ${name}.`] }
  }
  let next = repo
  let tip = onto
  const output: string[] = []
  for (const old of toReplay(repo, onto)) {
    const [after, copy] = addCommit(next, [tip], old.message)
    next = after
    tip = copy.id
    output.push(`  ${short(old.id)} → ${copy.id}  ${old.message}`)
  }
  return {
    repo: moveHead(next, tip, `rebase (finish): ${branchLabel(repo)} onto ${short(onto)}`),
    output: [`Successfully rebased and updated ${'branch' in repo.head ? `refs/heads/${repo.head.branch}` : 'HEAD'}.`, ...output],
  }
}

function reset(repo: Repo, args: string[]): Result {
  const mode = args.find((a) => a === '--soft' || a === '--mixed' || a === '--hard') ?? '--mixed'
  const unknown = args.find((a) => a.startsWith('-') && a !== mode)
  if (unknown) throw new GitError(`error: unknown option '${unknown}'`)
  const rev = args.find((a) => !a.startsWith('-')) ?? 'HEAD'
  const target = resolve(repo, rev)
  // The changes "undone" are the commits HEAD has that the target doesn't, oldest first.
  const keep = ancestors(repo, target)
  const undone = [...ancestors(repo, headId(repo))]
    .filter((id) => !keep.has(id))
    .map((id) => repo.commits[id])
    .sort((a, b) => a.seq - b.seq)
    .map((c) => c.message)
  const moved = moveHead(repo, target, `reset: moving to ${rev}`)
  const output = mode === '--hard' ? [`HEAD is now at ${short(target)} ${repo.commits[target].message}`] : []
  if (mode === '--soft') return { repo: { ...moved, staged: [...undone, ...repo.staged] }, output }
  if (mode === '--mixed') {
    const unstaged = [...undone, ...repo.staged, ...repo.unstaged]
    return { repo: { ...moved, staged: [], unstaged }, output: unstaged.length ? ['Unstaged changes after reset:', ...unstaged.map((c) => `M\t${c}`)] : [] }
  }
  return { repo: { ...moved, staged: [], unstaged: [] }, output }
}

function cherryPick(repo: Repo, args: string[]): Result {
  const rev = args[0]
  if (!rev) throw new GitError('fatal: no commit specified for cherry-pick')
  const picked = repo.commits[resolve(repo, rev)]
  if (picked.parents.length > 1) throw new GitError(`error: commit ${short(picked.id)} is a merge but no -m option was given.`)
  const [next, c] = addCommit(repo, [headId(repo)], picked.message)
  return { repo: moveHead(next, c.id, `cherry-pick: ${c.message}`), output: [`[${branchLabel(repo)} ${c.id}] ${c.message}`] }
}

function revert(repo: Repo, args: string[]): Result {
  const rev = args[0]
  if (!rev) throw new GitError('fatal: no commit specified for revert')
  const target = repo.commits[resolve(repo, rev)]
  const message = `Revert "${target.message}"`
  const [next, c] = addCommit(repo, [headId(repo)], message)
  return { repo: moveHead(next, c.id, `revert: ${message}`), output: [`[${branchLabel(repo)} ${c.id}] ${message}`] }
}

function push(repo: Repo, args: string[]): Result {
  const force = args.some((a) => a === '--force' || a === '-f' || a === '--force-with-lease')
  const names = args.filter((a) => !a.startsWith('-'))
  if (names[0] && names[0] !== 'origin') throw new GitError(`fatal: '${names[0]}' does not appear to be a git repository`)
  const name = names[1] ?? ('branch' in repo.head ? repo.head.branch : null)
  if (!name) throw new GitError('fatal: You are not currently on a branch.')
  const local = repo.branches[name]
  if (!local) throw new GitError(`error: src refspec ${name} does not match any`)
  const theirs = repo.remote[name]
  const updated = { ...repo, remote: { ...repo.remote, [name]: local } }
  if (!theirs) return { repo: updated, output: [' * [new branch]      ' + `${name} -> ${name}`] }
  if (theirs === local) return { repo, output: ['Everything up-to-date'] }
  if (isAncestor(repo, theirs, local)) return { repo: updated, output: [`   ${short(theirs)}..${short(local)}  ${name} -> ${name}`] }
  if (!force) {
    return {
      repo,
      error: true,
      output: [
        ` ! [rejected]        ${name} -> ${name} (non-fast-forward)`,
        "hint: Updates were rejected because the tip of your current branch is behind or has diverged from its remote counterpart.",
        'hint: Rewriting shared history needs --force (or the safer --force-with-lease).',
      ],
    }
  }
  return { repo: updated, output: [` + ${short(theirs)}...${short(local)} ${name} -> ${name} (forced update)`] }
}

function add(repo: Repo, args: string[]): Result {
  if (!args.length) throw new GitError('Nothing specified, nothing added. (try "git add .")')
  if (!repo.unstaged.length) return { repo, output: [] }
  return { repo: { ...repo, staged: [...repo.staged, ...repo.unstaged], unstaged: [] }, output: [] }
}

export const HELP = [
  'git commit [-m "msg"] [-a] [--amend]   git add .        touch <file>',
  'git branch [<name> | -d <name> | -m <old> <new>]',
  'git checkout <ref> | -b <name>         git switch <name> | -c <name>',
  'git merge <ref> [--no-ff]              git rebase <ref>',
  'git reset [--soft | --mixed | --hard] <ref>',
  'git cherry-pick <ref>                  git revert <ref>',
  'git push [--force | --force-with-lease]',
  'git status · git log · git reflog · clear · undo',
  'Refs: main, origin/main, HEAD, HEAD~2, HEAD^2, a 4+ char id like 3fa9',
]

/** Run one command line. Errors come back as output lines with `error: true`. */
export function run(repo: Repo, line: string): Result {
  const words = tokenize(line.trim())
  if (!words.length) return { repo, output: [] }
  if (words[0] === 'help') return { repo, output: HELP }
  if (words[0] === 'touch') {
    if (words.length < 2) return { repo, output: ['usage: touch <file>'], error: true }
    return { repo: { ...repo, unstaged: [...repo.unstaged, ...words.slice(1).map((f) => `edit ${f}`)] }, output: [] }
  }
  if (words[0] !== 'git') return { repo, output: [`command not found: ${words[0]} (try "help")`], error: true }
  const [, command, ...args] = words
  try {
    switch (command) {
      case 'commit':
        return commit(repo, args)
      case 'add':
        return add(repo, args)
      case 'branch':
        return branch(repo, args)
      case 'checkout':
        return checkout(repo, args, '-b')
      case 'switch':
        return checkout(repo, args, '-c')
      case 'merge':
        return merge(repo, args)
      case 'rebase':
        return rebase(repo, args)
      case 'reset':
        return reset(repo, args)
      case 'cherry-pick':
        return cherryPick(repo, args)
      case 'revert':
        return revert(repo, args)
      case 'push':
        return push(repo, args)
      case 'status':
        return { repo, output: status(repo) }
      case 'log':
        return { repo, output: log(repo) }
      case 'reflog':
        return { repo, output: repo.reflog.slice(0, 12).map((r, i) => `${short(r.id)} HEAD@{${i}}: ${r.action}`) }
      case undefined:
        return { repo, output: HELP }
      default:
        return { repo, output: [`git: '${command}' is not a git command here. Try "help".`], error: true }
    }
  } catch (error) {
    if (error instanceof GitError) return { repo, output: [error.message], error: true }
    throw error
  }
}

// ---- Layout ------------------------------------------------------------

export interface Placed {
  commit: Commit
  /** Column: the longest path from the root, so parents are always left of children. */
  depth: number
  lane: number
  /** False for commits no branch, remote or HEAD can reach any more (they'd show up in the reflog). */
  reachable: boolean
}

/**
 * Lay the graph out left to right. Each ref's first-parent chain gets one lane, `main` first,
 * placed in the lowest lane that's free over the columns it spans.
 */
export function layout(repo: Repo, showUnreachable = true): Placed[] {
  const live = ancestors(repo, headId(repo), ...Object.values(repo.branches), ...Object.values(repo.remote))
  const commits = Object.values(repo.commits)
    .filter((c) => showUnreachable || live.has(c.id))
    .sort((a, b) => a.seq - b.seq)
  const depth = new Map<string, number>()
  for (const c of commits) depth.set(c.id, Math.max(-1, ...c.parents.map((p) => depth.get(p) ?? -1)) + 1)

  const priority = (name: string) => (name === 'main' || name === 'master' ? 0 : 1)
  const tips = [
    ...Object.entries(repo.branches)
      .sort(([a], [b]) => priority(a) - priority(b) || a.localeCompare(b))
      .map(([, id]) => id),
    headId(repo),
    ...Object.values(repo.remote),
    ...[...commits].reverse().map((c) => c.id),
  ]

  const lane = new Map<string, number>()
  const busy: [number, number][][] = []
  for (const tip of tips) {
    if (lane.has(tip) || !depth.has(tip)) continue
    const chain: string[] = []
    let at: string | undefined = tip
    while (at && !lane.has(at) && depth.has(at)) {
      chain.push(at)
      at = repo.commits[at].parents[0]
    }
    const hi = depth.get(chain[0])!
    const lo = at && lane.has(at) ? depth.get(at)! + 1 : depth.get(chain[chain.length - 1])!
    // A one-column gap between chains in a lane keeps them from looking connected.
    let l = 0
    while (busy[l]?.some(([a, b]) => lo <= b + 1 && hi + 1 >= a)) l++
    ;(busy[l] ??= []).push([lo, hi])
    for (const id of chain) lane.set(id, l)
  }
  return commits.map((commit) => ({ commit, depth: depth.get(commit.id)!, lane: lane.get(commit.id)!, reachable: live.has(commit.id) }))
}
