// test/e2e/cli.combinations.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Option Combinations', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
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
        await fs.remove(testDir);
    });

    it('should correctly combine --name, --exclude, and --type', () => {
        const result = runCli(['--name', '*.ts', '--exclude', 'util.ts', '--type', 'f'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(testDir, 'src', 'main.ts'),
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --type, --maxdepth, and --relative', () => {
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

    it('should correctly combine --exclude, --ignore-case, and --maxdepth', () => {
        const result = runCli(['--exclude', 'IMAGE.JPG', '--ignore-case', '--maxdepth', '1'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(testDir, '.'),
            path.join(testDir, 'build'),
            path.join(testDir, 'doc.txt'),
            path.join(testDir, 'empty'),
            path.join(testDir, 'script.js'),
            path.join(testDir, 'src'),
        ].sort();
        expect(normalizeAndSort(result.stdoutLines).map(p => p.replace(/\\/g, '/'))).toEqual(expected.map(p => p.replace(/\\/g, '/')));
    });

    it('should correctly combine --name and --ignore-case', () => {
        const result = runCli(['--name', 'IMAGE.JPG', '--ignore-case'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(testDir, 'image.jpg'),
            path.join(testDir, 'image.JPG'),
        ].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
    });

    it('should correctly combine --exclude, --no-global-ignore, and --name', () => {
        const result = runCli(['--name', '*', '--exclude', 'node_modules', '--no-global-ignore'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(testDir, '.'),
            path.join(testDir, 'build'),
            path.join(testDir, 'doc.txt'),
            path.join(testDir, 'empty'),
            path.join(testDir, 'image.jpg'),
            path.join(testDir, 'script.js'),
            path.join(testDir, 'src'),
        ].sort();
        expect(normalizeAndSort(result.stdoutLines).map(p => p.replace(/\\/g, '/'))).toEqual(expected.map(p => p.replace(/\\/g, '/')));
    });

    it('should find files excluding specific directories up to a certain depth using CLI options', () => {
        const result = runCli(['--maxdepth', '2', '--exclude', 'build'], testDir);
        expect(result.status).toBe(0);
        const expected = [
            path.join(testDir, '.'),
            path.join(testDir, 'doc.txt'),
            path.join(testDir, 'empty'),
            path.join(testDir, 'image.jpg'),
            path.join(testDir, 'script.js'),
            path.join(testDir, 'src'),
        ].sort();

          const expectedNorm = expected.map(p => path.normalize(p).replace(/\\/g, '/'));
          const actualNorm = normalizeAndSort(result.stdoutLines).map(p => p.replace(/\\/g, '/'));
        expect(actualNorm).toEqual(expectedNorm);
    });
});