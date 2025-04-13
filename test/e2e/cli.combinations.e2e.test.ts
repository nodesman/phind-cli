// test/e2e/cli.combinations.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Option Combinations', () => {
    let testDir: string; // This will hold the resolved path for running tests
    let realTestDir: string; // Holds the resolved path for assertions if needed

    beforeEach(async () => {
        // Create temp dir
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-');
        const tempDir = await fs.mkdtemp(tempDirPrefix);
        // Resolve the real path
        realTestDir = await fs.realpath(tempDir);
        testDir = realTestDir; // Use the resolved path for running the CLI

        // Create structure using the original (non-resolved) path
        // Added .hiddenfile, .config for the '*' test case
        await createTestStructure(tempDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg', // Lowercase for case test
            'image_upper.JPG': 'jpeg upper', // <<< USE THIS UNIQUE NAME
            'script.js': 'javascript',
            'build': {
                'output.log': 'log data',
                'app.exe': 'executable',
            },
            'src': {
                'main.ts': 'typescript',
                'util.ts': 'typescript utils',
            },
            'empty': null,
            '.hiddenfile': 'hidden', // For '*' test
            '.config': { 'app.conf': 'config file' }, // For '*' test
            '.hiddenDir': { 'content': 'hidden dir content' }, // For '*' test
            // Add default excluded dirs for the '--exclude node_modules .git' test
            'node_modules': { 'some_dep': { 'index.js': 'dep code'} },
            '.git': { 'config': 'HEAD' }
        });
    });

    afterEach(async () => {
        await fs.remove(testDir); // Remove using the resolved path
    });

    it('should correctly combine --name, --exclude, and --type (relative)', () => {
        // Switched to relative path for easier assertion
        const result = runCli(['--name', '*.ts', '--exclude', 'util.ts', '--type', 'f', '--relative'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            'src/main.ts',
            // 'src/util.ts', // <-- FIX: Removed as it's excluded by the command
        ].sort(); // <-- Expect relative paths
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --type, --maxdepth, and --relative', () => {
        // This test already uses relative, should be fine
        const result = runCli(['--type', 'd', '--maxdepth', '1', '--relative'], testDir);
        expect(result.status).toBe(0);
        // Default excludes (.git, node_modules) ARE applied automatically by the app
        const expected = [
            '.',
            'build',
            '.config', // Hidden dirs match '*' by default (dot:true)
            '.hiddenDir',// Hidden dirs match '*' by default (dot:true)
            'empty',
            'src',
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --ignore-case, and --maxdepth 1 (relative)', () => {
        // Switched to relative paths
        // Excludes image_upper.JPG (and image.jpg because of --ignore-case and pattern *.jpg)
        // Maxdepth 1 includes start dir + immediate children
        // Default excludes (.git, node_modules) ARE applied automatically by the app
        // Use a pattern that matches both to test exclude + ignore case
        const result = runCli(['--exclude', '*.jpg', '--ignore-case', '--maxdepth', '1', '--relative'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            '.', // <-- Starting dir relative
            '.config', // Hidden dirs match '*' by default (dot:true)
            '.hiddenDir', // Hidden dirs match '*' by default (dot:true)
            '.hiddenfile', // Hidden files match '*' by default (dot:true)
            'build',
            'doc.txt',
            'empty',
            'script.js',
            'src',
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --name and --ignore-case (relative)', () => {
        // Switched to relative paths
        // Should find both image.jpg and image_upper.JPG when matching IMAGE.JPG case-insensitively
        // const result = runCli(['--name', 'IMAGE.JPG', '--ignore-case', '--relative'], testDir); // <<< ORIGINAL PATTERN
        const result = runCli(['--name', '*.jpg', '--ignore-case', '--relative'], testDir); // <<< BETTER PATTERN TO TEST CASE INSENSITIVITY
        expect(result.status).toBe(0);
        const expected = [
            'image.jpg', // <-- Expect relative path
            'image_upper.JPG', // <-- USE THIS UNIQUE NAME
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --no-global-ignore, and --name * (relative)', () => {
        // Switched to relative paths
        // Explicitly exclude node_modules and .git via CLI exclude
        // Name * means find everything not explicitly excluded by CLI (global is ignored)
        // Default maxdepth (infinity)
        // --no-global-ignore ensures only CLI excludes apply (default built-in excludes are not overridden here)
        // Repeat --exclude for each value for correct yargs parsing
        const result = runCli(['--name', '*', '--exclude', 'node_modules', '--exclude', '.git', '--no-global-ignore', '--relative'], testDir);

        // Removed conditional console.error as the helper logic should be fixed
        expect(result.status).toBe(0); // Status should be 0 if successful (assuming cli.helper.ts fix)
        const expected = [
            '.', // <-- Starting dir relative
            '.config',              // Matches '*'
            '.config/app.conf',     // Matches '*'
            '.hiddenDir',           // Matches '*'
            '.hiddenDir/content',   // Matches '*'
            '.hiddenfile',          // Matches '*'
            'build',
            'build/app.exe',
            'build/output.log',
            'doc.txt',
            'empty',
            'image_upper.JPG', // <-- USE THIS UNIQUE NAME
            'image.jpg',
            'script.js',
            'src',
            'src/main.ts',
            'src/util.ts',
            // node_modules and .git are explicitly excluded by the command
        ].sort();
        const actualOutput = normalizeAndSort(result.stdoutLines);
        expect(actualOutput).toEqual(expected);
    });

    it('should find files excluding specific directories up to depth 2 using CLI options (relative)', () => {
        // Switched to relative paths
        // Maxdepth 2 means starting dir (depth 0), direct children (depth 1), grandchildren (depth 2)
        // Exclude 'build' directory (prunes it)
        // Default excludes (.git, node_modules) ARE applied automatically by the app
        const result = runCli(['--maxdepth', '2', '--exclude', 'build', '--relative'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            '.', // <-- Starting dir relative (depth 0)
            '.config',              // Depth 1
            '.config/app.conf',     // Depth 2
            '.hiddenDir',           // Depth 1
            '.hiddenDir/content',   // Depth 2
            '.hiddenfile',          // Depth 1
            'doc.txt', // <-- Depth 1
            'empty', // <-- Depth 1
            'image_upper.JPG', // <-- USE THIS UNIQUE NAME (Depth 1)
            'image.jpg', // <-- Depth 1
            'script.js', // <-- Depth 1
            'src', // <-- Depth 1
            'src/main.ts', // <-- Depth 2
            'src/util.ts', // <-- Depth 2
            // 'build' and its contents are excluded
            // '.git' and 'node_modules' are excluded by default
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });
});