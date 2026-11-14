import type { Page, Route } from '@playwright/test';

export interface MockCommit {
  sha: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  date?: string;
}

export type CloneMockMode =
  | 'happy'
  | 'rate-limit-fallback'
  | 'not-found'
  | 'server-error'
  | 'mid-blob-abort';

export interface GitHubRepoFixture {
  defaultBranch?: string;
  files?: Record<string, string>;
  commits?: MockCommit[];
  mode?: CloneMockMode;
  rateLimitStatus?: 403 | 429;
  rateLimitRawContent?: boolean;
  blobDelayMs?: number;
  pauseAfterBlobs?: number;
  failAfterBlobs?: number;
}

export interface GitHubMockOptions extends GitHubRepoFixture {
  owner?: string;
  repo?: string;
  /**
   * Optional map of `"owner/repo"` -> per-repo fixture configuration for
   * multi-repository switching and mixed error/recovery scenarios.
   */
  repos?: Record<string, GitHubRepoFixture>;
}

export interface GitHubMockController {
  readonly requests: Array<{ url: string; host: string; status: number | 'aborted' }>;
  /** Resolves when at least `pauseAfterBlobs` blob requests have completed and the next blob is held in flight. */
  waitForPausedBlobs(): Promise<void>;
  /** Releases any paused blob responses. */
  releasePausedBlobs(): void;
  /** Removes all route handlers installed by this mock. */
  dispose(): Promise<void>;
}

export const HAPPY_PATH_FILES: Record<string, string> = {
  'README.md': '# Acme Demo Repo\n\nCloned deterministically in E2E.\n',
  'package.json':
    JSON.stringify(
      { name: 'acme-demo', version: '1.0.0', main: 'src/index.ts' },
      null,
      2
    ) + '\n',
  'src/index.ts': 'import { add } from "./utils";\nconsole.log("sum =", add(2, 3));\n',
  'src/utils.ts': 'export function add(a: number, b: number): number {\n  return a + b;\n}\n'
};

export const HAPPY_PATH_COMMITS: MockCommit[] = [
  {
    sha: '9f8e7d6c5b4a32109f8e7d6c5b4a32109f8e7d6c',
    message: 'feat: add TypeScript entry and utils',
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@acme.test',
    date: '2026-02-10T12:00:00Z'
  },
  {
    sha: '1a2b3c4d5e6f70811a2b3c4d5e6f70811a2b3c4d',
    message: 'chore: initial repository scaffold',
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@acme.test',
    date: '2026-02-09T09:30:00Z'
  }
];

/** Builds a multi-file repository fixture (default 28 files) for post-clone tab-cap verification (`<= 5` tabs). */
export function buildLargeRepoFiles(fileCount = 28): Record<string, string> {
  const files: Record<string, string> = {
    'README.md': '# Large Repo Fixture\n\nVerifies post-clone tab cap (<= 5 tabs).\n',
    'package.json': '{"name":"large-repo","version":"1.0.0","main":"src/index.ts"}\n',
    'src/index.ts': 'export const ENTRY = true;\n'
  };
  for (let i = 1; i <= Math.max(0, fileCount - 3); i++) {
    const padded = String(i).padStart(2, '0');
    files[`src/modules/mod-${padded}.ts`] = `export const MOD_${padded} = ${i};\n`;
  }
  return files;
}

interface ResolvedRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  files: Record<string, string>;
  commits: MockCommit[];
  mode: CloneMockMode;
  rateStatus: 403 | 429;
  rateLimitRaw: boolean;
  blobDelayMs: number;
  pauseAfterBlobs?: number;
  failAfterBlobs: number;
}

export async function installGitHubMock(
  page: Page,
  opts: GitHubMockOptions = {}
): Promise<GitHubMockController> {
  const defaultOwner = opts.owner ?? 'acme';
  const defaultRepo = opts.repo ?? 'demo-repo';

  const resolveRepo = (reqOwner: string, reqRepo: string): ResolvedRepoConfig | null => {
    const key = `${reqOwner}/${reqRepo}`;
    const custom = opts.repos?.[key];
    if (custom) {
      return {
        owner: reqOwner,
        repo: reqRepo,
        branch: custom.defaultBranch ?? opts.defaultBranch ?? 'main',
        files: custom.files ?? HAPPY_PATH_FILES,
        commits: custom.commits ?? HAPPY_PATH_COMMITS,
        mode: custom.mode ?? opts.mode ?? 'happy',
        rateStatus: custom.rateLimitStatus ?? opts.rateLimitStatus ?? 429,
        rateLimitRaw: custom.rateLimitRawContent ?? opts.rateLimitRawContent ?? true,
        blobDelayMs: custom.blobDelayMs ?? opts.blobDelayMs ?? 0,
        pauseAfterBlobs: custom.pauseAfterBlobs ?? opts.pauseAfterBlobs,
        failAfterBlobs: custom.failAfterBlobs ?? opts.failAfterBlobs ?? 1
      };
    }
    if (reqOwner === defaultOwner && reqRepo === defaultRepo) {
      return {
        owner: defaultOwner,
        repo: defaultRepo,
        branch: opts.defaultBranch ?? 'main',
        files: opts.files ?? HAPPY_PATH_FILES,
        commits: opts.commits ?? HAPPY_PATH_COMMITS,
        mode: opts.mode ?? 'happy',
        rateStatus: opts.rateLimitStatus ?? 429,
        rateLimitRaw: opts.rateLimitRawContent ?? true,
        blobDelayMs: opts.blobDelayMs ?? 0,
        pauseAfterBlobs: opts.pauseAfterBlobs,
        failAfterBlobs: opts.failAfterBlobs ?? 1
      };
    }
    // If single global error mode was installed without matching specific owner/repo
    if (!opts.repos && (opts.mode === 'not-found' || opts.mode === 'server-error')) {
      return {
        owner: reqOwner,
        repo: reqRepo,
        branch: opts.defaultBranch ?? 'main',
        files: {},
        commits: [],
        mode: opts.mode,
        rateStatus: opts.rateLimitStatus ?? 429,
        rateLimitRaw: true,
        blobDelayMs: 0,
        failAfterBlobs: 0
      };
    }
    return null;
  };

  const requests: Array<{ url: string; host: string; status: number | 'aborted' }> = [];
  const servedBlobsByRepo = new Map<string, number>();
  const fulfilledBlobsByRepo = new Map<string, number>();
  const pausedBlobsByRepo = new Map<string, number>();
  const repoGenerationByRepo = new Map<string, number>();
  const releasedRepos = new Set<string>();
  let disposed = false;

  interface PauseEpoch {
    pausedCount: number;
    notified: boolean;
    repos: Set<string>;
    pausedReady: Promise<void>;
    notifyPaused: () => void;
    gatePromise: Promise<void>;
    releaseGate: () => void;
  }

  const createPauseEpoch = (): PauseEpoch => {
    let rawNotifyPaused!: () => void;
    const pausedReady = new Promise<void>((res) => {
      rawNotifyPaused = res;
    });
    let releaseGate!: () => void;
    const gatePromise = new Promise<void>((res) => {
      releaseGate = res;
    });
    const epoch: PauseEpoch = {
      pausedCount: 0,
      notified: false,
      repos: new Set<string>(),
      pausedReady,
      notifyPaused: () => {
        if (!epoch.notified) {
          epoch.notified = true;
          rawNotifyPaused();
        }
      },
      gatePromise,
      releaseGate
    };
    return epoch;
  };

  let activePauseEpoch = createPauseEpoch();

  const checkRepoPauseReady = (
    epoch: PauseEpoch,
    repoKey: string,
    cfg: ResolvedRepoConfig
  ): void => {
    if (
      disposed ||
      epoch.notified ||
      cfg.pauseAfterBlobs === undefined ||
      releasedRepos.has(repoKey)
    ) {
      return;
    }
    const totalBlobs = Object.keys(cfg.files).length;
    const requiredFulfilled = Math.min(cfg.pauseAfterBlobs, totalBlobs);
    const requiredPaused = totalBlobs > cfg.pauseAfterBlobs ? 1 : 0;
    const fulfilled = fulfilledBlobsByRepo.get(repoKey) ?? 0;
    const paused = pausedBlobsByRepo.get(repoKey) ?? 0;
    if (fulfilled >= requiredFulfilled && paused >= requiredPaused) {
      epoch.repos.add(repoKey);
      epoch.notifyPaused();
    }
  };

  const resetRepoCloneProgress = (cfg: ResolvedRepoConfig): void => {
    const repoKey = `${cfg.owner}/${cfg.repo}`;
    repoGenerationByRepo.set(repoKey, (repoGenerationByRepo.get(repoKey) ?? 0) + 1);
    servedBlobsByRepo.set(repoKey, 0);
    fulfilledBlobsByRepo.set(repoKey, 0);
    pausedBlobsByRepo.set(repoKey, 0);
    releasedRepos.delete(repoKey);
    if (!disposed && cfg.pauseAfterBlobs !== undefined && Object.keys(cfg.files).length === 0) {
      checkRepoPauseReady(activePauseEpoch, repoKey, cfg);
    }
  };

  const releaseCurrentEpoch = (): void => {
    const prev = activePauseEpoch;
    for (const repoKey of prev.repos) {
      releasedRepos.add(repoKey);
    }
    activePauseEpoch = createPauseEpoch();
    prev.notifyPaused();
    prev.releaseGate();
  };

  const decodeRepoPath = (encodedPath: string): string =>
    encodedPath.split('/').map(decodeURIComponent).join('/');

  const maybeDelayOrAbortBlob = async (
    cfg: ResolvedRepoConfig,
    route: Route,
    url: string,
    host: string
  ): Promise<boolean> => {
    const repoKey = `${cfg.owner}/${cfg.repo}`;
    const gen = repoGenerationByRepo.get(repoKey) ?? 0;
    const idx = (servedBlobsByRepo.get(repoKey) ?? 0) + 1;
    servedBlobsByRepo.set(repoKey, idx);

    if (cfg.mode === 'mid-blob-abort' && idx > cfg.failAfterBlobs) {
      requests.push({ url, host, status: 'aborted' });
      await route.abort('connectionreset');
      return true;
    }
    if (
      !disposed &&
      cfg.pauseAfterBlobs !== undefined &&
      idx > cfg.pauseAfterBlobs &&
      !releasedRepos.has(repoKey)
    ) {
      const epoch = activePauseEpoch;
      epoch.repos.add(repoKey);
      epoch.pausedCount++;
      pausedBlobsByRepo.set(repoKey, (pausedBlobsByRepo.get(repoKey) ?? 0) + 1);
      checkRepoPauseReady(epoch, repoKey, cfg);
      await epoch.gatePromise;
      if (disposed) return true;
      if (cfg.blobDelayMs > 0) {
        await new Promise((r) => setTimeout(r, cfg.blobDelayMs));
      }
      return false;
    }

    const epochAtStart = activePauseEpoch;
    if (cfg.blobDelayMs > 0) {
      await new Promise((r) => setTimeout(r, cfg.blobDelayMs));
    }
    if (disposed) return true;
    if (
      cfg.pauseAfterBlobs !== undefined &&
      idx <= cfg.pauseAfterBlobs &&
      !releasedRepos.has(repoKey)
    ) {
      setTimeout(() => {
        if (disposed || (repoGenerationByRepo.get(repoKey) ?? 0) !== gen) return;
        fulfilledBlobsByRepo.set(repoKey, (fulfilledBlobsByRepo.get(repoKey) ?? 0) + 1);
        checkRepoPauseReady(epochAtStart, repoKey, cfg);
      }, 5);
    }
    return false;
  };

  // 1. api.github.com
  const apiPattern = 'https://api.github.com/**';
  const apiHandler = async (route: Route) => {
    const urlObj = new URL(route.request().url());
    const pathname = urlObj.pathname;
    const match = pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
    if (!match) {
      requests.push({ url: urlObj.href, host: 'api.github.com', status: 404 });
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{"message":"Not Found"}'
      });
    }

    const [, reqOwner, reqRepo, subPath = ''] = match;
    const cfg = resolveRepo(reqOwner, reqRepo);
    if (!cfg || cfg.mode === 'not-found') {
      requests.push({ url: urlObj.href, host: 'api.github.com', status: 404 });
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not Found' })
      });
    }

    if (cfg.mode === 'server-error') {
      requests.push({ url: urlObj.href, host: 'api.github.com', status: 500 });
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' })
      });
    }

    if (cfg.mode === 'rate-limit-fallback') {
      requests.push({ url: urlObj.href, host: 'api.github.com', status: cfg.rateStatus });
      return route.fulfill({
        status: cfg.rateStatus,
        contentType: 'application/json',
        headers: { 'x-ratelimit-remaining': '0' },
        body: JSON.stringify({ message: 'API rate limit exceeded' })
      });
    }

    // Repo metadata: /repos/{owner}/{repo}
    if (!subPath) {
      requests.push({ url: urlObj.href, host: 'api.github.com', status: 200 });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          full_name: `${cfg.owner}/${cfg.repo}`,
          default_branch: cfg.branch
        })
      });
    }

    // Recursive git tree: /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
    if (subPath === `git/trees/${encodeURIComponent(cfg.branch)}` || subPath === `git/trees/${cfg.branch}`) {
      resetRepoCloneProgress(cfg);
      const tree = Object.entries(cfg.files).map(([filePath, content]) => ({
        path: filePath,
        mode: '100644',
        type: 'blob',
        size: Buffer.byteLength(content, 'utf8'),
        sha: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
      }));
      requests.push({ url: urlObj.href, host: 'api.github.com', status: 200 });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: cfg.branch, truncated: false, tree })
      });
    }

    // Commits history: /repos/{owner}/{repo}/commits
    if (subPath === 'commits') {
      const payload = cfg.commits.map((c) => ({
        sha: c.sha,
        commit: {
          message: c.message,
          author: {
            name: c.authorName ?? cfg.owner,
            email: c.authorEmail ?? `${cfg.owner}@users.noreply.github.com`,
            date: c.date ?? '2026-02-10T12:00:00Z'
          }
        }
      }));
      requests.push({ url: urlObj.href, host: 'api.github.com', status: 200 });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload)
      });
    }

    requests.push({ url: urlObj.href, host: 'api.github.com', status: 404 });
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"message":"Not Found"}'
    });
  };

  // 2. data.jsdelivr.com (Strategy B flat tree fallback)
  const jsdDataPattern = 'https://data.jsdelivr.com/**';
  const jsdDataHandler = async (route: Route) => {
    const urlObj = new URL(route.request().url());
    const match = urlObj.pathname.match(/^\/v1\/package\/gh\/([^/]+)\/([^@]+)@([^/]+)\/flat$/);
    if (!match) {
      requests.push({ url: urlObj.href, host: 'data.jsdelivr.com', status: 404 });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"files":[]}' });
    }

    const [, reqOwner, reqRepo, reqBranch] = match;
    const cfg = resolveRepo(reqOwner, reqRepo);
    if (!cfg || cfg.mode === 'not-found') {
      requests.push({ url: urlObj.href, host: 'data.jsdelivr.com', status: 404 });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
    }
    if (cfg.mode === 'server-error') {
      requests.push({ url: urlObj.href, host: 'data.jsdelivr.com', status: 500 });
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Server Error"}' });
    }

    if (decodeURIComponent(reqBranch) === cfg.branch) {
      resetRepoCloneProgress(cfg);
      const flatFiles = Object.entries(cfg.files).map(([filePath, content]) => ({
        name: `/${filePath.replace(/^\/+/, '')}`,
        size: Buffer.byteLength(content, 'utf8'),
        hash: 'sha256-mock'
      }));
      requests.push({ url: urlObj.href, host: 'data.jsdelivr.com', status: 200 });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default: '/README.md', files: flatFiles })
      });
    }

    requests.push({ url: urlObj.href, host: 'data.jsdelivr.com', status: 404 });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"files":[]}' });
  };

  // 3. raw.githubusercontent.com (Primary blob download)
  const rawPattern = 'https://raw.githubusercontent.com/**';
  const rawHandler = async (route: Route) => {
    const urlObj = new URL(route.request().url());
    const match = urlObj.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) {
      requests.push({ url: urlObj.href, host: 'raw.githubusercontent.com', status: 404 });
      return route.fulfill({ status: 404, contentType: 'text/plain', body: '404: Not Found' });
    }

    const [, reqOwner, reqRepo, reqBranch, restPath] = match;
    const cfg = resolveRepo(reqOwner, reqRepo);
    if (!cfg || cfg.mode === 'not-found') {
      requests.push({ url: urlObj.href, host: 'raw.githubusercontent.com', status: 404 });
      return route.fulfill({ status: 404, contentType: 'text/plain', body: '404: Not Found' });
    }
    if (cfg.mode === 'server-error') {
      requests.push({ url: urlObj.href, host: 'raw.githubusercontent.com', status: 500 });
      return route.fulfill({ status: 500, contentType: 'text/plain', body: '500: Error' });
    }
    if (cfg.mode === 'rate-limit-fallback' && cfg.rateLimitRaw) {
      requests.push({ url: urlObj.href, host: 'raw.githubusercontent.com', status: cfg.rateStatus });
      return route.fulfill({ status: cfg.rateStatus, contentType: 'text/plain', body: 'Too Many Requests' });
    }

    if (decodeURIComponent(reqBranch) === cfg.branch) {
      const relPath = decodeRepoPath(restPath);
      if (Object.prototype.hasOwnProperty.call(cfg.files, relPath)) {
        if (await maybeDelayOrAbortBlob(cfg, route, urlObj.href, 'raw.githubusercontent.com')) return;
        requests.push({ url: urlObj.href, host: 'raw.githubusercontent.com', status: 200 });
        return route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: cfg.files[relPath]
        });
      }
    }

    requests.push({ url: urlObj.href, host: 'raw.githubusercontent.com', status: 404 });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: '404: Not Found' });
  };

  // 4. cdn.jsdelivr.net/gh/** (Fallback blob download — strictly /gh/** so /npm/** Monaco stubs stay separate)
  const cdnGhPattern = 'https://cdn.jsdelivr.net/gh/**';
  const cdnGhHandler = async (route: Route) => {
    const urlObj = new URL(route.request().url());
    const match = urlObj.pathname.match(/^\/gh\/([^/]+)\/([^@]+)@([^/]+)\/(.+)$/);
    if (!match) {
      requests.push({ url: urlObj.href, host: 'cdn.jsdelivr.net', status: 404 });
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
    }

    const [, reqOwner, reqRepo, reqBranch, restPath] = match;
    const cfg = resolveRepo(reqOwner, reqRepo);
    if (!cfg || cfg.mode === 'not-found') {
      requests.push({ url: urlObj.href, host: 'cdn.jsdelivr.net', status: 404 });
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
    }
    if (cfg.mode === 'server-error') {
      requests.push({ url: urlObj.href, host: 'cdn.jsdelivr.net', status: 500 });
      return route.fulfill({ status: 500, contentType: 'text/plain', body: 'Server Error' });
    }

    if (decodeURIComponent(reqBranch) === cfg.branch) {
      const relPath = decodeRepoPath(restPath);
      if (Object.prototype.hasOwnProperty.call(cfg.files, relPath)) {
        if (await maybeDelayOrAbortBlob(cfg, route, urlObj.href, 'cdn.jsdelivr.net')) return;
        requests.push({ url: urlObj.href, host: 'cdn.jsdelivr.net', status: 200 });
        return route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: cfg.files[relPath]
        });
      }
    }

    requests.push({ url: urlObj.href, host: 'cdn.jsdelivr.net', status: 404 });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
  };

  await page.route(apiPattern, apiHandler);
  await page.route(jsdDataPattern, jsdDataHandler);
  await page.route(rawPattern, rawHandler);
  await page.route(cdnGhPattern, cdnGhHandler);

  return {
    requests,
    waitForPausedBlobs: () => activePauseEpoch.pausedReady,
    releasePausedBlobs: () => releaseCurrentEpoch(),
    async dispose() {
      disposed = true;
      releaseCurrentEpoch();
      await page.unroute(apiPattern, apiHandler);
      await page.unroute(jsdDataPattern, jsdDataHandler);
      await page.unroute(rawPattern, rawHandler);
      await page.unroute(cdnGhPattern, cdnGhHandler);
    }
  };
}
