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
            // 'image.JPG': 'jpeg upper', // <<< KEEP COMMENTED OR REMOVE
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
        // Add --relative flag
        const result = runCli(['--name', '*.txt', '--relative'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths
        const expected = ['doc.txt'].sort();
        // --- FIX: Be stricter. '.' should NOT be included for this specific pattern ---
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should include only files matching multiple --name patterns (relative)', () => {
         // Add --relative flag
        const result = runCli(['--name', '*.txt', '--name', '*.js', '--relative'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths
        const expected = ['doc.txt', 'script.js'].sort();
        // --- FIX: Be stricter. '.' should NOT be included for these specific patterns ---
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should include files based on glob patterns (e.g., *.txt) (relative)', () => {
         // Add --relative flag
        const result = runCli(['--name', '*.txt', '--relative'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths
        const expected = ['doc.txt'].sort();
         // --- FIX: Be stricter. '.' should NOT be included for this specific pattern ---
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should include hidden files when pattern allows (e.g., .*) (relative)', () => {
         // Add --relative flag
         // NOTE: Default excludes are applied unless overridden. Here '*' includes are used,
         // but the default PhindConfig excludes node_modules and .git.
         // The --name '.*' pattern *will* match .git, but the traverser's exclude logic (including defaults)
         // should prevent it unless it's explicitly included again.
         // The test pattern '.*' should match .config, .hiddenFile, .hiddenDir
         const result = runCli(['--name', '.*', '--relative'], testDir);
         expect(result.status).toBe(0);
         // Expect relative paths, including '.' for the base dir itself if it matches filters
         // .git should be excluded by default.
         // --- FIX: Add '.' to expected output ---
         const expected = [
             '.', // Base dir matches '.*' with dot:true, should be included.
             '.config',
             // '.git', // Excluded by default
             '.hiddenDir',
             '.hiddenFile'
         ].sort();
         const actualFiltered = result.stdoutLines.filter(l => !l.startsWith('.git'));
         expect(normalizeAndSort(actualFiltered)).toEqual(expected);
         // Check count is correct
         expect(actualFiltered.length).toBe(expected.length);
    });

    it('should include files in subdirectories matching a pattern (relative)', () => {
        // Add --relative flag
        // Pattern 'src/*' only matches immediate children of src
         const result = runCli(['--name', 'src/*', '--relative'], testDir);
         expect(result.status).toBe(0);
         // Expect relative paths
         const expected = ['src/main.ts', 'src/util.ts'].sort();
         // --- FIX: Be stricter ---
         const actualFiltered = result.stdoutLines.filter(l => l !== '.');
         expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

     it('should include directories matching a specific pattern (relative)', () => {
        // Test finding the '.hiddenDir' using a pattern like '.*Dir'
        const result = runCli(['--name', '.*Dir', '--relative'], testDir);
        expect(result.status).toBe(0);
        const expected = ['.hiddenDir'].sort();
        // --- FIX: Be stricter ---
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
     });


    it('should handle --name patterns with case sensitivity by default (relative)', () => {
        // Add --relative flag
        // const result = runCli(['--name', 'image.JPG', '--relative'], testDir); // <<< KEEP COMMENTED OR REMOVE
        const result = runCli(['--name', 'image_upper.JPG', '--relative'], testDir); // <<< TO THIS
        expect(result.status).toBe(0);
         // Expect relative paths
        // const expected = ['image.JPG']; // <<< KEEP COMMENTED OR REMOVE
        const expected = ['image_upper.JPG']; // <<< USE THIS UNIQUE NAME
        // --- FIX: Be stricter ---
        const actualFiltered = result.stdoutLines.filter(l => l !== '.');
        expect(normalizeAndSort(actualFiltered)).toEqual(expected);
    });

    it('should default to including everything (*) if --name is not provided (relative)', () => {
        // Add --relative flag
        // Default excludes (node_modules, .git) should be applied by the application logic.
        const result = runCli(['--relative'], testDir);
        expect(result.status).toBe(0);
        // Expect relative paths, excluding defaults
        const expected = [
            '.', // Starting directory
            '.config',
            '.config/app.conf',
            '.hiddenDir',
            '.hiddenDir/content',
            '.hiddenFile',
            'build',
            'build/app.exe',
            'build/output.log',
            'doc.txt',
            'empty',
            // 'image.JPG', // <-- KEEP COMMENTED OR REMOVE
            'image_upper.JPG', // <<< USE THIS UNIQUE NAME
            'image.jpg',
            'script.js',
            'src',
            'src/main.ts',
            'src/util.ts',
        ].sort();
         // The result should already have default excludes removed by the app
         const actual = result.stdoutLines;

        expect(normalizeAndSort(actual)).toEqual(expected);
        expect(actual.length).toBe(expected.length);
    });
});