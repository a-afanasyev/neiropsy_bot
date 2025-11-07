module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'app/src/**/*.ts',
    '!app/src/**/*.d.ts',
    '!app/src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/app/__tests__/setup.ts'],
  testTimeout: 10000,
};

