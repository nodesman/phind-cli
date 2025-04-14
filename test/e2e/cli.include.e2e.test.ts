// test/e2e/cli.include.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper'; // Import helpers

describe('CLI E2E - Include Patterns (--name, -n)', () => {
    let testDir: string;
    let realTestDir: string; // Use real path consistently

    beforeEach(async () => {
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-');
        const tempDir = await fs.mkdtemp(tempDirPrefix);
        realTestDir = await fs.realpath(tempDir); // Resolve symlinks

        // Create structure using the non-resolved path (fs-extra handles it)
        await createTestStructure(tempDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
            'image_upper.JPG': 'jpeg upper', // <<< USE THIS UNIQUE NAME
            'script.js': 'javascript',
            '.config': { 'app.conf': 'config file' },
            'build': {
                'output.log': 'log data',
                'app.exe': 'executable',
            },
            'node_modules': { 'package': { 'index.js': '' } },
            '.git': { 'HEAD': '' },
            'src': {
                'main.ts': 'typescript',
                'util.ts': 'typescript utils',
            },
            'empty': null,
            '.hiddenFile': 'hidden content',
            '.hiddenDir': { 'content': 'hidden dir content' }
        });
        // Store the resolved path for running the CLI and making assertions
        testDir = realTestDir;
    });

    afterEach(async () => {
        await fs.remove(testDir); // Use real path for removal
    });

    it('should include only files matching a single --name pattern (relative)', () => {
        // Relative is default
        const result = runCli(['--name', '*.txt'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths with ./ prefix
        const expected = ['./doc.txt'].sort();
        const actualFiltered = result.stdoutLines.filter(l => l !== '.'); // Filter out the base dir listing '.'
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should include only files matching multiple --name patterns (relative)', () => {
        // Relative is default
        const result = runCli(['--name', '*.txt', '--name', '*.js'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths with ./ prefix
        const expected = ['./doc.txt', './script.js'].sort();
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should include files based on glob patterns (e.g., *.txt) (relative)', () => {
        // Relative is default
        const result = runCli(['--name', '*.txt'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths with ./ prefix
        const expected = ['./doc.txt'].sort();
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should include hidden files when pattern allows (e.g., .*) (relative)', () => {
         // Relative is default
         // Default excludes (.git, node_modules) are applied.
         // --name '.*' pattern matches .config, .hiddenFile, .hiddenDir.
         // It also matches .git, but the default exclude prevents it from being listed.
         const result = runCli(['--name', '.*'], testDir);
         expect(result.status).toBe(0);
         // Expect relative paths with ./ prefix for hidden items.
         // The starting dir '.' is not matched by '.*'.
         // .git is excluded by default.
         const expected = [
             './.config',
             './.hiddenDir',
             './.hiddenFile'
         ].sort();
         // Filter out './.git*' just in case something unexpected leaks through
         const actualFiltered = result.stdoutLines.filter(l => l !== '.' && !l.startsWith('./.git'));
         expect(normalizeAndSort(actualFiltered)).toEqual(expected);
         expect(actualFiltered.length).toBe(expected.length);
    });

    it('should include files in subdirectories matching a pattern (relative)', () => {
        // Relative is default
        // Pattern 'src/*' only matches immediate children of src
         const result = runCli(['--name', 'src/*'], testDir);
         expect(result.status).toBe(0);
         // Expect relative paths with ./ prefix
         const expected = ['./src/main.ts', './src/util.ts'].sort();
         const actualFiltered = result.stdoutLines.filter(l => l !== '.');
         expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

     it('should include directories matching a specific pattern (relative)', () => {
        // Relative is default
        // Test finding the '.hiddenDir' using a pattern like '.*Dir'
        const result = runCli(['--name', '.*Dir'], testDir);
        expect(result.status).toBe(0);
        const expected = ['./.hiddenDir'].sort();
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
     });


    it('should handle --name patterns with case sensitivity by default (relative)', () => {
        // Relative is default
        const result = runCli(['--name', 'image_upper.JPG'], testDir); // Use unique name
        expect(result.status).toBe(0);
         // Expect relative paths with ./ prefix
        const expected = ['./image_upper.JPG']; // Use unique name
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should default to including everything (*) if --name is not provided (relative)', () => {
        // Relative is default
        // Default excludes (node_modules, .git) should be applied by the application logic.
        const result = runCli([], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths with ./ prefix, excluding defaults
        const expected = [
            '.', // Starting directory
            './.config',
            './.config/app.conf',
            './.hiddenDir',
            './.hiddenDir/content',
            './.hiddenFile',
            './build',
            './build/app.exe',
            './build/output.log',
            './doc.txt',
            './empty',
            './image_upper.JPG', // Use unique name
            './image.jpg',
            './script.js',
            './src',
            './src/main.ts',
            './src/util.ts',
        ].sort();
         // The result should already have default excludes removed by the app
         const actual = result.stdoutLines;

        expect(normalizeAndSort(actual)).toEqual(expected);
        expect(actual.length).toBe(expected.length);
    });
});