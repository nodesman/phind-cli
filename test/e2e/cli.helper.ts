import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

// Helper function to create a temporary test directory structure
export async function createTestStructure(baseDir: string, structure: any): Promise<void> {
    for (const name in structure) {
        const currentPath = path.join(baseDir, name);
        const value = structure[name];
        if (typeof value === 'string') {
            await fs.ensureDir(path.dirname(currentPath));
            await fs.writeFile(currentPath, value);
        } else if (typeof value === 'object' && value !== null) {
            await fs.ensureDir(currentPath);
            await createTestStructure(currentPath, value);
        } else {
            await fs.ensureDir(currentPath);
        }
    }
}

// Helper function to run the CLI
interface CliResult {
    stdout: string;
    stderr: string;
    stdoutLines: string[];
    stderrLines: string[];
    status: number | null;
    error?: Error;
}

export const runCli = (
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv,
    globalIgnorePath?: string | null // Keep this signature
): CliResult => {
    const cliPath = path.resolve(__dirname, '../../bin/cli.js');

    // --- UPDATE FLAG CHECK ---
    const skipGlobalIgnoreFlag = args.includes('--skip-global-ignore');

    const processEnv: NodeJS.ProcessEnv = {
        ...process.env,
        ...env,
        LC_ALL: 'C' // Force POSIX/English locale
    };

    if (skipGlobalIgnoreFlag) {
    // --- END UPDATE ---
        // If --skip-global-ignore is passed, the env var MUST be unset,
        // regardless of the globalIgnorePath argument to runCli.
        // Using delete is more robust than setting to undefined here.
        delete processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH;
    } else {
        // Only set the env var if --skip-global-ignore is NOT present
        if (globalIgnorePath === null) {
             // Explicitly unset if null is passed (and no flag)
             delete processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH;
        } else if (globalIgnorePath) {
             // Set the path if provided (and no flag)
             processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH = path.resolve(cwd, globalIgnorePath);
        } else {
             // Default: ensure it's not set if not provided or undefined (and no flag)
             delete processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH;
        }
    }
    // --- FIX END ---


    const result = spawn.sync(process.execPath, [cliPath, ...args], {
        cwd,
        encoding: 'utf-8',
        env: processEnv, // Use the modified environment
    });

    const normalizeOutput = (output: string | null): string => (output || '').replace(/\r\n/g, '\n');
    const splitLines = (output: string): string[] => output.split('\n').filter(line => line.trim() !== '');

    const stdoutNormalized = normalizeOutput(result.stdout);
    const stderrNormalized = normalizeOutput(result.stderr);

    // --- FIX: Don't log stderr here unconditionally ---
    // The test itself can log if needed based on status code
    // if (result.status !== 0) {
    //     console.error("CLI Error Stderr:", stderrNormalized);
    // }
    // --- END FIX ---


    return {
        stdout: stdoutNormalized,
        stderr: stderrNormalized,
        stdoutLines: splitLines(stdoutNormalized),
        stderrLines: splitLines(stderrNormalized),
        status: result.status,
        error: result.error,
    };
};

// Helper to normalize and sort output lines for comparison
export const normalizeAndSort = (lines: string[]) => {
    return lines
        .map(line => path.normalize(line).replace(/\\/g, '/')) // Normalize separators
        .sort();
}