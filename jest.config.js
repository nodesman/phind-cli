module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'], // Look for tests only in the test directory
  testMatch: [ // Patterns Jest uses to detect test files
    '**/test/**/*.+(spec|test).+(ts|tsx|js)' // Match files in test/** ending with .spec or .test
  ],
  transform: { // How to transform files before testing
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json' // Ensure it uses your TS config
    }]
  },
  collectCoverage: true, // Enable coverage collection
  coverageDirectory: 'coverage', // Where to output coverage reports
  coverageProvider: 'v8', // More accurate coverage for Node.js
  // Specify files to include in coverage report (source files)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/cli.ts', // Exclude the main entry point script wrapper (better covered by E2E)
    // Add other files to exclude from coverage if needed, e.g., index files just exporting
  ],
  // Optional: Setup file executed before each test file
  // setupFilesAfterEnv: ['./test/setupFile.ts'],
};