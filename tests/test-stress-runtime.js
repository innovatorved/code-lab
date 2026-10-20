/**
 * Empirical Challenger Test Suite: Stress & Adversarial Runtime Testing for src/runtime.ts
 *
 * Verifies:
 * 1. Complex TypeScript generics (nested, conditional, mapped, recursive, arrow functions, chained methods)
 * 2. Async iterators & generators (async function*, for await..of, custom Symbol.asyncIterator)
 * 3. Decorators & advanced class constructs (decorators handled without host crash, parameter properties, private fields)
 * 4. Large memory allocations & VFS integrity (16MB buffers, SHA-256 verification, sequential allocations)
 * 5. Runtime resilience & limits (stack overflow caught, output flood truncated, process.exit codes, sandbox isolation)
 */

const assert = require('assert');
const path = require('path');
const { transpileTS, executeInVirtualRuntime, executeInWorker } = require('../src/runtime.ts');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('   CHALLENGER STRESS & ADVERSARIAL SUITE: src/runtime.ts');
  console.log('======================================================================\n');

  // ── Suite 1: Complex Generics ─────────────────────────────────────────────
  console.log('--- Suite 1: Complex TypeScript Generics ---');

  await runTest('1.1 Deeply nested generic tree with multi-type parameter constraints', async () => {
    const code = `
      interface Node<T> {
        value: T;
        children: Array<Node<T>>;
      }
      class GenericTree<T extends Record<string, any> = { val: number }> {
        private root: Node<T>;
        constructor(initial: T) {
          this.root = { value: initial, children: [] };
        }
        public addChild<U extends T>(childVal: U): void {
          this.root.children.push({ value: childVal, children: [] });
        }
        public getRoot(): Node<T> {
          return this.root;
        }
      }
      const tree = new GenericTree<{ val: number; name: string }>({ val: 1, name: 'root' });
      tree.addChild({ val: 2, name: 'child-1' });
      const root = tree.getRoot();
      console.log('TREE_COUNT:' + (1 + root.children.length));
    `;
    const res = await executeInVirtualRuntime({
      entry: 'tree.ts',
      files: { 'tree.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0, got ${res.exitCode}: ${res.stderr}`);
    assert.ok(res.stdout.includes('TREE_COUNT:2'));
  });

  await runTest('1.2 Generic arrow functions with keyof constraint', async () => {
    const code = `
      const pluck = <T, K extends keyof T>(obj: T, key: K): T[K] => obj[key];
      const payload = { host: '127.0.0.1', port: 8080, secure: false };
      const port: number = pluck(payload, 'port');
      console.log('PLUCKED_PORT:' + port);
    `;
    const res = await executeInVirtualRuntime({
      entry: 'pluck.ts',
      files: { 'pluck.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0, got ${res.exitCode}: ${res.stderr}`);
    assert.ok(res.stdout.includes('PLUCKED_PORT:8080'));
  });

  await runTest('1.3 Chained generic fluent builder pattern', async () => {
    const code = `
      class Fluent<T> {
        private val: T;
        constructor(val: T) { this.val = val; }
        map<U>(fn: (x: T) => U): Fluent<U> {
          return new Fluent<U>(fn(this.val));
        }
        get(): T { return this.val; }
      }
      const val = new Fluent<number>(12345)
        .map<string>((n) => 'CODE_' + n)
        .map<number>((s) => s.length)
        .get();
      console.log('BUILDER_LEN:' + val);
    `;
    const res = await executeInVirtualRuntime({
      entry: 'builder.ts',
      files: { 'builder.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('BUILDER_LEN:10'));
  });

  await runTest('1.4 Complex conditional and mapped type declarations stripped cleanly', async () => {
    const code = `
      type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends (infer U)[]
          ? DeepPartial<U>[]
          : T[P] extends object
          ? DeepPartial<T[P]>
          : T[P];
      };
      type Flatten<T> = T extends Array<infer U> ? Flatten<U> : T;
      interface Config {
        network: {
          ports: number[];
        };
      }
      const c: DeepPartial<Config> = { network: { ports: [80, 443] } };
      console.log('CONFIG_PORTS:' + JSON.stringify(c.network.ports));
    `;
    const res = await executeInVirtualRuntime({
      entry: 'types.ts',
      files: { 'types.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('CONFIG_PORTS:[80,443]'));
  });

  // ── Suite 2: Async Iterators & Generators ─────────────────────────────────
  console.log('\n--- Suite 2: Async Iterators & Generators ---');

  await runTest('2.1 Typed async generator function and for-await-of loop', async () => {
    const code = `
      interface Packet { seq: number; payload: string; }
      async function* packetStream<T extends Packet>(count: number): AsyncGenerator<T, void, unknown> {
        for (let i = 1; i <= count; i++) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          yield { seq: i, payload: 'pkt-' + i } as T;
        }
      }
      async function main() {
        const received: number[] = [];
        for await (const pkt of packetStream<Packet>(4)) {
          received.push(pkt.seq);
        }
        console.log('PACKETS:' + received.join(','));
      }
      main();
    `;
    const res = await executeInVirtualRuntime({
      entry: 'async-gen.ts',
      files: { 'async-gen.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('PACKETS:1,2,3,4'));
  });

  await runTest('2.2 Custom Symbol.asyncIterator implementation', async () => {
    const code = `
      const asyncIterable = {
        [Symbol.asyncIterator]() {
          let step = 0;
          return {
            async next() {
              step++;
              if (step <= 3) {
                return { value: step * 100, done: false };
              }
              return { value: undefined, done: true };
            }
          };
        }
      };
      async function run() {
        let sum = 0;
        for await (const val of asyncIterable) {
          sum += val;
        }
        console.log('ASYNC_SUM:' + sum);
      }
      run();
    `;
    const res = await executeInVirtualRuntime({
      entry: 'iterable.ts',
      files: { 'iterable.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('ASYNC_SUM:600'));
  });

  await runTest('2.3 Async generator error propagation & catch block', async () => {
    const code = `
      const assert = require('assert');
      async function* faultyStream() {
        yield 1;
        throw new Error('Stream burst fault');
      }
      async function test() {
        let caught = false;
        try {
          for await (const n of faultyStream()) {
            console.log('GOT:' + n);
          }
        } catch (e) {
          caught = true;
          console.log('CAUGHT_STREAM_ERR:' + e.message);
        }
        assert.ok(caught);
      }
      test();
    `;
    const res = await executeInVirtualRuntime({
      entry: 'fault.ts',
      files: { 'fault.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('CAUGHT_STREAM_ERR:Stream burst fault'));
  });

  // ── Suite 3: Decorators & Advanced Class Features ─────────────────────────
  console.log('\n--- Suite 3: Decorators & Advanced Class Features ---');

  await runTest('3.1 Decorator syntax handled gracefully without host crash', async () => {
    const code = `
      function Logged(target, ctx) { return target; }
      @Logged
      class Service {
        @Logged
        execute() { return 1; }
      }
      new Service().execute();
    `;
    // Transpiler passes through decorator, V8 in new Function handles or errors gracefully
    const res = await executeInVirtualRuntime({
      entry: 'decorator.ts',
      files: { 'decorator.ts': code }
    });
    // Implementation must handle without crashing node process
    assert.ok(typeof res.exitCode === 'number', 'Must return an exit code');
    assert.ok(res.exitCode === 0 || res.exitCode === 1, 'Must be 0 or 1');
    if (res.exitCode === 1) {
      assert.ok(res.stderr.includes('SyntaxError') || res.stderr.includes('Invalid or unexpected token'));
    }
  });

  await runTest('3.2 Derived class constructor parameter properties and super(...) ordering', async () => {
    const code = `
      class Animal {
        constructor(public readonly species: string) {}
      }
      class Dog extends Animal {
        constructor(
          public override readonly species: string,
          public name: string,
          private age: number = 3
        ) {
          super(species);
        }
        getInfo(): string {
          return this.name + ' (' + this.species + ', ' + this.age + 'y)';
        }
      }
      const d = new Dog('Canine', 'Rex', 4);
      console.log('DOG_INFO:' + d.getInfo());
    `;
    const res = await executeInVirtualRuntime({
      entry: 'classes.ts',
      files: { 'classes.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('DOG_INFO:Rex (Canine, 4y)'));
  });

  await runTest('3.3 Private class fields (#field) and static block execution', async () => {
    const code = `
      class Counter {
        #count = 10;
        static #instances = 0;
        static registry = [];
        static {
          this.registry.push('initialized');
        }
        constructor() {
          Counter.#instances++;
        }
        increment() {
          return ++this.#count;
        }
        static getInstanceCount() {
          return Counter.#instances;
        }
      }
      const c = new Counter();
      console.log('COUNTER:' + c.increment() + ', INSTANCES:' + Counter.getInstanceCount() + ', REG:' + Counter.registry[0]);
    `;
    const res = await executeInVirtualRuntime({
      entry: 'counter.ts',
      files: { 'counter.ts': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('COUNTER:11, INSTANCES:1, REG:initialized'));
  });

  // ── Suite 4: Large Memory Allocations & VFS Stress ────────────────────────
  console.log('\n--- Suite 4: Large Memory Allocations & VFS Stress ---');

  await runTest('4.1 16MB Buffer allocation, SHA-256 hash, and VFS file read/write', async () => {
    const code = `
      const assert = require('assert');
      const fs = require('fs');
      const crypto = require('crypto');
      const size = 16 * 1024 * 1024; // 16 MB
      const buf = Buffer.alloc(size, 0x5a);
      assert.strictEqual(buf.length, size);

      const hash1 = crypto.createHash('sha256').update(buf).digest('hex');
      fs.writeFileSync('/workspace/huge.bin', buf);

      const readBack = fs.readFileSync('/workspace/huge.bin');
      const hash2 = crypto.createHash('sha256').update(readBack).digest('hex');
      assert.strictEqual(hash1, hash2);
      console.log('VFS_HUGE_OK:' + (hash1 === hash2));
    `;
    const res = await executeInVirtualRuntime({
      entry: 'huge.js',
      files: { 'huge.js': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('VFS_HUGE_OK:true'));
  });

  await runTest('4.2 100 sequential 64KB buffer allocations and releases', async () => {
    const code = `
      const crypto = require('crypto');
      let combined = 0;
      for (let i = 0; i < 100; i++) {
        const b = Buffer.alloc(64 * 1024, i & 0xff);
        combined += b[0];
      }
      console.log('COMBINED_VAL:' + combined);
    `;
    const res = await executeInVirtualRuntime({
      entry: 'allocs.js',
      files: { 'allocs.js': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('COMBINED_VAL:4950'));
  });

  // ── Suite 5: Runtime Resilience, Limits & Sandbox Isolation ───────────────
  console.log('\n--- Suite 5: Runtime Resilience, Limits & Sandbox Isolation ---');

  await runTest('5.1 Deep recursion caught as RangeError without host crash', async () => {
    const code = `
      function deep(n) {
        return deep(n + 1);
      }
      deep(0);
    `;
    const res = await executeInVirtualRuntime({
      entry: 'rec.js',
      files: { 'rec.js': code }
    });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Maximum call stack size exceeded') || res.stderr.includes('RangeError'));
  });

  await runTest('5.2 Output flood truncation under runaway console calls', async () => {
    const code = `
      for (let i = 0; i < 5000; i++) {
        console.log('FLOOD_LINE_' + i);
      }
    `;
    const res = await executeInVirtualRuntime({
      entry: 'flood.js',
      files: { 'flood.js': code },
      maxOutputBytes: 15000,
      maxConsoleCalls: 300
    });
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(res.outputTruncated, true);
    assert.ok(res.stdout.includes('[Output truncated: exceeded 256 KB limit]') || res.stdout.length <= 20000);
  });

  await runTest('5.3 process.exit(code) semantics with non-zero exit code', async () => {
    const code = `
      console.log('START_EXIT');
      process.exit(77);
      console.log('UNREACHABLE');
    `;
    const res = await executeInVirtualRuntime({
      entry: 'exit.js',
      files: { 'exit.js': code }
    });
    assert.strictEqual(res.exitCode, 77);
    assert.ok(res.stdout.includes('START_EXIT'));
    assert.ok(!res.stdout.includes('UNREACHABLE'));
  });

  await runTest('5.4 Virtual filesystem host isolation (cannot traverse host system)', async () => {
    const code = `
      const assert = require('assert');
      const fs = require('fs');
      assert.strictEqual(fs.existsSync('/etc/passwd'), false);
      assert.strictEqual(fs.existsSync('/Users'), false);
      assert.strictEqual(fs.existsSync('../../package.json'), false);
      console.log('ISOLATION_VERIFIED:true');
    `;
    const res = await executeInVirtualRuntime({
      entry: 'sandbox.js',
      files: { 'sandbox.js': code }
    });
    assert.strictEqual(res.exitCode, 0, `Expected 0: ${res.stderr}`);
    assert.ok(res.stdout.includes('ISOLATION_VERIFIED:true'));
  });

  await runTest('5.5 Active background timer terminates within timeoutMs boundary', async () => {
    const code = `
      // Active background timer that would hang indefinitely without runtime timeout
      setInterval(() => {}, 100);
    `;
    const start = Date.now();
    const res = await executeInVirtualRuntime({
      entry: 'hang.js',
      files: { 'hang.js': code },
      timeoutMs: 400
    });
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 350 && elapsed < 2000, `Expected elapsed around 400ms, got ${elapsed}ms`);
    assert.ok(typeof res.exitCode === 'number');
  });

  console.log('\n======================================================================');
  console.log(`  STRESS & ADVERSARIAL RESULTS: ${passedTests}/${totalTests} passed cleanly`);
  console.log('======================================================================\n');
}

main().catch((err) => {
  console.error('Stress test harness failure:', err);
  process.exit(1);
});
