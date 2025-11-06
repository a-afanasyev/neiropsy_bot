module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'app/src/**/*.ts',
    '!app/src/**/*.d.ts',
    '!app/src/index.ts'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
