// test/e2e/cli.exclude.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { createTestStructure, runCli, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Excludes (Default, CLI, Global)', () => {
    let testDir: string;
    // Store the RELATIVE path within testDir for the fake global ignore
    const relativeGlobalIgnoreDir = '.config/phind';
    const globalIgnoreFilename = 'ignore';
    let relativeGlobalIgnorePath: string; // e.g., '.config/phind/ignore'
    let absoluteGlobalIgnorePath: string; // Full path for writing the file

    const testStructure = {
        'doc.txt': 'text',
        'image.jpg': 'jpeg',
        'script.js': 'javascript',
        '.config': { 'app.conf': 'config file' }, // This directory will be used for the fake global ignore parent
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
        'excluded.tmp': 'temp file',
        'empty': null,
    };

    beforeEach(async () => {
        // Resolve real path first to avoid issues with symlinks (e.g., /var -> /private/var on macOS)
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-');
        const tempDir = await fs.mkdtemp(tempDirPrefix);
        testDir = await fs.realpath(tempDir); // Use the real path for running tests and assertions

        // Create structure using the resolved path
        await createTestStructure(testDir, testStructure);

        // Calculate paths based on the resolved testDir
        relativeGlobalIgnorePath = path.join(relativeGlobalIgnoreDir, globalIgnoreFilename).replace(/\\/g, '/'); // Ensure consistent separators
        absoluteGlobalIgnorePath = path.join(testDir, relativeGlobalIgnorePath); // Use resolved testDir

        // Ensure the directory structure exists within the temp dir for writing the file
        await fs.ensureDir(path.dirname(absoluteGlobalIgnorePath));
    });

    afterEach(async () => {
        // Use the resolved path for removal
        await fs.remove(testDir);
    });

    describe('Default Excludes', () => {
        it('should exclude node_modules by default (relative output)', () => {
            // Relative output is now default
            const result = runCli([], testDir);
            // Check direct relative output
            expect(result.stdoutLines).not.toContain('./node_modules');
            expect(result.stdoutLines).not.toContain('./node_modules/package');
            expect(result.stdoutLines).not.toContain('./node_modules/package/index.js');
        });

        it('should exclude .git by default (relative output)', () => {
             // Relative output is now default
            const result = runCli([], testDir);
             // Check direct relative output
            expect(result.stdoutLines).not.toContain('./.git');
            expect(result.stdoutLines).not.toContain('./.git/HEAD');
        });

        it('should include node_modules if explicitly included via --name (and default exclude is bypassed by specific include)', () => {
            // --relative is default, but explicitly stating it doesn't hurt
            const result = runCli(['--name', 'node_modules/**', '--relative'], testDir);
            const expectedRelative = [
                 // './node_modules', // <<< Should NOT be included by 'node_modules/**'
                 './node_modules/package',
                 './node_modules/package/index.js'
                ].sort();
             const receivedNormalized = normalizeAndSort(result.stdoutLines);
             expect(receivedNormalized).toEqual(expect.arrayContaining(expectedRelative));
             expect(receivedNormalized).toContain('./node_modules/package/index.js');
             // Check the directory itself is not included by the globstar pattern
             expect(receivedNormalized).not.toContain('./node_modules');
             expect(receivedNormalized.length).toBe(expectedRelative.length);
        });

        it('should include .git if explicitly included via --name (and default exclude is bypassed by specific include)', () => {
             // --relative is default
             const result = runCli(['--name', '.git/**', '--relative'], testDir);
             const expectedRelative = [
                 // './.git', // <<< Should NOT be included by '.git/**'
                 './.git/HEAD'
                ].sort();
             const receivedNormalized = normalizeAndSort(result.stdoutLines);
             expect(receivedNormalized).toEqual(expect.arrayContaining(expectedRelative));
             expect(receivedNormalized).toContain('./.git/HEAD');
             // Check the directory itself is not included by the globstar pattern
             expect(receivedNormalized).not.toContain('./.git');
             expect(receivedNormalized.length).toBe(expectedRelative.length);
        });
    });

    describe('Exclude Patterns (--exclude, -e)', () => {
        it('should exclude files matching a single --exclude pattern (relative)', () => {
            // Relative is default
            const result = runCli(['--exclude', '*.txt'], testDir);
            expect(result.stdoutLines).not.toContain('./doc.txt');
            expect(result.stdoutLines).toContain('./script.js'); // Ensure other files present
        });

        it('should exclude files matching multiple --exclude patterns (relative)', () => {
            // Relative is default
            const result = runCli(['--exclude', '*.txt', '--exclude', '*.js'], testDir);
            expect(result.stdoutLines).not.toContain('./doc.txt');
            expect(result.stdoutLines).not.toContain('./script.js');
            expect(result.stdoutLines).toContain('./image.jpg'); // Ensure other files
        });

        it('should exclude files based on glob patterns (e.g., build/*.log) (relative)', () => {
            // Relative is default
            const result = runCli(['--exclude', 'build/*.log'], testDir);
            expect(result.stdoutLines).not.toContain('./build/output.log');
            expect(result.stdoutLines).toContain('./build/app.exe'); // Ensure other file in dir is there
            expect(result.stdoutLines).toContain('./build'); // Ensure parent dir is still there if not pruned explicitly
            expect(result.stdoutLines).toContain('./script.js');
        });

        it('should exclude hidden files/dirs when pattern allows (e.g., .config) (relative)', () => {
             // Relative is default
             const result = runCli(['--exclude', '.config'], testDir);
             expect(result.stdoutLines).not.toContain('./.config'); // Directory itself is excluded (pruned)
             expect(result.stdoutLines).not.toContain('./.config/app.conf'); // Content implicitly excluded
             // Default excludes still apply
             expect(result.stdoutLines).not.toContain('./.git');
             expect(result.stdoutLines).toContain('./doc.txt'); // Sanity check non-hidden
        });

        it('should exclude entire directories and their contents (pruning) (relative)', () => {
             // Relative is default
             const result = runCli(['--exclude', 'build'], testDir);
             expect(result.stdoutLines).not.toContain('./build');
             expect(result.stdoutLines).not.toContain('./build/output.log');
             expect(result.stdoutLines).not.toContain('./build/app.exe');
             expect(result.stdoutLines).toContain('./script.js'); // Other files still present
        });

        it('should prioritize --exclude over --name if patterns overlap (relative)', async () => {
            // Relative is default
            const result = runCli(['--name', '*.tmp', '--exclude', 'excluded.tmp'], testDir);
            expect(result.stdoutLines).not.toContain('./excluded.tmp');
             // Add another tmp file to ensure the name pattern *could* find something
             await fs.writeFile(path.join(testDir, 'another.tmp'), 'test');
             const result2 = runCli(['--name', '*.tmp', '--exclude', 'excluded.tmp'], testDir);
             expect(result2.stdoutLines).toContain('./another.tmp');
             expect(result2.stdoutLines).not.toContain('./excluded.tmp');
             expect(result2.stderr).toBe('');
        });

        it('should handle --exclude patterns with case sensitivity by default (relative)', () => {
            // Relative is default
            const result = runCli(['--exclude', 'DOC.TXT'], testDir);
            // 'DOC.TXT' doesn't exist, so this exclude pattern has no effect on 'doc.txt'
            expect(result.stdoutLines).toContain('./doc.txt');
        });

         it('should exclude based on case sensitivity when the file exists (relative)', async () => {
            // Create uppercase file to test exclusion
            await fs.writeFile(path.join(testDir, 'DOC.TXT'), 'uppercase doc');
            // Relative is default
            const result = runCli(['--exclude', 'DOC.TXT'], testDir);
            expect(result.stdoutLines).not.toContain('./DOC.TXT'); // Should be excluded
            expect(result.stdoutLines).toContain('./doc.txt'); // Lowercase should remain
        });
    });

    describe('Global Ignore File (--skip-global-ignore)', () => {
        // Helper to write the fake global ignore file
        const ensureGlobalIgnoreFile = async (content: string) => {
             await fs.ensureDir(path.dirname(absoluteGlobalIgnorePath));
             await fs.writeFile(absoluteGlobalIgnorePath, content);
        };

        it('should load and apply excludes from the global ignore file by default (relative)', async () => {
            await ensureGlobalIgnoreFile('*.tmp\nbuild'); // Exclude *.tmp and the build dir

            // Relative is default. Pass the RELATIVE path to runCli helper to simulate it being found
            const result = runCli([], testDir, {}, relativeGlobalIgnorePath);

            expect(result.stderr).toBe('');
            expect(result.status).toBe(0);

            expect(result.stdoutLines).not.toContain('./excluded.tmp'); // Globally excluded file
            expect(result.stdoutLines).not.toContain('./build'); // Globally excluded directory (pruned)
            expect(result.stdoutLines).not.toContain('./build/output.log'); // Content of pruned dir

            // Default excludes still apply
            expect(result.stdoutLines).not.toContain('./node_modules');
            expect(result.stdoutLines).not.toContain('./.git');

            // Other files should be present
            expect(result.stdoutLines).toContain('./doc.txt'); // Sanity check
            expect(result.stdoutLines).toContain('./src');
            expect(result.stdoutLines).toContain('.');
        });

        it('should NOT load global ignores when --skip-global-ignore is specified (relative)', async () => {
            await ensureGlobalIgnoreFile('*.tmp\nbuild'); // Define global excludes

            // Relative is default. Use --skip-global-ignore
            const result = runCli(['--skip-global-ignore'], testDir, {});

            expect(result.stderr).toBe('');
            expect(result.status).toBe(0);

            // Global excludes should NOT be applied
            expect(result.stdoutLines).toContain('./excluded.tmp');
            expect(result.stdoutLines).toContain('./build');
            expect(result.stdoutLines).toContain('./build/output.log'); // Content should be found

            // Default excludes still apply
            expect(result.stdoutLines).not.toContain('./node_modules');
            expect(result.stdoutLines).not.toContain('./.git');

            // Other files should be present
            expect(result.stdoutLines).toContain('./doc.txt');
            expect(result.stdoutLines).toContain('.');
        });

        it('should combine global ignores with default and CLI excludes (relative)', async () => {
            await ensureGlobalIgnoreFile('*.log'); // Global: exclude logs

            // Relative is default. Pass the relative path to simulate finding the global file
            const result = runCli(['--exclude', '*.tmp'], testDir, {}, relativeGlobalIgnorePath); // CLI: exclude *.tmp

            expect(result.stderr).toBe('');
            expect(result.status).toBe(0);

            // Check exclusions from all sources
            expect(result.stdoutLines).not.toContain('./excluded.tmp');      // CLI exclude
            expect(result.stdoutLines).not.toContain('./build/output.log'); // Global exclude
            expect(result.stdoutLines).not.toContain('./node_modules');     // Default exclude
            expect(result.stdoutLines).not.toContain('./.git');             // Default exclude

            // Check remaining files
            expect(result.stdoutLines).toContain('./doc.txt');
            expect(result.stdoutLines).toContain('./build'); // Dir itself not excluded by *.log
            expect(result.stdoutLines).toContain('./build/app.exe'); // Other file in build
            expect(result.stdoutLines).toContain('.');
        });

        it('should handle non-existent global ignore file gracefully', async () => {
            // Relative is default. Simulate non-existent file by passing null to helper
            await fs.remove(absoluteGlobalIgnorePath);
            const result = runCli([], testDir, {}, null);

            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');

            // Check for presence of specific files/dirs
            expect(result.stdoutLines).toContain('.');
            expect(result.stdoutLines).toContain('./doc.txt');
            expect(result.stdoutLines).toContain('./excluded.tmp'); // Should be found
            expect(result.stdoutLines).toContain('./build');
            expect(result.stdoutLines).toContain('./.config');

            // Check that default excludes ARE still applied
            expect(result.stdoutLines).not.toContain('./node_modules');
            expect(result.stdoutLines).not.toContain('./.git');
        });
    });
});