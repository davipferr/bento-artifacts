import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Pathfinding Playground',
  tagline: 'BFS, Dijkstra and A* explore your maze.',
  description:
    'Paint walls and heavy terrain, drag the start and goal, and watch four search algorithms ' +
    'flood the grid. After a run finishes the path stays live: edit the grid and it re-solves ' +
    'instantly. The side table runs every algorithm on the same grid so you can compare.',
  category: 'algorithms',
  tags: ['graphs', 'A*', 'Dijkstra', 'BFS', 'priority queue'],
  size: 'M',
  difficulty: 'easy',
  glyph: '▦▦▢',
}
