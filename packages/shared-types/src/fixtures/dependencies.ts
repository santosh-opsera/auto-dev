import type {
  ConsumerPackageJson,
  DependencyConsumer,
  DependencyGraph,
  DependencyScanRequest,
  DependencyUpdateProposal,
  PackageBumpNotifyRequest,
  RepositoryDependencySnapshot,
} from '../dependencies.js';

/** Library published from the monorepo (producer). */
export const sampleProducerPackageJson: ConsumerPackageJson = {
  name: '@autodev/shared-utils',
  version: '1.3.0',
  dependencies: {
    zod: '^3.23.0',
  },
};

/** App repo that depends on @autodev/shared-utils at an older range. */
export const sampleConsumerWebAppPackageJson: ConsumerPackageJson = {
  name: '@acme/web-app',
  version: '0.4.0',
  dependencies: {
    '@autodev/shared-utils': '^1.2.3',
    react: '^18.3.0',
  },
  devDependencies: {
    vitest: '^3.0.0',
  },
};

/** Second consumer — uses the library as a peer + direct dep in a workspace package. */
export const sampleConsumerApiPackageJson: ConsumerPackageJson = {
  name: '@acme/api-gateway',
  version: '2.1.0',
  dependencies: {
    express: '^5.0.0',
  },
  peerDependencies: {
    '@autodev/shared-utils': '^1.2.0',
  },
};

export const sampleConsumerApiWorkspacePackageJson: ConsumerPackageJson = {
  name: '@acme/api-handlers',
  version: '1.0.0',
  dependencies: {
    '@autodev/shared-utils': '1.2.3',
  },
};

/** Unrelated package — should not appear as a consumer of shared-utils. */
export const sampleUnrelatedPackageJson: ConsumerPackageJson = {
  name: '@acme/docs-site',
  version: '0.1.0',
  dependencies: {
    next: '^14.0.0',
  },
};

export const sampleProducerRepoSnapshot: RepositoryDependencySnapshot = {
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  packageJsonFiles: [
    {
      path: 'packages/shared-utils/package.json',
      packageJson: sampleProducerPackageJson,
    },
  ],
};

export const sampleConsumerWebRepoSnapshot: RepositoryDependencySnapshot = {
  owner: 'acme',
  repo: 'web-app',
  packageJsonFiles: [
    {
      path: 'package.json',
      packageJson: sampleConsumerWebAppPackageJson,
    },
  ],
};

export const sampleConsumerApiRepoSnapshot: RepositoryDependencySnapshot = {
  owner: 'acme',
  repo: 'api-gateway',
  packageJsonFiles: [
    {
      path: 'package.json',
      packageJson: sampleConsumerApiPackageJson,
    },
    {
      path: 'packages/handlers/package.json',
      packageJson: sampleConsumerApiWorkspacePackageJson,
    },
  ],
};

export const sampleUnrelatedRepoSnapshot: RepositoryDependencySnapshot = {
  owner: 'acme',
  repo: 'docs-site',
  packageJsonFiles: [
    {
      path: 'package.json',
      packageJson: sampleUnrelatedPackageJson,
    },
  ],
};

/** Multi-repo fixture with cross-dependencies for graph building tests. */
export const sampleDependencyScanRequest: DependencyScanRequest = {
  repositories: [
    sampleProducerRepoSnapshot,
    sampleConsumerWebRepoSnapshot,
    sampleConsumerApiRepoSnapshot,
    sampleUnrelatedRepoSnapshot,
  ],
};

export const sampleSharedUtilsConsumers: DependencyConsumer[] = [
  {
    owner: 'acme',
    repo: 'web-app',
    packagePath: 'package.json',
    dependencyField: 'dependencies',
    packageName: '@autodev/shared-utils',
    currentVersion: '^1.2.3',
  },
  {
    owner: 'acme',
    repo: 'api-gateway',
    packagePath: 'package.json',
    dependencyField: 'peerDependencies',
    packageName: '@autodev/shared-utils',
    currentVersion: '^1.2.0',
  },
  {
    owner: 'acme',
    repo: 'api-gateway',
    packagePath: 'packages/handlers/package.json',
    dependencyField: 'dependencies',
    packageName: '@autodev/shared-utils',
    currentVersion: '1.2.3',
  },
];

export const sampleDependencyGraph: DependencyGraph = {
  packages: [
    {
      packageName: '@autodev/shared-utils',
      consumers: sampleSharedUtilsConsumers,
    },
    {
      packageName: 'zod',
      consumers: [
        {
          owner: 'santosh-opsera',
          repo: 'auto-dev',
          packagePath: 'packages/shared-utils/package.json',
          dependencyField: 'dependencies',
          packageName: 'zod',
          currentVersion: '^3.23.0',
        },
      ],
    },
  ],
  scannedRepositories: 4,
  scannedPackageJsonFiles: 5,
  edgeCount: 6,
};

export const samplePackageBumpNotifyRequest: PackageBumpNotifyRequest = {
  packageName: '@autodev/shared-utils',
  proposedVersion: '1.3.0',
  changelogLink:
    'https://www.npmjs.com/package/%40autodev%2Fshared-utils?activeTab=versions#1.3.0',
  sourceOwner: 'santosh-opsera',
  sourceRepo: 'auto-dev',
};

export const sampleDependencyUpdateProposal: DependencyUpdateProposal = {
  id: 'dep-update-sample-001',
  packageName: '@autodev/shared-utils',
  currentVersion: '^1.2.3',
  proposedVersion: '1.3.0',
  changelogLink:
    'https://www.npmjs.com/package/%40autodev%2Fshared-utils?activeTab=versions#1.3.0',
  owner: 'acme',
  repo: 'web-app',
  packagePath: 'package.json',
  dependencyField: 'dependencies',
  status: 'proposed',
  sourceOwner: 'santosh-opsera',
  sourceRepo: 'auto-dev',
  createdAt: '2026-07-13T18:00:00.000Z',
  updatedAt: '2026-07-13T18:00:00.000Z',
};
