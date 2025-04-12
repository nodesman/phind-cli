// test/e2e/cli.errors.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure } from './cli.helper';

describe('CLI E2E - Argument Validation and Error Handling', () => {
    let testDir: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        // Resolve real path for potential symlinks (like /var -> /private/var on macOS)
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-');
        const tempDir = await fs.mkdtemp(tempDirPrefix);
        testDir = await fs.realpath(tempDir); // Use real path for running tests
        originalEnv = { ...process.env };
    });

    afterEach(async () => {
        await fs.remove(testDir); // Use real path for removal too
        process.env = originalEnv; // Restore env
    });

    it('should exit with non-zero status and error message for invalid option values (e.g., --type x)', () => {
        const result = runCli(['--type', 'x'], testDir);
        expect(result.status).not.toBe(0);
        // Make assertion less dependent on exact locale string format
        expect(result.stderr).toMatch(/invalid values|ongeldige waarden/i); // Match English or Dutch
        expect(result.stderr).toContain('Argument: type'); // Argument name is usually consistent
        expect(result.stderr).toMatch(/given: "x"|gegeven: "x"/i); // Check the invalid value given
    });

    it('should exit with non-zero status and error message for unknown options (strict mode)', () => {
        const result = runCli(['--invalid-option'], testDir);
        expect(result.status).not.toBe(0);
        // Make assertion less dependent on exact locale string format
        expect(result.stderr).toMatch(/unknown argument|onbekende argumenten/i); // Match English or Dutch
        expect(result.stderr).toContain('invalid-option'); // Check the invalid option provided
    });

    it('should exit with non-zero status and error message if start path does not exist', () => {
        const nonExistentPath = path.join(testDir, 'non-existent-dir');
        const result = runCli([nonExistentPath], testDir);
        expect(result.status).not.toBe(0);
        // Expect the actual error format thrown by the app
        expect(result.stderr).toContain(`Start path "${nonExistentPath}"`);
        expect(result.stderr).toContain('not found');
        expect(result.stderr).toContain(`(resolved to "${nonExistentPath}")`); // Check for the added detail
    });

    it('should exit with non-zero status and error message if start path is not a directory', async () => {
        const filePath = path.join(testDir, 'testfile.txt');
        await fs.writeFile(filePath, 'some content');
        const result = runCli([filePath], testDir);
        expect(result.status).not.toBe(0);
        // Expect the actual error format thrown by the app
        expect(result.stderr).toContain(`Start path "${filePath}"`);
        expect(result.stderr).toContain('is not a directory');
        expect(result.stderr).toContain(`(resolved to "${filePath}")`); // Check for the added detail
        // Check the outer error wrapper message structure too
        expect(result.stderr).toMatch(/Error:.*is not a directory/);
    });

     it('should print permission errors to stderr but attempt to continue processing other directories', async () => {
        // Create a directory and make it unreadable
        const unreadableDir = path.join(testDir, 'unreadable');
        const readableDir = path.join(testDir, 'readable');
        const readableFile = path.join(readableDir, 'accessible.txt');

        await fs.ensureDir(unreadableDir);
        await fs.ensureDir(readableDir);
        await fs.writeFile(readableFile, 'can read this');

        let chmodError: Error | null = null; // Explicitly type chmodError
        try {
            // Attempt to make it unreadable (might fail on some systems/permissions)
            await fs.chmod(unreadableDir, 0o000); // No read/write/execute
        } catch (err) {
             // --- FIX: Check if err is an Error ---
             if (err instanceof Error) {
                 chmodError = err;
                 console.warn(`Could not set permissions for unreadable_dir in test: ${err.message}. Test may not be reliable.`);
             } else {
                 chmodError = new Error(String(err)); // Wrap non-error types
                 console.warn(`Could not set permissions for unreadable_dir in test (non-Error type): ${String(err)}. Test may not be reliable.`);
             }
        }

        const result = runCli([testDir], testDir); // Run on the parent directory

        // Restore permissions immediately after run, before assertions
        if (!chmodError) {
            try {
                await fs.chmod(unreadableDir, 0o777);
            } catch (err) {
                 // --- FIX: Check if err is an Error ---
                 if (err instanceof Error) {
                     console.warn(`Could not restore permissions for unreadable_dir: ${err.message}`);
                 } else {
                     console.warn(`Could not restore permissions for unreadable_dir (non-Error type): ${String(err)}`);
                 }
            }
        }

        // Check if the readable file was found (indicating continuation)
        // Use realTestDir when checking absolute paths in output
        expect(result.stdoutLines).toContain(path.join(testDir, 'readable', 'accessible.txt'));

        // If chmod succeeded, we expect the error message. Otherwise, this part of the test is unreliable.
        if (!chmodError) {
            // Check stderr for the specific error message format from the traverser
            expect(result.stderr).toContain(`Permission error reading directory`);
            // Normalize slashes in the path for comparison within the error message
            expect(result.stderr).toContain(unreadableDir.replace(/\\/g, '/'));
        } else {
            // If chmod failed, we shouldn't expect the permission error message
             expect(result.stderr).not.toMatch(new RegExp(`Permission error reading directory.*${unreadableDir.replace(/\\/g, '\\\\')}`));
        }

        // Should exit successfully overall as it continued processing readable parts
        expect(result.status).toBe(0);
    });
});