import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const workerDir = resolve(here, '..')
export const repoDir = resolve(workerDir, '..', '..')
export const sourcesDir = resolve(repoDir, 'sources')
export const registryDir = resolve(repoDir, 'registry')
export const dataDir = resolve(repoDir, 'data')
export const webDataDir = resolve(repoDir, 'packages', 'web', 'public', 'data')
