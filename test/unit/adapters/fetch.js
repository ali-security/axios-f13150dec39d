import assert from 'assert';
import {
  startHTTPServer,
  stopHTTPServer,
  LOCAL_SERVER_URL,
  setTimeoutAsync,
  makeReadableStream,
  generateReadable,
  makeEchoStream,
} from '../../helpers/server.js';
import axios from '../../../index.js';
import utils from '../../../lib/utils.js';
import stream from 'stream';
import { AbortController } from 'abortcontroller-polyfill/dist/cjs-ponyfill.js';
import util from 'util';

const pipelineAsync = util.promisify(stream.pipeline);

const fetchAxios = axios.create({
  baseURL: LOCAL_SERVER_URL,
  adapter: 'fetch',
});

let server;

describe('supports fetch with nodejs', function () {
  before(function () {
    if (typeof fetch !== 'function') {
      this.skip();
    }
  });

  afterEach(async function () {
    await stopHTTPServer(server);

    server = null;
  });

  describe('responses', async () => {
    it('should sanitize request headers containing CRLF characters', async function () {
    this.timeout(10000);
    server = await startHTTPServer(
      (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ xTest: req.headers['x-test'], injected: req.headers.injected ?? null }));
      }
    );
    try {
      const { data } = await fetchAxios.get(LOCAL_SERVER_URL + '/', {
        headers: { 'x-test': '\tok\r\nInjected: yes ' },
      });
      assert.strictEqual(data.xTest, 'okInjected: yes');
      assert.strictEqual(data.injected, null);
    } finally {
      await stopHTTPServer(server);
    }
  });

  it(`should support text response type`, async () => {
      const originalData = 'my data';

      server = await startHTTPServer((req, res) => res.end(originalData));

      const { data } = await fetchAxios.get('/', {
        responseType: 'text',
      });

      assert.deepStrictEqual(data, originalData);
    });

    it(`should support arraybuffer response type`, async () => {
      const originalData = 'my data';

      server = await startHTTPServer((req, res) => res.end(originalData));

      const { data } = await fetchAxios.get('/', {
        responseType: 'arraybuffer',
      });

      assert.deepStrictEqual(
        data,
        Uint8Array.from(await new TextEncoder().encode(originalData)).buffer
      );
    });

    it(`should support blob response type`, async () => {
      const originalData = 'my data';

      server = await startHTTPServer((req, res) => res.end(originalData));

      const { data } = await fetchAxios.get('/', {
        responseType: 'blob',
      });

      assert.deepStrictEqual(data, new Blob([originalData]));
    });

    it(`should support stream response type`, async () => {
      const originalData = 'my data';

      server = await startHTTPServer((req, res) => res.end(originalData));

      const { data } = await fetchAxios.get('/', {
        responseType: 'stream',
      });

      assert.ok(data instanceof ReadableStream, 'data is not instanceof ReadableStream');

      let response = new Response(data);

      assert.deepStrictEqual(await response.text(), originalData);
    });

    it(`should support formData response type`, async function () {
      this.timeout(5000);

      const originalData = new FormData();

      originalData.append('x', '123');

      server = await startHTTPServer(async (req, res) => {
        const response = await new Response(originalData);

        res.setHeader('Content-Type', response.headers.get('Content-Type'));

        res.end(await response.text());
      });

      const { data } = await fetchAxios.get('/', {
        responseType: 'formdata',
      });

      assert.ok(data instanceof FormData, 'data is not instanceof FormData');

      assert.deepStrictEqual(
        Object.fromEntries(data.entries()),
        Object.fromEntries(originalData.entries())
      );
    });

    it(`should support json response type`, async () => {
      const originalData = { x: 'my data' };

      server = await startHTTPServer((req, res) => res.end(JSON.stringify(originalData)));

      const { data } = await fetchAxios.get('/', {
        responseType: 'json',
      });

      assert.deepStrictEqual(data, originalData);
    });
  });

  describe('progress', () => {
    describe('upload', function () {
      it('should support upload progress capturing', async function () {
        this.timeout(15000);

        server = await startHTTPServer({
          rate: 100 * 1024,
        });

        let content = '';
        const count = 10;
        const chunk = 'test';
        const chunkLength = Buffer.byteLength(chunk);
        const contentLength = count * chunkLength;

        const readable = stream.Readable.from(
          (async function* () {
            let i = count;

            while (i-- > 0) {
              await setTimeoutAsync(1100);
              content += chunk;
              yield chunk;
            }
          })()
        );

        const samples = [];

        const { data } = await fetchAxios.post('/', readable, {
          onUploadProgress: ({ loaded, total, progress, bytes, upload }) => {
            console.log(
              `Upload Progress ${loaded} from ${total} bytes (${(progress * 100).toFixed(1)}%)`
            );

            samples.push({
              loaded,
              total,
              progress,
              bytes,
              upload,
            });
          },
          headers: {
            'Content-Length': contentLength,
          },
          responseType: 'text',
        });

        await setTimeoutAsync(500);

        assert.strictEqual(data, content);

        assert.deepStrictEqual(
          samples,
          Array.from(
            (function* () {
              for (let i = 1; i <= 10; i++) {
                yield {
                  loaded: chunkLength * i,
                  total: contentLength,
                  progress: (chunkLength * i) / contentLength,
                  bytes: 4,
                  upload: true,
                };
              }
            })()
          )
        );
      });

      it('should not fail with get method', async () => {
        server = await startHTTPServer((req, res) => res.end('OK'));

        const { data } = await fetchAxios.get('/', {
          onUploadProgress() {},
        });

        assert.strictEqual(data, 'OK');
      });
    });

    describe('download', function () {
      it('should support download progress capturing', async function () {
        this.timeout(15000);

        server = await startHTTPServer({
          rate: 100 * 1024,
        });

        let content = '';
        const count = 10;
        const chunk = 'test';
        const chunkLength = Buffer.byteLength(chunk);
        const contentLength = count * chunkLength;

        const readable = stream.Readable.from(
          (async function* () {
            let i = count;

            while (i-- > 0) {
              await setTimeoutAsync(1100);
              content += chunk;
              yield chunk;
            }
          })()
        );

        const samples = [];

        const { data } = await fetchAxios.post('/', readable, {
          onDownloadProgress: ({ loaded, total, progress, bytes, download }) => {
            console.log(
              `Download Progress ${loaded} from ${total} bytes (${(progress * 100).toFixed(1)}%)`
            );

            samples.push({
              loaded,
              total,
              progress,
              bytes,
              download,
            });
          },
          headers: {
            'Content-Length': contentLength,
          },
          responseType: 'text',
          maxRedirects: 0,
        });

        await setTimeoutAsync(500);

        assert.strictEqual(data, content);

        assert.deepStrictEqual(
          samples,
          Array.from(
            (function* () {
              for (let i = 1; i <= 10; i++) {
                yield {
                  loaded: chunkLength * i,
                  total: contentLength,
                  progress: (chunkLength * i) / contentLength,
                  bytes: 4,
                  download: true,
                };
              }
            })()
          )
        );
      });
    });
  });

  it('should support basic auth', async () => {
    server = await startHTTPServer((req, res) => res.end(req.headers.authorization));

    const user = 'foo';
    const headers = { Authorization: 'Bearer 1234' };
    const res = await axios.get('http://' + user + '@localhost:4444/', { headers: headers });

    const base64 = Buffer.from(user + ':', 'utf8').toString('base64');
    assert.equal(res.data, 'Basic ' + base64);
  });

  it('should support stream.Readable as a payload', async () => {
    server = await startHTTPServer();

    const { data } = await fetchAxios.post('/', stream.Readable.from('OK'));

    assert.strictEqual(data, 'OK');
  });

  it('should pass a fully resolved Request and safe options to a custom fetch implementation', async () => {
    let captured;
    const fetchOptions = Object.create({
      headers: {
        'X-Injected': 'yes',
      },
    });
    fetchOptions.cache = 'no-store';
    fetchOptions.redirect = 'error';
    fetchOptions.customOption = 'custom-value';
    fetchOptions.credentials = 'omit';
    fetchOptions.duplex = 'full';

    const customFetch = function (input, init) {
      captured = {
        input,
        init,
        argumentCount: arguments.length,
      };
      return Promise.resolve(new Response('ok'));
    };

    const response = await fetchAxios.get('/custom-fetch', {
      headers: {
        'X-Safe': 'value',
      },
      withCredentials: true,
      fetchOptions,
      env: {
        fetch: customFetch,
      },
    });

    assert.strictEqual(response.data, 'ok');
    assert.ok(captured.input instanceof Request);
    assert.strictEqual(captured.input.headers.get('X-Safe'), 'value');
    assert.strictEqual(captured.input.headers.get('X-Injected'), null);
    assert.strictEqual(captured.input.cache, 'no-store');
    assert.strictEqual(captured.input.redirect, 'error');
    assert.strictEqual(captured.input.credentials, 'include');
    if ('duplex' in Request.prototype) {
      assert.strictEqual(captured.input.duplex, 'half');
    }
    assert.strictEqual(Object.getPrototypeOf(captured.init), null);
    assert.strictEqual(captured.init.cache, 'no-store');
    assert.strictEqual(captured.init.redirect, 'error');
    assert.strictEqual(captured.init.customOption, 'custom-value');
    assert.strictEqual(captured.init.body, undefined);
    assert.strictEqual(captured.init.headers, undefined);
    assert.strictEqual(captured.init.method, undefined);
    assert.strictEqual(captured.init.signal, undefined);
    assert.strictEqual(captured.init.credentials, undefined);
    assert.strictEqual(captured.init.duplex, undefined);
    assert.strictEqual(captured.argumentCount, 2);
  });

  it('should ignore Request options inherited only from Object.prototype', async () => {
    let captured;

    Object.prototype.cache = 'no-store';
    Object.prototype.redirect = 'manual';

    try {
      const response = await fetchAxios.get('/safe-request-options', {
        env: {
          fetch(input) {
            captured = input;
            return Promise.resolve(new Response('ok'));
          },
        },
      });

      assert.strictEqual(response.data, 'ok');
      assert.ok(captured instanceof Request);
      assert.strictEqual(captured.cache, 'default');
      assert.strictEqual(captured.redirect, 'follow');
    } finally {
      delete Object.prototype.cache;
      delete Object.prototype.redirect;
    }
  });

  it('should not follow redirects through a custom fetch when maxRedirects is zero', async () => {
    let captured;

    const response = await fetchAxios.get('/start', {
      maxRedirects: 0,
      fetchOptions: {
        redirect: 'follow',
      },
      env: {
        fetch(input, init) {
          captured = { input, init };
          return Promise.resolve(new Response('ok'));
        },
      },
    });

    assert.strictEqual(response.data, 'ok');
    assert.strictEqual(captured.input.redirect, 'manual');
    assert.strictEqual(captured.init.redirect, 'manual');
  });

  it('should expose an unfollowed redirect response in Node when maxRedirects is zero', async () => {
    let finalRequests = 0;

    server = await startHTTPServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { Location: '/final' });
        res.end();
        return;
      }

      finalRequests++;
      res.end('followed');
    });

    const response = await fetchAxios.get('/start', {
      maxRedirects: 0,
      validateStatus: () => true,
    });

    // Node exposes manual redirect responses; browsers return an opaque
    // redirect whose status and headers cannot be inspected.
    assert.strictEqual(response.status, 302);
    assert.strictEqual(finalRequests, 0);
  });

  it('should still follow redirects when maxRedirects is not zero', async () => {
    server = await startHTTPServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { Location: '/final' });
        res.end();
        return;
      }

      res.end('followed');
    });

    const response = await fetchAxios.get('/start', {
      maxRedirects: 5,
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data, 'followed');
  });

  describe('request aborting', function () {
    it('should be able to abort the request stream', async function () {
      server = await startHTTPServer({
        rate: 100000,
        useBuffering: true,
      });

      const controller = new AbortController();

      setTimeout(() => {
        controller.abort();
      }, 500);

      await assert.rejects(async () => {
        await fetchAxios.post('/', makeReadableStream(), {
          responseType: 'stream',
          signal: controller.signal,
        });
      }, /CanceledError/);
    });

    it('should be able to abort the response stream', async function () {
      server = await startHTTPServer((req, res) => {
        pipelineAsync(generateReadable(10000, 10), res);
      });

      const controller = new AbortController();

      setTimeout(() => {
        controller.abort(new Error('test'));
      }, 800);

      const { data } = await fetchAxios.get('/', {
        responseType: 'stream',
        signal: controller.signal,
      });

      await assert.rejects(async () => {
        await data.pipeTo(makeEchoStream());
      }, /^(AbortError|CanceledError):/);
    });
  });

  it('should support a timeout', async () => {
    server = await startHTTPServer(async (req, res) => {
      await setTimeoutAsync(1000);
      res.end('OK');
    });

    const timeout = 500;

    const ts = Date.now();

    await assert.rejects(async () => {
      await fetchAxios('/', {
        timeout,
      });
    }, /timeout/);

    const passed = Date.now() - ts;

    assert.ok(passed >= timeout - 5, `early cancellation detected (${passed} ms)`);
  });

  it('should combine baseURL and url', async () => {
    server = await startHTTPServer();

    const res = await fetchAxios('/foo');

    assert.equal(res.config.baseURL, LOCAL_SERVER_URL);
    assert.equal(res.config.url, '/foo');
  });

  it('should support params', async () => {
    server = await startHTTPServer((req, res) => res.end(req.url));

    const { data } = await fetchAxios.get('/?test=1', {
      params: {
        foo: 1,
        bar: 2,
      },
    });

    assert.strictEqual(data, '/?test=1&foo=1&bar=2');
  });

  it('should handle fetch failed error as an AxiosError with ERR_NETWORK code', async () => {
    try {
      await fetchAxios('http://notExistsUrl.in.nowhere');
      assert.fail('should fail');
    } catch (err) {
      assert.strictEqual(String(err), 'AxiosError: Network Error');
      assert.strictEqual(err.cause && err.cause.code, 'ENOTFOUND');
    }
  });

  it('should get response headers', async () => {
    server = await startHTTPServer((req, res) => {
      res.setHeader('foo', 'bar');
      res.end(req.url);
    });

    const { headers } = await fetchAxios.get('/', {
      responseType: 'stream',
    });

    assert.strictEqual(headers.get('foo'), 'bar');
  });

  describe('fetch adapter - Content-Type handling', function () {
    it('should set correct Content-Type for FormData automatically', async function () {
      const FormData = (await import('form-data')).default; // Node FormData
      const form = new FormData();
      form.append('foo', 'bar');

      server = await startHTTPServer((req, res) => {
        const contentType = req.headers['content-type'];
        assert.match(contentType, /^multipart\/form-data; boundary=/i);
        res.end('OK');
      });

      await fetchAxios.post('/form', form);
    });
  });

  describe('env config', () => {
    it('should respect env fetch API configuration', async () => {
      const { data, headers } = await fetchAxios.get('/', {
        env: {
          fetch() {
            return {
              headers: {
                foo: '1',
              },
              text: async () => 'test',
            };
          },
        },
      });

      assert.strictEqual(headers.get('foo'), '1');
      assert.strictEqual(data, 'test');
    });

    it('should be able to request with lack of Request object', async () => {
      const form = new FormData();

      form.append('x', '1');

      const { data, headers } = await fetchAxios.post('/', form, {
        onUploadProgress() {
          // dummy listener to activate streaming
        },
        env: {
          Request: null,
          fetch() {
            return {
              headers: {
                foo: '1',
              },
              text: async () => 'test',
            };
          },
        },
      });

      assert.strictEqual(headers.get('foo'), '1');
      assert.strictEqual(data, 'test');
    });

    it('should pass safe options when the Request object is unavailable', async () => {
      let captured;

      Object.prototype.cache = 'no-store';
      Object.prototype.redirect = 'manual';

      try {
        const { data } = await fetchAxios.get('/', {
          env: {
            Request: null,
            fetch(_url, init) {
              captured = init;
              return {
                headers: {},
                text: async () => 'test',
              };
            },
          },
        });

        assert.strictEqual(data, 'test');
        assert.strictEqual(Object.getPrototypeOf(captured), null);
        assert.strictEqual(captured.cache, undefined);
        assert.strictEqual(captured.redirect, undefined);
      } finally {
        delete Object.prototype.cache;
        delete Object.prototype.redirect;
      }
    });

    it('should pass manual redirect mode when the Request object is unavailable and maxRedirects is zero', async () => {
      let captured;

      const { data } = await fetchAxios.get('/', {
        maxRedirects: 0,
        env: {
          Request: null,
          fetch(_url, init) {
            captured = init;
            return {
              headers: {},
              text: async () => 'test',
            };
          },
        },
      });

      assert.strictEqual(data, 'test');
      assert.strictEqual(captured.redirect, 'manual');
    });

    it('should be able to handle response with lack of Response object', async () => {
      const { data, headers } = await fetchAxios.get('/', {
        onDownloadProgress() {
          // dummy listener to activate streaming
        },
        env: {
          Request: null,
          Response: null,
          fetch() {
            return {
              headers: {
                foo: '1',
              },
              text: async () => 'test',
            };
          },
        },
      });

      assert.strictEqual(headers.get('foo'), '1');
      assert.strictEqual(data, 'test');
    });

    it('should fallback to the global on undefined env value', async () => {
      server = await startHTTPServer((req, res) => res.end('OK'));

      const { data } = await fetchAxios.get('/', {
        env: {
          fetch: undefined,
        },
      });

      assert.strictEqual(data, 'OK');
    });

    it('should use current global fetch when env fetch is not specified', async () => {
      const globalFetch = fetch;

      fetch = async () => {
        return {
          headers: {
            foo: '1',
          },
          text: async () => 'global',
        };
      };

      try {
        server = await startHTTPServer((req, res) => res.end('OK'));

        const { data } = await fetchAxios.get('/', {
          env: {
            fetch: undefined,
          },
        });

        assert.strictEqual(data, 'global');
      } finally {
        fetch = globalFetch;
      }
    });
  });
 
  describe('size limits (GHSA-777c-7fjr-54vf)', () => {
    it('should reject an outbound body that exceeds maxBodyLength with ERR_BAD_REQUEST', async () => {
      const server = await startHTTPServer(
        (req, res) => {
          res.end('ok');
        },
        { port: 4444 }
      );

      try {
        await assert.rejects(
          fetchAxios.post(`${LOCAL_SERVER_URL}/`, 'A'.repeat(2048), {
            maxBodyLength: 1024,
          }),
          (err) => {
            assert.strictEqual(err.code, 'ERR_BAD_REQUEST');
            assert.match(err.message, /Request body larger than maxBodyLength limit/);
            return true;
          }
        );
      } finally {
        await stopHTTPServer(server);
      }
    });

    const makeUploadStream = (totalBytes, chunkSize = 512) => {
      let remaining = totalBytes;

      return new ReadableStream({
        pull(controller) {
          if (remaining <= 0) {
            controller.close();
            return;
          }

          const size = Math.min(chunkSize, remaining);
          remaining -= size;
          controller.enqueue(new Uint8Array(size));
        },
      });
    };

    it('should reject a streamed outbound body that exceeds maxBodyLength during upload', async () => {
      let bytesReceived = 0;
      const server = await startHTTPServer(
        (req, res) => {
          req.on('data', (chunk) => {
            bytesReceived += chunk.length;
          });
          req.on('error', () => {});
          req.on('end', () => {
            res.end('ok');
          });
        },
        { port: 4444 }
      );

      try {
        await assert.rejects(
          fetchAxios.post(`${LOCAL_SERVER_URL}/`, makeUploadStream(2048), {
            maxBodyLength: 1024,
            headers: { 'Content-Type': 'application/octet-stream' },
          }),
          (err) => {
            assert.strictEqual(err.code, 'ERR_BAD_REQUEST');
            assert.strictEqual(err.message, 'Request body larger than maxBodyLength limit');
            return true;
          }
        );

        assert.ok(
          bytesReceived <= 1024,
          `server should not receive more than maxBodyLength; got ${bytesReceived}`
        );
      } finally {
        await stopHTTPServer(server);
      }
    });

    it('should enforce maxBodyLength on a stream even when a smaller Content-Length is declared', async () => {
      let bytesRead = 0;

      await assert.rejects(
        // A caller-declared Content-Length that under-reports the real body
        // must not let an oversized stream slip past the limit.
        fetchAxios.post('/', makeUploadStream(8192), {
          maxBodyLength: 1024,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': '500',
          },
          env: {
            async fetch(request) {
              for await (const chunk of request.body) {
                bytesRead += chunk.byteLength;
              }
              return new Response('ok');
            },
          },
        }),
        (err) => {
          assert.strictEqual(err.code, 'ERR_BAD_REQUEST');
          assert.strictEqual(err.message, 'Request body larger than maxBodyLength limit');
          return true;
        }
      );

      assert.ok(bytesRead <= 1024, `fetch read more than maxBodyLength; got ${bytesRead}`);
    });

    it('should enforce maxBodyLength with custom fetch when Request is unavailable', async () => {
      let bytesRead = 0;

      await assert.rejects(
        fetchAxios.post('/', makeUploadStream(2048), {
          maxBodyLength: 1024,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': '1',
          },
          env: {
            Request: null,
            async fetch(_url, options) {
              for await (const chunk of options.body) {
                bytesRead += chunk.byteLength;
              }
              return {
                headers: {},
                status: 200,
                statusText: 'OK',
                text: async () => 'ok',
              };
            },
          },
        }),
        (err) => {
          assert.strictEqual(err.code, 'ERR_BAD_REQUEST');
          assert.strictEqual(err.message, 'Request body larger than maxBodyLength limit');
          return true;
        }
      );

      assert.ok(bytesRead <= 1024, `custom fetch read too many bytes; got ${bytesRead}`);
    });

    it('should not force ReadableStream bodies when Request does not support request streams', async () => {
      let fetchCalled = false;

      class NoStreamRequest {
        constructor(_url, init) {
          if (init && utils.isReadableStream(init.body)) {
            throw new TypeError('ReadableStream request bodies are unsupported');
          }
        }
      }

      await assert.rejects(
        fetchAxios.post('/', stream.Readable.from([Buffer.alloc(2048)]), {
          maxBodyLength: 1024,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          env: {
            Request: NoStreamRequest,
            Response: null,
            async fetch() {
              fetchCalled = true;
              return {
                headers: {},
                status: 200,
                statusText: 'OK',
                text: async () => 'ok',
              };
            },
          },
        }),
        (err) => {
          assert.strictEqual(err.code, 'ERR_NOT_SUPPORT');
          assert.strictEqual(
            err.message,
            'Stream request bodies are not supported by the current fetch implementation'
          );
          return true;
        }
      );

      assert.strictEqual(fetchCalled, false, 'fetch must not receive a forced ReadableStream body');
    });

    it('should reject a response whose Content-Length exceeds maxContentLength with ERR_BAD_RESPONSE', async () => {
      const payload = 'A'.repeat(8 * 1024);
      const server = await startHTTPServer(
        (req, res) => {
          res.setHeader('Content-Length', Buffer.byteLength(payload));
          res.end(payload);
        },
        { port: 4444 }
      );

      try {
        await assert.rejects(
          fetchAxios.get(`${LOCAL_SERVER_URL}/`, {
            maxContentLength: 1024,
          }),
          (err) => {
            assert.strictEqual(err.code, 'ERR_BAD_RESPONSE');
            assert.match(err.message, /maxContentLength size of 1024 exceeded/);
            return true;
          }
        );
      } finally {
        await stopHTTPServer(server);
      }
    });

    it('should handle plain object response headers while enforcing maxContentLength', async () => {
      const { data, headers } = await fetchAxios.get('/', {
        maxContentLength: 10,
        env: {
          async fetch() {
            return {
              status: 200,
              statusText: 'OK',
              headers: {
                'content-length': '4',
                foo: 'bar',
              },
              body: new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array([116, 101, 115, 116]));
                  controller.close();
                },
              }),
            };
          },
        },
      });

      assert.strictEqual(data, 'test');
      assert.strictEqual(headers.get('foo'), 'bar');
    });

    it('should reject a chunked response that exceeds maxContentLength during streaming', async () => {
      const server = await startHTTPServer(
        (req, res) => {
          // Omit content-length so the cheap pre-check cannot fire; force
          // the stream-based enforcement path.
          res.setHeader('Transfer-Encoding', 'chunked');
          const chunk = 'B'.repeat(1024);
          let sent = 0;
          const writeNext = () => {
            if (sent >= 8) {
              return res.end();
            }
            sent++;
            res.write(chunk, writeNext);
          };
          writeNext();
        },
        { port: 4444 }
      );

      try {
        await assert.rejects(
          fetchAxios.get(`${LOCAL_SERVER_URL}/`, {
            maxContentLength: 512,
          }),
          (err) => {
            assert.strictEqual(err.code, 'ERR_BAD_RESPONSE');
            assert.match(err.message, /maxContentLength size of 512 exceeded/);
            return true;
          }
        );
      } finally {
        await stopHTTPServer(server);
      }
    });

    it('should reject a data: URL whose decoded size exceeds maxContentLength (base64)', async () => {
      const payload = 'A'.repeat(4096);
      const dataUrl = 'data:application/octet-stream;base64,' + Buffer.from(payload).toString('base64');

      // Use a dedicated instance without baseURL — combineURLs would otherwise
      // prepend baseURL to a data: URL and neutralise the pre-check.
      const bareAxios = axios.create({ adapter: 'fetch' });

      await assert.rejects(
        bareAxios.get(dataUrl, { maxContentLength: 16 }),
        (err) => {
          assert.strictEqual(err.code, 'ERR_BAD_RESPONSE');
          assert.match(err.message, /maxContentLength size of 16 exceeded/);
          return true;
        }
      );
    });

    it('should reject a data: URL whose body size exceeds maxContentLength (non-base64)', async () => {
      const dataUrl = 'data:text/plain,' + 'X'.repeat(4096);

      const bareAxios = axios.create({ adapter: 'fetch' });

      await assert.rejects(
        bareAxios.get(dataUrl, { maxContentLength: 16 }),
        (err) => {
          assert.strictEqual(err.code, 'ERR_BAD_RESPONSE');
          assert.match(err.message, /maxContentLength size of 16 exceeded/);
          return true;
        }
      );
    });

    it('should allow a percent-encoded data: URL within decoded maxContentLength', async () => {
      const bareAxios = axios.create({ adapter: 'fetch' });
      const { data } = await bareAxios.get('data:text/plain,%E2%82%AC', {
        maxContentLength: 4,
      });

      assert.strictEqual(data, '\u20ac');
    });

    it('should allow a response at or below maxContentLength', async () => {
      const payload = 'ok';
      const server = await startHTTPServer(
        (req, res) => {
          res.end(payload);
        },
        { port: 4444 }
      );

      try {
        const { data } = await fetchAxios.get(`${LOCAL_SERVER_URL}/`, {
          maxContentLength: 1024,
        });
        assert.strictEqual(data, payload);
      } finally {
        await stopHTTPServer(server);
      }
    });

    it('should allow a streamed outbound body at or below maxBodyLength', async () => {
      const payloadLength = 1024;
      let bytesReceived = 0;
      const server = await startHTTPServer(
        (req, res) => {
          req.on('data', (chunk) => {
            bytesReceived += chunk.length;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ received: bytesReceived }));
          });
        },
        { port: 4444 }
      );

      try {
        const { data } = await fetchAxios.post(
          `${LOCAL_SERVER_URL}/`,
          makeUploadStream(payloadLength),
          {
            maxBodyLength: 1024,
            headers: { 'Content-Type': 'application/octet-stream' },
          }
        );

        assert.strictEqual(data.received, payloadLength);
      } finally {
        await stopHTTPServer(server);
      }
    });

    it('should allow a body at or below maxBodyLength', async () => {
      const payload = 'hello';
      let received;
      const server = await startHTTPServer(
        (req, res) => {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            received = Buffer.concat(chunks).toString();
            res.end('ok');
          });
        },
        { port: 4444 }
      );

      try {
        await fetchAxios.post(`${LOCAL_SERVER_URL}/`, payload, {
          maxBodyLength: 1024,
        });
        assert.strictEqual(received, payload);
      } finally {
        await stopHTTPServer(server);
      }
    });
  });
});
