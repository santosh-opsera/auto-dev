import type { CodebaseContext, FileStructureNode } from '../codebaseContext.js';
import type { RepositoryTreeEntry } from '../repositories.js';

export const sampleSmallRepoTree: RepositoryTreeEntry[] = [
  { path: 'src', type: 'dir' },
  { path: 'src/controllers', type: 'dir' },
  { path: 'src/controllers/userController.ts', type: 'file', size: 420 },
  { path: 'src/services', type: 'dir' },
  { path: 'src/services/userService.ts', type: 'file', size: 680 },
  { path: 'src/repositories', type: 'dir' },
  { path: 'src/repositories/userRepository.ts', type: 'file', size: 510 },
  { path: 'src/models', type: 'dir' },
  { path: 'src/models/userModel.ts', type: 'file', size: 240 },
  { path: 'src/services/userService.test.ts', type: 'file', size: 320 },
  { path: 'README.md', type: 'file', size: 120 },
];

export const sampleSmallRepoFiles: Record<string, string> = {
  'src/controllers/userController.ts':
    "import { userService } from '../services/userService.js';\nexport function getUser(id: string) { return userService.findById(id); }\n",
  'src/services/userService.ts':
    "import { userRepository } from '../repositories/userRepository.js';\nexport const userService = { findById: (id: string) => userRepository.findById(id) };\n",
  'src/repositories/userRepository.ts':
    "import { userModel } from '../models/userModel.js';\nexport const userRepository = { findById: (id: string) => userModel.find(id) };\n",
  'src/models/userModel.ts': 'export const userModel = { find: (id: string) => ({ id }) };\n',
};

export const sampleMediumRepoTree: RepositoryTreeEntry[] = [
  ...sampleSmallRepoTree,
  { path: 'src/factories', type: 'dir' },
  { path: 'src/factories/userFactory.ts', type: 'file', size: 180 },
  { path: 'src/events', type: 'dir' },
  { path: 'src/events/eventBus.ts', type: 'file', size: 900 },
];

export const sampleExpectedSmallContext: Pick<
  CodebaseContext,
  'strategy' | 'architecturalLayers' | 'designPatterns'
> = {
  strategy: 'on-demand',
  architecturalLayers: [
    { layer: 'controllers', paths: ['src/controllers'] },
    { layer: 'services', paths: ['src/services'] },
    { layer: 'repositories', paths: ['src/repositories'] },
    { layer: 'models', paths: ['src/models'] },
  ],
  designPatterns: [
    { pattern: 'mvc', evidence: ['src/controllers', 'src/models'], confidence: 0.8 },
    { pattern: 'repository', evidence: ['src/repositories'], confidence: 0.9 },
    { pattern: 'service-layer', evidence: ['src/services'], confidence: 0.9 },
  ],
};

export const sampleFileStructureMap: FileStructureNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'dir',
    children: [
      { name: 'controllers', path: 'src/controllers', type: 'dir' },
      { name: 'services', path: 'src/services', type: 'dir' },
    ],
  },
];
