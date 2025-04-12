// test/e2e/cli.combinations.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Option Combinations', () => {
    let testDir: string;
    let realTestDir: string; // <-- Add variable for real path

    beforeEach(async () => {
        // Create temp dir
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-');
        testDir = await fs.mkdtemp(tempDirPrefix);
        // Resolve the real path
        realTestDir = await fs.realpath(testDir);

        // Create structure using original path
        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg', // Lowercase for case test
            'image.JPG': 'jpeg upper', // Uppercase for case test
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
        });
    });

    afterEach(async () => {
        await fs.remove(testDir); // Remove using original path
    });

    it('should correctly combine --name, --exclude, and --type', () => {
        const result = runCli(['--name', '*.ts', '--exclude', 'util.ts', '--type', 'f'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(realTestDir, 'src', 'main.ts'), // <-- Use real path
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --type, --maxdepth, and --relative', () => {
        // No changes needed here as it uses relative paths
        const result = runCli(['--type', 'd', '--maxdepth', '1', '--relative'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            '.',
            'build',
            'empty',
            'src',
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --ignore-case, and --maxdepth 1', () => {
        // Excludes image.JPG (and image.jpg because of --ignore-case)
        // Maxdepth 1 includes start dir + immediate children
        const result = runCli(['--exclude', 'IMAGE.JPG', '--ignore-case', '--maxdepth', '1'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            realTestDir, // <-- Use real path (starting dir)
            path.join(realTestDir, 'build'), // <-- Use real path
            path.join(realTestDir, 'doc.txt'), // <-- Use real path
            path.join(realTestDir, 'empty'), // <-- Use real path
            path.join(realTestDir, 'script.js'), // <-- Use real path
            path.join(realTestDir, 'src'), // <-- Use real path
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --name and --ignore-case', () => {
        // Should find both image.jpg and image.JPG
        const result = runCli(['--name', 'IMAGE.JPG', '--ignore-case'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(realTestDir, 'image.jpg'), // <-- Use real path
            path.join(realTestDir, 'image.JPG'), // <-- Use real path
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --no-global-ignore, and --name *', () => {
        // Exclude node_modules and .git (defaults) via CLI exclude
        // Name * means find everything not excluded
        // Default maxdepth (infinity)
        // --no-global-ignore ensures only default/CLI excludes apply
        // This should list everything *except* node_modules and .git
        const result = runCli(['--name', '*', '--exclude', 'node_modules', '.git', '--no-global-ignore'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            realTestDir, // <-- Use real path (starting dir)
            path.join(realTestDir, 'build'), // <-- Use real path
            path.join(realTestDir, 'build', 'app.exe'), // <-- Nested
            path.join(realTestDir, 'build', 'output.log'), // <-- Nested
            path.join(realTestDir, 'doc.txt'), // <-- Use real path
            path.join(realTestDir, 'empty'), // <-- Use real path
            path.join(realTestDir, 'image.JPG'), // <-- Use real path
            path.join(realTestDir, 'image.jpg'), // <-- Use real path
            path.join(realTestDir, 'script.js'), // <-- Use real path
            path.join(realTestDir, 'src'), // <-- Use real path
            path.join(realTestDir, 'src', 'main.ts'), // <-- Nested
            path.join(realTestDir, 'src', 'util.ts'), // <-- Nested
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should find files excluding specific directories up to depth 2 using CLI options', () => {
        // Maxdepth 2 means starting dir (depth 0), direct children (depth 1), grandchildren (depth 2)
        // Exclude 'build' directory (prunes it)
        const result = runCli(['--maxdepth', '2', '--exclude', 'build'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            realTestDir, // <-- Use real path (starting dir, depth 0)
            path.join(realTestDir, 'doc.txt'), // <-- Depth 1
            path.join(realTestDir, 'empty'), // <-- Depth 1
            path.join(realTestDir, 'image.JPG'), // <-- Depth 1
            path.join(realTestDir, 'image.jpg'), // <-- Depth 1
            path.join(realTestDir, 'script.js'), // <-- Depth 1
            path.join(realTestDir, 'src'), // <-- Depth 1
            path.join(realTestDir, 'src', 'main.ts'), // <-- Depth 2
            path.join(realTestDir, 'src', 'util.ts'), // <-- Depth 2
            // 'build' and its contents are excluded
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });
});