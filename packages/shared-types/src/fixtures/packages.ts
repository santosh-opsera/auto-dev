import type {
  PackageDetectRequest,
  PackageJsonManifest,
  PackagePublishProposal,
  PackageSnapshot,
  VulnerabilityScanResult,
} from '../packages.js';

export const samplePublishablePackageJson: PackageJsonManifest = {
  name: '@autodev/shared-utils',
  version: '1.2.3',
  main: './dist/index.js',
  exports: {
    '.': {
      import: './dist/index.js',
      types: './dist/index.d.ts',
    },
  },
  files: ['dist', 'README.md'],
};

export const samplePrivateAppPackageJson: PackageJsonManifest = {
  name: '@autodev/web-app',
  version: '0.1.0',
  private: true,
  main: './src/index.ts',
};

export const sampleNonLibraryPackageJson: PackageJsonManifest = {
  name: '@autodev/scripts',
  version: '0.0.1',
};

export const samplePublishableRootPackageJson: PackageJsonManifest = {
  name: '@example/widget',
  version: '2.0.0',
  exports: './index.js',
  files: ['index.js', 'lib/**/*.js'],
};

export const sampleNpmignore = `# Sensitive / local-only
.env
*.pem
secrets/
coverage/
src/
`;

export const sampleNpmAuditClean = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      total: 0,
    },
  },
};

export const sampleNpmAuditWithHigh = {
  auditReportVersion: 2,
  vulnerabilities: {
    lodash: {
      name: 'lodash',
      severity: 'high',
      isDirect: true,
      via: [
        {
          source: 1091173,
          name: 'lodash',
          title: 'Prototype Pollution in lodash',
          severity: 'high',
          range: '<4.17.21',
        },
      ],
      effects: [],
      range: '<4.17.21',
      nodes: ['node_modules/lodash'],
      fixAvailable: true,
    },
    'left-pad': {
      name: 'left-pad',
      severity: 'low',
      isDirect: false,
      via: [
        {
          source: 1,
          name: 'left-pad',
          title: 'Unmaintained package',
          severity: 'low',
          range: '*',
        },
      ],
      effects: [],
      range: '*',
      nodes: ['node_modules/left-pad'],
      fixAvailable: false,
    },
  },
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 1,
      moderate: 0,
      high: 1,
      critical: 0,
      total: 2,
    },
  },
};

export const sampleNpmAuditCritical = {
  auditReportVersion: 2,
  vulnerabilities: {
    minimist: {
      name: 'minimist',
      severity: 'critical',
      isDirect: true,
      via: [
        {
          source: 1179,
          name: 'minimist',
          title: 'Prototype Pollution in minimist',
          severity: 'critical',
          range: '<1.2.6',
        },
      ],
      effects: [],
      range: '<1.2.6',
      nodes: ['node_modules/minimist'],
      fixAvailable: true,
    },
  },
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 1,
      total: 1,
    },
  },
};

export const sampleChangedFilesFeature = [
  'packages/shared-utils/src/format.ts',
  'packages/shared-utils/src/index.ts',
  'packages/shared-utils/package.json',
];

export const sampleChangedFilesBreaking = [
  'packages/shared-utils/src/api.ts',
  'packages/shared-utils/README.md',
];

export const sampleChangedFilesFix = [
  'packages/shared-utils/src/format.ts',
];

export const samplePackageSnapshotPublishable: PackageSnapshot = {
  packagePath: 'packages/shared-utils',
  packageJson: samplePublishablePackageJson,
  npmignore: sampleNpmignore,
  packageFiles: [
    'packages/shared-utils/dist/index.js',
    'packages/shared-utils/dist/index.d.ts',
    'packages/shared-utils/README.md',
    'packages/shared-utils/src/format.ts',
    'packages/shared-utils/.env',
    'packages/shared-utils/secrets/token.pem',
  ],
  auditReport: sampleNpmAuditClean,
  changeHints: ['feat: add formatDate helper', 'docs: update README'],
};

export const samplePackageSnapshotBlocked: PackageSnapshot = {
  packagePath: 'packages/shared-utils',
  packageJson: samplePublishablePackageJson,
  npmignore: sampleNpmignore,
  packageFiles: [
    'packages/shared-utils/dist/index.js',
    'packages/shared-utils/README.md',
    'packages/shared-utils/.env',
  ],
  auditReport: sampleNpmAuditWithHigh,
  changeHints: ['fix: handle null dates'],
};

export const samplePackageSnapshotPrivate: PackageSnapshot = {
  packagePath: 'packages/web-app',
  packageJson: samplePrivateAppPackageJson,
  packageFiles: ['packages/web-app/src/index.ts'],
  auditReport: sampleNpmAuditClean,
  changeHints: ['feat: new page'],
};

export const sampleDetectRequest: PackageDetectRequest = {
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  changedFiles: sampleChangedFilesFeature,
  packageSnapshots: [samplePackageSnapshotPublishable],
  severityThreshold: 'high',
};

export const sampleVulnerabilityScanClean: VulnerabilityScanResult = {
  findings: [],
  severityThreshold: 'high',
  blocked: false,
  blockingSeverities: [],
  summary: 'No vulnerabilities at or above high.',
};

export const sampleVulnerabilityScanBlocked: VulnerabilityScanResult = {
  findings: [
    {
      id: '1091173',
      title: 'Prototype Pollution in lodash',
      severity: 'high',
      packageName: 'lodash',
      path: 'node_modules/lodash',
    },
    {
      id: '1',
      title: 'Unmaintained package',
      severity: 'low',
      packageName: 'left-pad',
      path: 'node_modules/left-pad',
    },
  ],
  severityThreshold: 'high',
  blocked: true,
  blockingSeverities: ['high'],
  summary: 'Publishing blocked: 1 finding(s) at or above high.',
};

export const samplePackagePublishProposal: PackagePublishProposal = {
  id: 'proposal-sample-001',
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  packagePath: 'packages/shared-utils',
  packageName: '@autodev/shared-utils',
  currentVersion: '1.2.3',
  proposedVersion: '1.3.0',
  bump: 'minor',
  changelog:
    '## 1.3.0\n\n- feat: add formatDate helper\n- docs: update README\n\nBump rationale: new features detected (minor).',
  vulnerabilityScan: sampleVulnerabilityScanClean,
  allowList: {
    allowedPatterns: ['dist', 'README.md'],
    includedFiles: [
      'packages/shared-utils/dist/index.js',
      'packages/shared-utils/dist/index.d.ts',
      'packages/shared-utils/README.md',
    ],
    excludedFiles: [
      'packages/shared-utils/src/format.ts',
      'packages/shared-utils/.env',
      'packages/shared-utils/secrets/token.pem',
    ],
    source: 'files',
  },
  affectedFiles: sampleChangedFilesFeature,
  status: 'proposed',
  confirmationToken: 'confirm-token-sample-001',
  createdAt: '2026-07-13T12:00:00.000Z',
  updatedAt: '2026-07-13T12:00:00.000Z',
};
