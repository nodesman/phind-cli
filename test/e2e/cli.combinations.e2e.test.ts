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
        // Relative is default
        const result = runCli(['--name', '*.ts', '--exclude', 'util.ts', '--type', 'f'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            './src/main.ts',
            // './src/util.ts', // Excluded by command
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --type, --maxdepth, and --relative', () => {
        // Relative is default
        const result = runCli(['--type', 'd', '--maxdepth', '1'], testDir);
        expect(result.status).toBe(0);
        // Default excludes (.git, node_modules) ARE applied automatically by the app
        const expected = [
            '.',
            './build',
            './.config',
            './.hiddenDir',
            './empty',
            './src',
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --ignore-case, and --maxdepth 1 (relative)', () => {
        // Relative is default
        // Excludes image_upper.JPG (and image.jpg because of --ignore-case and pattern *.jpg)
        // Maxdepth 1 includes start dir + immediate children
        // Default excludes (.git, node_modules) ARE applied automatically by the app
        const result = runCli(['--exclude', '*.jpg', '--ignore-case', '--maxdepth', '1'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            '.',
            './.config',
            './.hiddenDir',
            './.hiddenfile',
            './build',
            './doc.txt',
            './empty',
            './script.js',
            './src',
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --name and --ignore-case (relative)', () => {
        // Relative is default
        // Should find both image.jpg and image_upper.JPG when matching *.jpg case-insensitively
        const result = runCli(['--name', '*.jpg', '--ignore-case'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            './image.jpg',
            './image_upper.JPG',
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --skip-global-ignore, and --name * (relative)', () => {
        // Relative is default
        // Explicitly exclude node_modules and .git via CLI exclude
        // Name * means find everything not explicitly excluded by CLI (global is ignored)
        // Default maxdepth (infinity)
        // --skip-global-ignore ensures only CLI excludes apply (default built-in excludes are not overridden here)
        const result = runCli(['--name', '*', '--exclude', 'node_modules', '--exclude', '.git', '--skip-global-ignore'], testDir);

        expect(result.status).toBe(0);
        const expected = [
            '.',
            './.config',
            './.config/app.conf',
            './.hiddenDir',
            './.hiddenDir/content',
            './.hiddenfile',
            './build',
            './build/app.exe',
            './build/output.log',
            './doc.txt',
            './empty',
            './image_upper.JPG',
            './image.jpg',
            './script.js',
            './src',
            './src/main.ts',
            './src/util.ts',
            // node_modules and .git are explicitly excluded by the command
        ].sort();
        const actualOutput = normalizeAndSort(result.stdoutLines);
        expect(actualOutput).toEqual(expected);
    });

    it('should find files excluding specific directories up to depth 2 using CLI options (relative)', () => {
        // Relative is default
        // Maxdepth 2 means starting dir (depth 0), direct children (depth 1), grandchildren (depth 2)
        // Exclude 'build' directory (prunes it)
        // Default excludes (.git, node_modules) ARE applied automatically by the app
        const result = runCli(['--maxdepth', '2', '--exclude', 'build'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            '.', // Depth 0
            './.config',              // Depth 1
            './.config/app.conf',     // Depth 2
            './.hiddenDir',           // Depth 1
            './.hiddenDir/content',   // Depth 2
            './.hiddenfile',          // Depth 1
            './doc.txt', // Depth 1
            './empty', // Depth 1
            './image_upper.JPG', // Depth 1
            './image.jpg', // Depth 1
            './script.js', // Depth 1
            './src', // Depth 1
            './src/main.ts', // Depth 2
            './src/util.ts', // Depth 2
            // 'build' and its contents are excluded
            // '.git' and 'node_modules' are excluded by default
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });
});