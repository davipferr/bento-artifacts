import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Git Graph Playground',
  tagline: 'Type Git commands, watch the commit graph move.',
  description:
    'A toy Git with branches, HEAD, an origin remote, the index and the reflog. Type commit, branch, ' +
    'merge, rebase, reset, cherry-pick or push and the graph animates: branch labels slide, rebased ' +
    'commits are copied, and commits nothing points at fade out. Replay a scenario like undoing two ' +
    'pushed commits with reset HEAD~2 and a force push.',
  category: 'algorithms',
  tags: ['git', 'DAG', 'version control', 'SVG'],
  size: 'L',
  difficulty: 'medium',
  glyph: '⑂●',
}
