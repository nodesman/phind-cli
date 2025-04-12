// test/e2e/cli.basic.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Basic Execution & Path Handling', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
            'script.js': 'javascript',
            '.config': { 'app.conf': 'config file' },
            'build': {
                'output.log': 'log data',
                'app.exe': 'executable',
            },
            'empty': null,
        });
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('Basic Execution', () => {
        it('should run with no arguments and find items in current dir (excluding defaults)', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            const expected = [
                '.',
                '.config',
                '.config/app.conf',
                'build',
                'build/app.exe',
                'build/output.log',
                'doc.txt',
                'empty',
                'image.jpg',
                'script.js',
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should run with a specific directory path argument', () => {
            const result = runCli(['build'], testDir);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            const expected = [
                'build/app.exe',
                'build/output.log',
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should run targeting a directory with spaces in its name', async () => {
            const testDirWithSpaces = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-spaces-'));
            await createTestStructure(testDirWithSpaces, {
                'dir with spaces': {
                    'file inside spaces.txt': 'space content'
                }
            });
            const result = runCli(['dir with spaces'], testDirWithSpaces);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            const expected = [
                'dir with spaces/file inside spaces.txt'
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);

            await fs.remove(testDirWithSpaces);
        });

        it('should run targeting a directory containing files/dirs with spaces', async () => {
             const testDirWithSpaces = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-spaces-'));
            await createTestStructure(testDirWithSpaces, {
                'dir1': {
                    'file with spaces.txt': 'content'
                }
            });
            const result = runCli(['dir1'], testDirWithSpaces);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            const expected = [
                'dir1/file with spaces.txt'
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);

            await fs.remove(testDirWithSpaces);
        });

        it('should exit with status 0 on successful execution', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
        });

        it('should output results to stdout', () => {
            const result = runCli([], testDir);
            expect(result.stdout).toBeDefined();
        });

        it('should output nothing to stderr on successful execution', () => {
            const result = runCli([], testDir);
            expect(result.stderr).toBe('');
        });
    });

    describe('Path Handling', () => {
        it('should handle "." as the current directory', () => {
            const result = runCli(['.'], testDir);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
             const expected = [
                '.',
                '.config',
                '.config/app.conf',
                'build',
                'build/app.exe',
                'build/output.log',
                'doc.txt',
                'empty',
                'image.jpg',
                'script.js',
            ].sort();
             expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should handle ".." to navigate up', async () => {
            const parentDir = path.dirname(testDir);
                        // create test file to avoid directory listing

            await fs.writeFile(path.join(parentDir, "test.txt"), "temp file");
            const result = runCli(['..'], path.dirname(testDir));
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');

             const expectedPaths = [
                path.basename(testDir),
                path.join(path.basename(testDir), ".config"),
                path.join(path.basename(testDir), ".config/app.conf"),
                path.join(path.basename(testDir), "build"),
                path.join(path.basename(testDir), "build/app.exe"),
                path.join(path.basename(testDir), "build/output.log"),
                path.join(path.basename(testDir), "doc.txt"),
                path.join(path.basename(testDir), "empty"),
                path.join(path.basename(testDir), "image.jpg"),
                path.join(path.basename(testDir), "script.js"),

            ].sort();
           const actualPaths = result.stdoutLines.map(line => {
               return path.relative(parentDir, path.join(parentDir, line));
           }).sort();

           expect(actualPaths).toEqual(expectedPaths);
        });

        it('should handle relative paths correctly', () => {
            const result = runCli(['build/output.log'], testDir);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            expect(normalizeAndSort(result.stdoutLines)).toEqual(['build/output.log']);
        });

        it('should handle absolute paths correctly', () => {
            const absolutePath = path.join(testDir, 'doc.txt');
            const result = runCli([absolutePath], testDir);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            expect(normalizeAndSort(result.stdoutLines)).toEqual([absolutePath]);
        });
    });
});