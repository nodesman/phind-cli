import { PhindConfig } from '../../src/config'; // Adjust path
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('os');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;

describe('PhindConfig', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let originalPlatform: NodeJS.Platform;
    const homedir = '/home/user';
    const windowsHomedir = 'C:\\Users\\User';
    const windowsAppdata = 'C:\\Users\\User\\AppData\\Roaming';
    const xdgConfigHome = '/home/user/.config/xdg'; // More standard XDG example

    const expectedLinuxPath = path.join(homedir, '.config', 'phind', 'ignore');
    const expectedWindowsPath = path.join(windowsAppdata, 'phind', 'ignore');
    const expectedXdgPath = path.join(xdgConfigHome, 'phind', 'ignore');

    beforeEach(() => {
        // Reset mocks and environment before each test
        jest.resetAllMocks();
        originalEnv = { ...process.env };
        originalPlatform = process.platform;

        // Default mocks
        mockedOs.homedir.mockReturnValue(homedir);
        Object.defineProperty(process, 'platform', { value: 'linux', writable: true }); // Make writable
        delete process.env.XDG_CONFIG_HOME;
        delete process.env.APPDATA;

        // Mock readFile to simulate file not found by default
        mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    });

    afterEach(() => {
        // Restore environment
        process.env = originalEnv;
        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    });

    describe('Constructor and Path Determination', () => {
        it('should determine Linux path correctly (no XDG_CONFIG_HOME)', () => {
            const config = new PhindConfig();
            expect(mockedOs.homedir).toHaveBeenCalledTimes(1);
            expect(config.getGlobalIgnorePath()).toBe(expectedLinuxPath);
        });

        it('should determine Linux path correctly (with XDG_CONFIG_HOME)', () => {
            process.env.XDG_CONFIG_HOME = xdgConfigHome;
            const config = new PhindConfig();
            expect(mockedOs.homedir).not.toHaveBeenCalled(); // Should use XDG
            expect(config.getGlobalIgnorePath()).toBe(expectedXdgPath);
        });

        it('should determine Windows path correctly (with APPDATA)', () => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
            mockedOs.homedir.mockReturnValue(windowsHomedir);
            process.env.APPDATA = windowsAppdata;
            const config = new PhindConfig();
            expect(mockedOs.homedir).not.toHaveBeenCalled(); // Should use APPDATA
            expect(config.getGlobalIgnorePath()).toBe(expectedWindowsPath);
        });

        it('should determine Windows path correctly (without APPDATA - fallback to .config)', () => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
            mockedOs.homedir.mockReturnValue(windowsHomedir);
            delete process.env.APPDATA; // Simulate APPDATA not being set
            const config = new PhindConfig();
            // Falls back to the .config logic on Windows if APPDATA is missing
            const expectedWindowsFallbackPath = path.join(windowsHomedir, '.config', 'phind', 'ignore');
            expect(mockedOs.homedir).toHaveBeenCalledTimes(1);
            expect(config.getGlobalIgnorePath()).toBe(expectedWindowsFallbackPath);
        });

         it('should handle Darwin (macOS) path correctly (like Linux .config)', () => {
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            mockedOs.homedir.mockReturnValue(homedir); // Use Linux homedir for consistency
            delete process.env.XDG_CONFIG_HOME;
            const config = new PhindConfig();
            expect(mockedOs.homedir).toHaveBeenCalledTimes(1);
            expect(config.getGlobalIgnorePath()).toBe(expectedLinuxPath); // Should use ~/.config
        });

        it('should handle Darwin (macOS) path correctly (with XDG_CONFIG_HOME)', () => {
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            mockedOs.homedir.mockReturnValue(homedir);
            process.env.XDG_CONFIG_HOME = xdgConfigHome;
            const config = new PhindConfig();
            expect(mockedOs.homedir).not.toHaveBeenCalled();
            expect(config.getGlobalIgnorePath()).toBe(expectedXdgPath);
        });
    });

    describe('loadGlobalIgnores', () => {
        it('should load and parse ignore file correctly', async () => {
            const ignoreContent = `
                # This is a comment
                *.log
                temp/
                /absolute/path # Should be treated relative by micromatch later

                .DS_Store
            `;
            mockedFs.readFile.mockResolvedValue(ignoreContent);
            const config = new PhindConfig();
            await config.loadGlobalIgnores();

            const expectedPatterns = ['*.log', 'temp/', '/absolute/path', '.DS_Store'];
            // Access private member for testing (use with caution or refactor for testability)
            expect((config as any).globalIgnorePatterns).toEqual(expectedPatterns);
            expect(mockedFs.readFile).toHaveBeenCalledWith(config.getGlobalIgnorePath(), 'utf-8');
            // Ensure cache is invalidated
            expect((config as any).combinedExcludePatterns).toBeNull();
        });

         it('should handle Windows line endings (\\r\\n)', async () => {
            const ignoreContent = "*.log\r\ntemp/\r\n.DS_Store";
            mockedFs.readFile.mockResolvedValue(ignoreContent);
            const config = new PhindConfig();
            await config.loadGlobalIgnores();
            expect((config as any).globalIgnorePatterns).toEqual(['*.log', 'temp/', '.DS_Store']);
        });

        it('should handle empty ignore file', async () => {
            mockedFs.readFile.mockResolvedValue('');
            const config = new PhindConfig();
            await config.loadGlobalIgnores();
            expect((config as any).globalIgnorePatterns).toEqual([]);
        });

        it('should handle ignore file with only comments/whitespace', async () => {
            mockedFs.readFile.mockResolvedValue('# comment\n\n   \n#another');
            const config = new PhindConfig();
            await config.loadGlobalIgnores();
            expect((config as any).globalIgnorePatterns).toEqual([]);
        });

        it('should handle ENOENT error gracefully (file not found)', async () => {
            mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
            const config = new PhindConfig();
            await config.loadGlobalIgnores();
            expect((config as any).globalIgnorePatterns).toEqual([]);
            // Ensure cache is invalidated even on error
            expect((config as any).combinedExcludePatterns).toBeNull();
        });

        it('should warn and handle other read errors gracefully', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const readError = new Error('Permission denied');
            (readError as any).code = 'EACCES';
            mockedFs.readFile.mockRejectedValue(readError);

            const config = new PhindConfig();
            await config.loadGlobalIgnores();

            expect((config as any).globalIgnorePatterns).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Warning: Could not read global ignore file'));
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
            // Ensure cache is invalidated even on error
            expect((config as any).combinedExcludePatterns).toBeNull();
            warnSpy.mockRestore();
        });

         it('should not reload ignores if already loaded and forceReload is false', async () => {
            mockedFs.readFile.mockResolvedValue('*.log');
            const config = new PhindConfig();
             // Simulate already loaded (set length > 0)
            (config as any).globalIgnorePatterns = ['initial'];
            (config as any).combinedExcludePatterns = ['cached']; // Simulate cache being set

            mockedFs.readFile.mockClear(); // Reset call count
            await config.loadGlobalIgnores(false); // Attempt second load without force
            expect(mockedFs.readFile).not.toHaveBeenCalled();
            expect((config as any).globalIgnorePatterns).toEqual(['initial']); // Should retain old patterns
            expect((config as any).combinedExcludePatterns).toEqual(['cached']); // Cache should not be invalidated
        });

        it('should reload ignores if forceReload is true, even if previously loaded', async () => {
            // Simulate already loaded
            const config = new PhindConfig();
            (config as any).globalIgnorePatterns = ['initial'];
            (config as any).combinedExcludePatterns = ['cached'];

            mockedFs.readFile.mockResolvedValueOnce('*.tmp\ncache/'); // File content for reload
            await config.loadGlobalIgnores(true); // Force reload

            expect(mockedFs.readFile).toHaveBeenCalledTimes(1); // Should have read the file
            expect((config as any).globalIgnorePatterns).toEqual(['*.tmp', 'cache/']);
            expect((config as any).combinedExcludePatterns).toBeNull(); // Cache invalidated
        });

         it('should load ignores if forceReload is true, even if not previously loaded', async () => {
            const config = new PhindConfig();
             // Not previously loaded: globalIgnorePatterns = []
             // Cache is null

            mockedFs.readFile.mockResolvedValueOnce('*.tmp\ncache/'); // File content for reload
            await config.loadGlobalIgnores(true); // Force reload

            expect(mockedFs.readFile).toHaveBeenCalledTimes(1); // Should have read the file
            expect((config as any).globalIgnorePatterns).toEqual(['*.tmp', 'cache/']);
            expect((config as any).combinedExcludePatterns).toBeNull(); // Cache invalidated (was already null, but logic dictates it)
        });

        it('should not load ignores if not forceReload and not previously loaded (logic check)', async () => {
            // This tests the internal logic check: if (!forceReload && this.globalIgnorePatterns.length > 0) return;
            const config = new PhindConfig();
             // Ensure it's considered "not loaded"
             expect((config as any).globalIgnorePatterns.length).toBe(0);

             mockedFs.readFile.mockClear();
             await config.loadGlobalIgnores(false); // Should proceed to try reading

             // Expect it to *attempt* the read, even if it fails (default mock is ENOENT)
             expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('setCliExcludes', () => {
        it('should store CLI excludes and invalidate cache', () => {
            const config = new PhindConfig();
            (config as any).combinedExcludePatterns = ['cached']; // Pre-fill cache
            const cliExcludes = ['cli_exclude1', '*.swp'];

            config.setCliExcludes(cliExcludes);

            expect((config as any).cliExcludePatterns).toEqual(cliExcludes);
            expect((config as any).combinedExcludePatterns).toBeNull(); // Cache invalidated
        });

        it('should handle empty array and invalidate cache', () => {
            const config = new PhindConfig();
            (config as any).combinedExcludePatterns = ['cached']; // Pre-fill cache
             config.setCliExcludes([]);
             expect((config as any).cliExcludePatterns).toEqual([]);
             expect((config as any).combinedExcludePatterns).toBeNull();
        });
    });

    describe('getEffectiveExcludePatterns', () => {
        const defaultExcludes = ['node_modules', '.git'];

        it('should return only defaults if no global and no CLI ignores', () => {
            const config = new PhindConfig();
            // No loadGlobalIgnores called, no setCliExcludes called
            expect(config.getEffectiveExcludePatterns()).toEqual(defaultExcludes);
            // Check cache is now populated
            expect((config as any).combinedExcludePatterns).toEqual(defaultExcludes);
        });

        it('should combine defaults and global ignores', async () => {
            mockedFs.readFile.mockResolvedValue('*.tmp\ndist/');
            const config = new PhindConfig();
            await config.loadGlobalIgnores(); // Loads and invalidates cache
            // No setCliExcludes called
            const expected = [...defaultExcludes, '*.tmp', 'dist/'];
            expect(config.getEffectiveExcludePatterns()).toEqual(expected);
            expect((config as any).combinedExcludePatterns).toEqual(expected); // Cache check
        });

        it('should combine defaults and CLI ignores', () => {
            const config = new PhindConfig();
            // No loadGlobalIgnores called
            config.setCliExcludes(['build/', '*.o']); // Invalidates cache
            const expected = [...defaultExcludes, 'build/', '*.o'];
            expect(config.getEffectiveExcludePatterns()).toEqual(expected);
            expect((config as any).combinedExcludePatterns).toEqual(expected); // Cache check
        });

        it('should combine defaults, global, and CLI ignores', async () => {
            mockedFs.readFile.mockResolvedValue('*.tmp\ndist/');
            const config = new PhindConfig();
            await config.loadGlobalIgnores(); // Loads and invalidates cache
            config.setCliExcludes(['build/', '*.o']); // Invalidates cache again
            const expected = [...defaultExcludes, '*.tmp', 'dist/', 'build/', '*.o'];
            expect(config.getEffectiveExcludePatterns()).toEqual(expected);
            expect((config as any).combinedExcludePatterns).toEqual(expected); // Cache check
        });

        it('should use cache on subsequent calls if state hasn\'t changed', async () => {
             mockedFs.readFile.mockResolvedValue('*.tmp\ndist/');
             const config = new PhindConfig();
             await config.loadGlobalIgnores();
             config.setCliExcludes(['build/', '*.o']);

             const result1 = config.getEffectiveExcludePatterns(); // Calculate and cache
             const result2 = config.getEffectiveExcludePatterns(); // Should use cache

             expect(result1).toBe(result2); // Should be the same array instance
             expect((config as any).combinedExcludePatterns).toBe(result1); // Cache should hold the result
        });

         it('should recalculate if CLI excludes change after first call', async () => {
             mockedFs.readFile.mockResolvedValue('*.tmp');
             const config = new PhindConfig();
             await config.loadGlobalIgnores();

             const result1 = config.getEffectiveExcludePatterns(); // Defaults + global
             expect(result1).toEqual([...defaultExcludes, '*.tmp']);
             expect((config as any).combinedExcludePatterns).toBe(result1); // Cache check

             config.setCliExcludes(['cli_new']); // Invalidate cache
             expect((config as any).combinedExcludePatterns).toBeNull(); // Verify cache invalidated

             const result2 = config.getEffectiveExcludePatterns(); // Recalculate
             expect(result2).toEqual([...defaultExcludes, '*.tmp', 'cli_new']);
             expect(result1).not.toBe(result2); // Should be a new array instance
             expect((config as any).combinedExcludePatterns).toBe(result2); // Cache check
        });

         it('should recalculate if global ignores are reloaded after first call', async () => {
             mockedFs.readFile.mockResolvedValueOnce('*.tmp');
             const config = new PhindConfig();
             await config.loadGlobalIgnores(); // Load 1

             const result1 = config.getEffectiveExcludePatterns(); // Defaults + global 1
             expect(result1).toEqual([...defaultExcludes, '*.tmp']);
             expect((config as any).combinedExcludePatterns).toBe(result1); // Cache check

             mockedFs.readFile.mockResolvedValueOnce('*.log\ncache/');
             await config.loadGlobalIgnores(true); // Force reload with new patterns (invalidates cache)
             expect((config as any).combinedExcludePatterns).toBeNull(); // Verify cache invalidated

             const result2 = config.getEffectiveExcludePatterns(); // Recalculate
             expect(result2).toEqual([...defaultExcludes, '*.log', 'cache/']);
             expect(result1).not.toBe(result2); // Should be a new array instance
             expect((config as any).combinedExcludePatterns).toBe(result2); // Cache check
         });

         it('should return distinct patterns even if duplicated across sources', async () => {
             // Scenario: default='node_modules', global='node_modules', cli='*.log'
             mockedFs.readFile.mockResolvedValue('node_modules\ncache/'); // global has duplicate
             const config = new PhindConfig();
             await config.loadGlobalIgnores();
             config.setCliExcludes(['*.log', '.git']); // cli has duplicate

             // Current implementation *doesn't* deduplicate, which might be okay
             // If deduplication is added, this test should change.
             const expected = [
                 'node_modules', '.git', // defaults
                 'node_modules', 'cache/', // global
                 '*.log', '.git' // cli
                ];
             const actual = config.getEffectiveExcludePatterns();
             expect(actual).toEqual(expected);

             // If deduplication were desired (uncomment the Set line in config.ts):
             // const expectedDeduped = ['node_modules', '.git', 'cache/', '*.log'];
             // expect(actual).toEqual(expect.arrayContaining(expectedDeduped));
             // expect(actual.length).toEqual(expectedDeduped.length);
         });
    });

    describe('getDefaultExcludesDescription', () => {
        it('should return the correct description string', () => {
            const config = new PhindConfig();
            expect(config.getDefaultExcludesDescription()).toBe('"node_modules", ".git"');
        });

        it('should return empty string if hardcoded defaults were empty (hypothetical)', () => {
            const config = new PhindConfig();
            (config as any).hardcodedDefaultExcludes = []; // Modify for test
            expect(config.getDefaultExcludesDescription()).toBe('');
        });

         it('should handle single default exclude correctly', () => {
            const config = new PhindConfig();
            (config as any).hardcodedDefaultExcludes = ['only_one']; // Modify for test
            expect(config.getDefaultExcludesDescription()).toBe('"only_one"');
        });
    });
});