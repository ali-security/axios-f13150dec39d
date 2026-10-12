'use strict';

import assert from 'assert';
import http from 'http';
import axios from '../../../index.js';
import utils from '../../../lib/utils.js';
import mergeConfig from '../../../lib/core/mergeConfig.js';
import defaults from '../../../lib/defaults/index.js';
import AxiosHeaders from '../../../lib/core/AxiosHeaders.js';
import AxiosError from '../../../lib/core/AxiosError.js';
import httpAdapter from '../../../lib/adapters/http.js';
import buildURL from '../../../lib/helpers/buildURL.js';
import resolveConfig from '../../../lib/helpers/resolveConfig.js';
import stream from 'stream';
import vm from 'vm';
import { EventEmitter } from 'events';

describe('Prototype Pollution Protection', function () {
  afterEach(function () {
    // Clean up any pollution that might have occurred
    delete Object.prototype.polluted;
    delete Object.prototype.transport;
    delete Object.prototype.transformRequest;
    delete Object.prototype.transformResponse;
    delete Object.prototype.formSerializer;
    delete Object.prototype.env;
    delete Object.prototype.parseReviver;
    delete Object.prototype.headers;
    delete Object.prototype.responseType;
    delete Object.prototype.transitional;
    delete Object.prototype.httpVersion;
    delete Object.prototype.validateStatus;
    delete Object.prototype.auth;
    delete Object.prototype.baseURL;
    delete Object.prototype.socketPath;
    delete Object.prototype.beforeRedirect;
    delete Object.prototype.insecureHTTPParser;
    delete Object.prototype.adapter;
    delete Object.prototype.httpAgent;
    delete Object.prototype.httpsAgent;
    delete Object.prototype.proxy;
    delete Object.prototype.maxContentLength;
    delete Object.prototype.maxBodyLength;
    delete Object.prototype.maxRedirects;
    delete Object.prototype.maxRate;
    delete Object.prototype.timeout;
    delete Object.prototype.timeoutErrorMessage;
    delete Object.prototype.cancelToken;
    delete Object.prototype.signal;
    delete Object.prototype.decompress;
    delete Object.prototype.params;
    delete Object.prototype.paramsSerializer;
    delete Object.prototype.method;
    delete Object.prototype.withCredentials;
    delete Object.prototype.fetchOptions;
    delete Object.prototype.username;
    delete Object.prototype.password;
    delete Object.prototype.hostname;
    delete Object.prototype.host;
    delete Object.prototype.port;
    delete Object.prototype.protocol;
    delete Object.prototype.get;
    delete Object.prototype.set;
    delete Object.prototype.createConnection;
    delete Object.prototype.customNested;
    delete Object.prototype.data;
    delete Object.prototype.serialize;
    delete Object.prototype.encode;
    delete Object.prototype.Authorization;
    delete Object.prototype[Symbol.iterator];
    delete Object.prototype[Symbol.toStringTag];
  });

  describe('utils.merge', function () {
    it('should filter __proto__ key at top level', function () {
      const result = utils.merge({}, { __proto__: { polluted: 'yes' }, safe: 'value' });

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.safe, 'value');
      assert.strictEqual(result.hasOwnProperty('__proto__'), false);
    });

    it('should filter constructor key at top level', function () {
      const result = utils.merge({}, { constructor: { polluted: 'yes' }, safe: 'value' });

      assert.strictEqual(result.safe, 'value');
      assert.strictEqual(result.hasOwnProperty('constructor'), false);
    });

    it('should filter prototype key at top level', function () {
      const result = utils.merge({}, { prototype: { polluted: 'yes' }, safe: 'value' });

      assert.strictEqual(result.safe, 'value');
      assert.strictEqual(result.hasOwnProperty('prototype'), false);
    });

    it('should filter __proto__ key in nested objects', function () {
      const result = utils.merge(
        {},
        {
          headers: {
            __proto__: { polluted: 'nested' },
            'Content-Type': 'application/json',
          },
        }
      );

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.headers['Content-Type'], 'application/json');
      assert.strictEqual(result.headers.hasOwnProperty('__proto__'), false);
    });

    it('should filter constructor key in nested objects', function () {
      const result = utils.merge(
        {},
        {
          headers: {
            constructor: { prototype: { polluted: 'nested' } },
            'Content-Type': 'application/json',
          },
        }
      );

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.headers['Content-Type'], 'application/json');
      assert.strictEqual(result.headers.hasOwnProperty('constructor'), false);
    });

    it('should filter prototype key in nested objects', function () {
      const result = utils.merge(
        {},
        {
          headers: {
            prototype: { polluted: 'nested' },
            'Content-Type': 'application/json',
          },
        }
      );

      assert.strictEqual(result.headers['Content-Type'], 'application/json');
      assert.strictEqual(result.headers.hasOwnProperty('prototype'), false);
    });

    it('should filter dangerous keys in deeply nested objects', function () {
      const result = utils.merge(
        {},
        {
          level1: {
            level2: {
              __proto__: { polluted: 'deep' },
              prototype: { polluted: 'deep' },
              safe: 'value',
            },
          },
        }
      );

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.level1.level2.safe, 'value');
      assert.strictEqual(result.level1.level2.hasOwnProperty('__proto__'), false);
    });

    it('should still merge regular properties correctly', function () {
      const result = utils.merge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 });

      assert.strictEqual(result.a, 1);
      assert.strictEqual(result.b.c, 2);
      assert.strictEqual(result.b.d, 3);
      assert.strictEqual(result.e, 4);
    });

    it('should handle JSON.parse payloads safely', function () {
      const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}}');
      const result = utils.merge({}, malicious);

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.hasOwnProperty('__proto__'), false);
    });

    it('should handle nested JSON.parse payloads safely', function () {
      const malicious = JSON.parse(
        '{"headers": {"constructor": {"prototype": {"polluted": "yes"}}}}'
      );
      const result = utils.merge({}, malicious);

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.headers.hasOwnProperty('constructor'), false);
    });
  });

  describe('mergeConfig', function () {
    it('should filter dangerous keys at top level', function () {
      const result = mergeConfig(
        {},
        {
          __proto__: { polluted: 'yes' },
          constructor: { polluted: 'yes' },
          prototype: { polluted: 'yes' },
          url: '/api/test',
        }
      );

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.url, '/api/test');
      assert.strictEqual(result.hasOwnProperty('__proto__'), false);
      assert.strictEqual(result.hasOwnProperty('constructor'), false);
      assert.strictEqual(result.hasOwnProperty('prototype'), false);
    });

    it('should filter dangerous keys in headers', function () {
      const result = mergeConfig(
        {},
        {
          headers: {
            __proto__: { polluted: 'yes' },
            'Content-Type': 'application/json',
          },
        }
      );

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.headers['Content-Type'], 'application/json');
      assert.strictEqual(result.headers.hasOwnProperty('__proto__'), false);
    });

    it('should filter dangerous keys in custom config properties', function () {
      const result = mergeConfig(
        {},
        {
          customProp: {
            __proto__: { polluted: 'yes' },
            safe: 'value',
          },
        }
      );

      assert.strictEqual(Object.prototype.polluted, undefined);
      assert.strictEqual(result.customProp.safe, 'value');
      assert.strictEqual(result.customProp.hasOwnProperty('__proto__'), false);
    });

    it('should not inherit transport from Object.prototype', function () {
      Object.prototype.transport = { request: function () {} };
      const result = mergeConfig({}, { url: '/a' });
      assert.strictEqual(result.hasOwnProperty('transport'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'transport'), false);
    });

    it('should not inherit transformRequest from Object.prototype', function () {
      Object.prototype.transformRequest = function () {
        return 'hijacked';
      };
      const result = mergeConfig({}, { url: '/a' });
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'transformRequest'), false);
    });

    it('should not inherit transformResponse from Object.prototype', function () {
      Object.prototype.transformResponse = function () {
        return 'hijacked';
      };
      const result = mergeConfig({}, { url: '/a' });
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'transformResponse'), false);
    });

    it('should not inherit arbitrary keys from Object.prototype', function () {
      Object.prototype.polluted = 'yes';
      const result = mergeConfig({}, { url: '/a' });
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'polluted'), false);
    });

    it('should not let a polluted transformRequest replace the default one', function () {
      const safeTransform = function safeTransform(data) {
        return data;
      };
      const hijack = function hijack() {
        return 'hijacked';
      };
      Object.prototype.transformRequest = [hijack];

      // config2 (the per-request config) has no own transformRequest
      const result = mergeConfig({ transformRequest: [safeTransform] }, { url: '/a' });

      assert.ok(Array.isArray(result.transformRequest));
      assert.strictEqual(result.transformRequest.length, 1);
      assert.strictEqual(result.transformRequest[0], safeTransform);
      assert.notStrictEqual(result.transformRequest[0], hijack);
    });

    it('should not let a polluted transformResponse replace the default one', function () {
      const safeTransform = function safeTransform(data) {
        return data;
      };
      const hijack = function hijack() {
        return 'hijacked';
      };
      Object.prototype.transformResponse = [hijack];

      const result = mergeConfig({ transformResponse: [safeTransform] }, { url: '/a' });

      assert.ok(Array.isArray(result.transformResponse));
      assert.strictEqual(result.transformResponse.length, 1);
      assert.strictEqual(result.transformResponse[0], safeTransform);
      assert.notStrictEqual(result.transformResponse[0], hijack);
    });

    it('should not copy a polluted transport from the config that lacks it', function () {
      const evilTransport = { request: function () {} };
      Object.prototype.transport = evilTransport;

      // the key is own (but undefined) on config2, config1 only inherits it
      const result = mergeConfig({}, { url: '/a', transport: undefined });

      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'transport'), false);
    });

    it('should not let a polluted transport override an own transport', function () {
      const safeRequest = function safeRequest() {};
      const evilRequest = function evilRequest() {};
      Object.prototype.transport = { request: evilRequest };

      const result = mergeConfig({ transport: { request: safeRequest } }, { url: '/a' });

      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'transport'), true);
      assert.strictEqual(result.transport.request, safeRequest);
      assert.notStrictEqual(result.transport.request, evilRequest);
    });

    it('should not merge polluted headers into own headers', function () {
      Object.prototype.headers = { 'X-Injected': 'evil', Authorization: 'Bearer attacker' };

      const result = mergeConfig(
        { headers: { common: { Accept: 'application/json' } } },
        { url: '/a' }
      );

      assert.strictEqual(result.headers.common.Accept, 'application/json');
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result.headers, 'X-Injected'), false);
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(result.headers, 'Authorization'),
        false
      );
    });

    it('should still merge configs correctly', function () {
      const config1 = {
        baseURL: 'https://api.example.com',
        timeout: 1000,
        headers: {
          common: {
            Accept: 'application/json',
          },
        },
      };

      const config2 = {
        url: '/users',
        timeout: 5000,
        headers: {
          common: {
            'Content-Type': 'application/json',
          },
        },
      };

      const result = mergeConfig(config1, config2);

      assert.strictEqual(result.baseURL, 'https://api.example.com');
      assert.strictEqual(result.url, '/users');
      assert.strictEqual(result.timeout, 5000);
      assert.strictEqual(result.headers.common.Accept, 'application/json');
      assert.strictEqual(result.headers.common['Content-Type'], 'application/json');
    });
  });

  describe('default transforms', function () {
    const transformRequest = defaults.transformRequest[0];
    const transformResponse = defaults.transformResponse[0];

    it('should not apply a polluted parseReviver to JSON responses', function () {
      const seen = [];
      Object.prototype.parseReviver = function (key, value) {
        seen.push(key);
        if (key === 'role') return 'admin';
        if (key === 'balance') return 999999;
        return value;
      };

      const result = transformResponse.call({}, '{"role":"user","balance":10}');

      delete Object.prototype.parseReviver;
      assert.strictEqual(seen.length, 0);
      assert.deepStrictEqual(result, { role: 'user', balance: 10 });
    });

    it('should not read a polluted responseType when transforming responses', function () {
      Object.prototype.responseType = 'text';

      const result = transformResponse.call({}, '{"a":1}');

      delete Object.prototype.responseType;
      assert.deepStrictEqual(result, { a: 1 });
    });

    it('should not read polluted transitional options when transforming responses', function () {
      Object.prototype.transitional = { forcedJSONParsing: false, silentJSONParsing: true };

      const result = transformResponse.call({}, '{"a":1}');

      delete Object.prototype.transitional;
      assert.deepStrictEqual(result, { a: 1 });
    });

    it('should not use a polluted formSerializer for urlencoded payloads', function () {
      let visited = false;
      Object.prototype.formSerializer = {
        visitor: function (value, key) {
          visited = true;
          this.append('injected', 'evil');
          return false;
        },
      };

      const headers = new AxiosHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
      const result = transformRequest.call({}, { a: 'b' }, headers);

      delete Object.prototype.formSerializer;
      assert.strictEqual(visited, false);
      assert.strictEqual(result, 'a=b');
    });

    it('should not construct a polluted env.FormData for multipart payloads', function () {
      let constructed = false;
      function EvilFormData() {
        constructed = true;
      }
      Object.prototype.env = { FormData: EvilFormData };

      const headers = new AxiosHeaders({ 'Content-Type': 'multipart/form-data' });
      let result;
      let error;

      try {
        result = transformRequest.call({}, { a: 'b' }, headers);
      } catch (err) {
        error = err;
      }

      delete Object.prototype.env;
      assert.strictEqual(constructed, false);
      assert.strictEqual(error, undefined);
      assert.ok(result && typeof result.append === 'function');
      assert.ok(!(result instanceof EvilFormData));
    });
  });

  describe('http adapter', function () {
    const payload = { role: 'user', balance: 10 };
    let server;
    let baseURL;

    before(function (done) {
      server = http.createServer(function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Connection', 'close');
        res.end(JSON.stringify(payload));
      });

      server.listen(0, '127.0.0.1', function () {
        baseURL = 'http://127.0.0.1:' + server.address().port;
        done();
      });
    });

    after(function (done) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close(function () {
        done();
      });
    });

    it('should not let a polluted parseReviver tamper with JSON responses', async function () {
      const seen = [];
      Object.prototype.parseReviver = function (key, value) {
        seen.push(key);
        if (key === 'role') return 'admin';
        if (key === 'balance') return 999999;
        return value;
      };

      const res = await axios.get(baseURL + '/');

      delete Object.prototype.parseReviver;
      assert.strictEqual(seen.length, 0);
      assert.deepStrictEqual(res.data, payload);
    });

    it('should not hand the request to a polluted transport', async function () {
      let hijacked = null;
      Object.prototype.transport = {
        request: function (options) {
          hijacked = options;
          throw new Error('request hijacked');
        },
      };

      const res = await axios.get(baseURL + '/', {
        auth: { username: 'user', password: 'secret' },
      });

      delete Object.prototype.transport;
      assert.strictEqual(hijacked, null);
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.data, payload);
    });

    it('should not read a polluted transport in the adapter', async function () {
      let hijacked = null;
      Object.prototype.transport = {
        request: function (options) {
          hijacked = options;
          throw new Error('request hijacked');
        },
      };

      const res = await httpAdapter({ url: baseURL + '/', method: 'get', headers: {} });

      delete Object.prototype.transport;
      assert.strictEqual(hijacked, null);
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(JSON.parse(res.data), payload);
    });

    it('should not read a polluted responseType in the adapter', async function () {
      Object.prototype.responseType = 'stream';

      const res = await httpAdapter({ url: baseURL + '/', method: 'get', headers: {} });

      delete Object.prototype.responseType;
      const data = res.data;
      if (data && typeof data.destroy === 'function') {
        data.destroy();
      }
      assert.strictEqual(typeof data, 'string');
      assert.deepStrictEqual(JSON.parse(data), payload);
    });

    it('should not switch protocols on a polluted httpVersion', async function () {
      Object.prototype.httpVersion = 2;

      const res = await httpAdapter({
        url: baseURL + '/',
        method: 'get',
        headers: {},
        timeout: 5000,
      });

      delete Object.prototype.httpVersion;
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(JSON.parse(res.data), payload);
    });

    it('should not construct a polluted env.Blob for data: URIs', async function () {
      let constructed = false;
      function EvilBlob() {
        constructed = true;
      }
      Object.prototype.env = { Blob: EvilBlob };

      let res;
      let error;

      try {
        res = await httpAdapter({
          url: 'data:application/json;base64,eyJyb2xlIjoidXNlciJ9',
          method: 'get',
          headers: {},
          responseType: 'blob',
        });
      } catch (err) {
        error = err;
      }

      delete Object.prototype.env;
      assert.strictEqual(constructed, false);

      // Blob is only a global since Node 18; older runtimes reject with ERR_NOT_SUPPORT
      if (typeof Blob !== 'undefined') {
        assert.strictEqual(error, undefined);
        assert.ok(res.data instanceof Blob);
        assert.ok(!(res.data instanceof EvilBlob));
      } else {
        assert.ok(error);
      }
    });

    it('should pass an own inert createConnection option to transports', async function () {
      Object.prototype.createConnection = () => {
        throw new Error('unexpected inherited createConnection');
      };

      const res = await axios.get(baseURL + '/', {
        transport: {
          request(options, handleResponse) {
            assert.strictEqual(
              Object.prototype.hasOwnProperty.call(options, 'createConnection'),
              true
            );
            assert.strictEqual(options.createConnection, undefined);
            return http.request(options, handleResponse);
          },
        },
      });

      assert.deepStrictEqual(res.data, payload);
    });

    it('should not hand the request socket to an inherited createConnection', async function () {
      let hijacked = false;

      Object.prototype.createConnection = function () {
        hijacked = true;
        throw new Error('socket hijacked');
      };

      let res;

      try {
        res = await axios.get(baseURL + '/');
      } finally {
        delete Object.prototype.createConnection;
      }

      assert.strictEqual(hijacked, false);
      assert.deepStrictEqual(res.data, payload);
    });
  });

  describe('dispatch config compatibility', function () {
    it('should preserve an unchanged merged config through dispatch', async function () {
      let interceptedConfig;
      let adapterConfig;

      const instance = axios.create({
        adapter: async (config) => {
          adapterConfig = config;
          return {
            data: 'ok',
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        },
      });

      instance.interceptors.request.use((config) => {
        interceptedConfig = config;
        return config;
      });

      const response = await instance.get('/config-identity');

      assert.strictEqual(adapterConfig, interceptedConfig);
      assert.strictEqual(response.config, interceptedConfig);
      assert.strictEqual(Object.getPrototypeOf(adapterConfig), null);
      assert.strictEqual(
        Object.prototype.propertyIsEnumerable.call(adapterConfig, 'hasOwnProperty'),
        false
      );
      assert.strictEqual(Object.keys(adapterConfig).includes('hasOwnProperty'), false);
    });

    it('should materialize a frozen null-prototype interceptor replacement', async function () {
      let replacement;

      const instance = axios.create({
        adapter: async (config) => ({
          data: 'ok',
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });

      instance.interceptors.request.use((config) => {
        replacement = Object.freeze(Object.assign(Object.create(null), config));
        return replacement;
      });

      const response = await instance.get('/frozen-replacement');

      assert.strictEqual(response.data, 'ok');
      assert.notStrictEqual(response.config, replacement);
      assert.strictEqual(Object.getPrototypeOf(response.config), null);
      assert.strictEqual(Object.isFrozen(response.config), false);
    });

    it('should filter unsafe keys from a null-prototype interceptor replacement', async function () {
      let replacement;

      const instance = axios.create({
        adapter: async (config) => ({
          data: {
            safe: config.safe,
            hasProto: Object.prototype.hasOwnProperty.call(config, '__proto__'),
            hasConstructor: Object.prototype.hasOwnProperty.call(config, 'constructor'),
            hasPrototype: Object.prototype.hasOwnProperty.call(config, 'prototype'),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });

      instance.interceptors.request.use((config) => {
        replacement = Object.assign(Object.create(null), config);
        replacement.safe = 'preserved';
        Object.defineProperty(replacement, '__proto__', {
          value: 'excluded',
          enumerable: true,
          configurable: true,
          writable: true,
        });
        replacement.constructor = 'excluded';
        replacement.prototype = 'excluded';
        return replacement;
      });

      const response = await instance.get('/unsafe-own-keys');

      assert.deepStrictEqual(response.data, {
        safe: 'preserved',
        hasProto: false,
        hasConstructor: false,
        hasPrototype: false,
      });
      assert.notStrictEqual(response.config, replacement);
    });

    it('should normalize a class-based interceptor replacement', async function () {
      let replacement;

      class ConfigTemplate {
        marker() {
          return 'template';
        }
      }

      const instance = axios.create({
        adapter: async (config) => ({
          data: config.marker(),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });

      instance.interceptors.request.use((config) => {
        replacement = new ConfigTemplate();
        replacement.url = config.url;
        replacement.method = config.method;
        replacement.headers = config.headers;
        replacement.adapter = config.adapter;
        return replacement;
      });

      const response = await instance.get('/normalized-replacement');

      assert.strictEqual(response.data, 'template');
      assert.notStrictEqual(response.config, replacement);
      assert.strictEqual(response.config instanceof ConfigTemplate, false);
      assert.strictEqual(Object.getPrototypeOf(response.config), null);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(response.config, 'marker'), true);
    });
  });

  describe('GHSA-w9j2-pvgh-6h63 validateStatus merge', function () {
    it('should not inherit a polluted validateStatus during mergeConfig', function () {
      Object.prototype.validateStatus = () => true;
      const merged = mergeConfig(defaults, { url: '/x' });
      assert.strictEqual(merged.validateStatus, defaults.validateStatus);
    });

    it('should keep 4xx/5xx responses rejected when Object.prototype.validateStatus is polluted', async function () {
      this.timeout(10000);
      Object.prototype.validateStatus = () => true;
      const server = http.createServer((req, res) => {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end('{"error":"unauthorized"}');
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      try {
        let threw = false;
        try {
          await axios.get(`http://127.0.0.1:${port}/`);
        } catch (err) {
          threw = true;
          assert.strictEqual(err.response.status, 401);
        }
        assert.strictEqual(threw, true);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });

  describe('GHSA-q8qp-cvcw-x6jj http adapter gadgets', function () {
    function startServer(handler) {
      return new Promise((resolve) => {
        const server = http.createServer(handler || ((req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ headers: req.headers, url: req.url }));
        }));
        server.listen(0, '127.0.0.1', () => resolve(server));
      });
    }
    function stopServer(server) {
      return new Promise((resolve) => server.close(resolve));
    }

    it('should not pick up Object.prototype.auth as an Authorization header', async function () {
      this.timeout(10000);
      Object.prototype.auth = { username: 'attacker', password: 'exfil' };
      const server = await startServer();
      const { port } = server.address();
      try {
        const res = await axios.get(`http://127.0.0.1:${port}/api`);
        assert.strictEqual(res.data.headers.authorization, undefined);
      } finally { await stopServer(server); }
    });

    it('should not pick up Object.prototype.socketPath', async function () {
      const major = parseInt(process.versions.node.split('.')[0], 10);
      if (major < 16) this.skip();
      this.timeout(10000);
      Object.prototype.socketPath = '/tmp/axios-should-never-be-used.sock';
      const server = await startServer();
      const { port } = server.address();
      try {
        const res = await axios.get(`http://127.0.0.1:${port}/api`);
        assert.strictEqual(res.status, 200);
      } finally { await stopServer(server); }
    });

    it('should not invoke Object.prototype.beforeRedirect during redirects', async function () {
      this.timeout(10000);
      let hijackCalled = false;
      Object.prototype.beforeRedirect = function () { hijackCalled = true; };
      const target = await startServer();
      const { port: targetPort } = target.address();
      const redirector = await startServer((req, res) => {
        res.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/final` });
        res.end();
      });
      const { port: redirectorPort } = redirector.address();
      try {
        await axios.get(`http://127.0.0.1:${redirectorPort}/start`);
        assert.strictEqual(hijackCalled, false);
      } finally {
        await stopServer(redirector);
        await stopServer(target);
      }
    });

    it('should not enable insecureHTTPParser via Object.prototype', async function () {
      this.timeout(10000);
      Object.prototype.insecureHTTPParser = true;
      const net = await import('net');
      // A control character in a header value is rejected by Node's strict HTTP parser on every
      // supported Node version, but accepted once insecureHTTPParser is enabled.
      const payload =
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/json\r\n' +
        'X-Smuggle: bad\u0001value\r\n' +
        'Content-Length: 2\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        '{}';
      const malformed = await new Promise((resolve) => {
        const srv = net.createServer((socket) => { socket.once('data', () => socket.end(payload)); });
        srv.listen(0, '127.0.0.1', () => resolve(srv));
      });
      const { port } = malformed.address();
      try {
        let threw = false;
        try { await axios.get(`http://127.0.0.1:${port}/`); } catch (err) { threw = true; }
        assert.strictEqual(threw, true, 'request should be rejected by the strict HTTP parser');
      } finally { await new Promise((resolve) => malformed.close(resolve)); }
    });

    it('should not inject Proxy-Authorization from polluted Object.prototype.auth', async function () {
      this.timeout(10000);
      // setProxy reads `proxy.auth` directly. When `proxy` is a
      // URL instance from the environment proxy or a plain object without an own `auth`,
      // a polluted Object.prototype.auth would otherwise be base64-encoded into the
      // Proxy-Authorization header, leaking attacker-controlled credentials.
      Object.prototype.auth = { username: 'attacker', password: 'exfil' };

      const proxy = await startServer();
      const { port: proxyPort } = proxy.address();

      const target = await startServer();
      const { port: targetPort } = target.address();

      try {
        const res = await axios.get(`http://127.0.0.1:${targetPort}/api`, {
          proxy: { host: '127.0.0.1', port: proxyPort, protocol: 'http' },
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(
          res.data.headers['proxy-authorization'],
          undefined,
          'polluted Object.prototype.auth must not produce a Proxy-Authorization header'
        );
      } finally {
        await stopServer(target);
        await stopServer(proxy);
      }
    });

    it('should not inject Proxy-Authorization from polluted Object.prototype.username', async function () {
      this.timeout(10000);
      // The setProxy username/password branch builds basic creds from `proxy.username`
      // and `proxy.password`. For a plain object proxy, both reads must be guarded
      // against prototype pollution.
      Object.prototype.username = 'attacker';
      Object.prototype.password = 'exfil';

      const proxy = await startServer();
      const { port: proxyPort } = proxy.address();

      const target = await startServer();
      const { port: targetPort } = target.address();

      try {
        const res = await axios.get(`http://127.0.0.1:${targetPort}/api`, {
          proxy: { host: '127.0.0.1', port: proxyPort, protocol: 'http' },
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(
          res.data.headers['proxy-authorization'],
          undefined,
          'polluted Object.prototype.username must not produce a Proxy-Authorization header'
        );
      } finally {
        await stopServer(target);
        await stopServer(proxy);
      }
    });
  });

  describe('GHSA-q8qp-cvcw-x6jj resolveConfig baseURL gadget', function () {
    it('should not hijack relative-URL requests via Object.prototype.baseURL', async function () {
      this.timeout(10000);
      let hijackHit = false;
      const hijacker = http.createServer((req, res) => { hijackHit = true; res.writeHead(200); res.end('{"hijacked":true}'); });
      await new Promise((resolve) => hijacker.listen(0, '127.0.0.1', resolve));
      Object.prototype.baseURL = `http://127.0.0.1:${hijacker.address().port}`;
      try {
        let threw = false;
        try { await axios.get('/api'); } catch (_) { threw = true; }
        assert.strictEqual(hijackHit, false);
        assert.strictEqual(threw, true);
      } finally { await new Promise((resolve) => hijacker.close(resolve)); }
    });
  });

  describe('mergeConfig null-prototype structural defense', function () {
    it('should return an object whose prototype is null', function () {
      const merged = mergeConfig({ url: '/x' }, { method: 'get' });
      assert.strictEqual(Object.getPrototypeOf(merged), null);
    });

    it('should preserve hasOwnProperty as a callable own slot', function () {
      const merged = mergeConfig({}, { url: '/x', method: 'get' });
      assert.strictEqual(typeof merged.hasOwnProperty, 'function');
      assert.strictEqual(merged.hasOwnProperty('url'), true);
      assert.strictEqual(merged.hasOwnProperty('bogus'), false);
    });

    it('should not expose arbitrary polluted keys as inherited properties', function () {
      Object.prototype.polluted = 'attacker';
      try {
        const merged = mergeConfig({ url: '/x' }, {});
        assert.strictEqual(merged.polluted, undefined);
      } finally { delete Object.prototype.polluted; }
    });
  });

  describe('Full gadget coverage via null-prototype config', function () {
    function startEcho(handler) {
      return new Promise((resolve) => {
        const server = http.createServer(handler || ((req, res) => {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ url: req.url, method: req.method, headers: req.headers, body }));
          });
        }));
        server.listen(0, '127.0.0.1', () => resolve(server));
      });
    }
    const stop = (s) => new Promise((r) => s.close(r));

    it('should ignore polluted adapter', async function () {
      this.timeout(10000);
      let hijacked = false;
      Object.prototype.adapter = function () { hijacked = true; return Promise.resolve({ data: 'pwned', status: 200, statusText: 'OK', headers: {}, config: {}, request: {} }); };
      const server = await startEcho();
      const { port } = server.address();
      try { const res = await axios.get(`http://127.0.0.1:${port}/ok`); assert.strictEqual(hijacked, false); } finally { await stop(server); }
    });

    it('should ignore polluted proxy', async function () {
      this.timeout(10000);
      Object.prototype.proxy = { protocol: 'http', host: '127.0.0.1', port: 1 };
      const server = await startEcho();
      const { port } = server.address();
      try { const res = await axios.get(`http://127.0.0.1:${port}/`); assert.strictEqual(res.status, 200); } finally { await stop(server); }
    });

    it('should ignore polluted method', async function () {
      this.timeout(10000);
      Object.prototype.method = 'DELETE';
      const server = await startEcho();
      const { port } = server.address();
      try { const res = await axios.get(`http://127.0.0.1:${port}/ok`); assert.strictEqual(res.data.method, 'GET'); } finally { await stop(server); }
    });

    it('should ignore polluted timeout at the merged config level', function () {
      Object.prototype.timeout = 1;
      const merged = mergeConfig({}, { url: '/x' });
      assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, 'timeout'), false);
    });

    it('should ignore polluted responseType', async function () {
      this.timeout(10000);
      Object.prototype.responseType = 'arraybuffer';
      const server = await startEcho();
      const { port } = server.address();
      try { const res = await axios.get(`http://127.0.0.1:${port}/`); assert.strictEqual(typeof res.data, 'object'); assert.ok(!Buffer.isBuffer(res.data)); } finally { await stop(server); }
    });

    it('should use GET when the default instance has no own method', async function () {
      Object.prototype.method = 'DELETE';

      const response = await axios({
        url: '/default-method',
        adapter: async (config) => ({
          data: config.method,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });

      assert.strictEqual(response.data, 'get');
    });

    it('should send GET on the wire when the default instance has no own method', async function () {
      this.timeout(10000);
      Object.prototype.method = 'DELETE';
      const server = await startEcho();
      const { port } = server.address();
      try {
        const res = await axios({ url: `http://127.0.0.1:${port}/ok` });
        assert.strictEqual(res.data.method, 'GET');
      } finally {
        delete Object.prototype.method;
        await stop(server);
      }
    });

    it('should ignore headers inherited after a request interceptor replaces config', async function () {
      Object.prototype.headers = { 'X-Injected': 'yes' };

      const instance = axios.create({
        adapter: async (config) => ({
          data: config.headers.get('X-Injected'),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });

      instance.interceptors.request.use((config) => {
        const replacement = { ...config };
        delete replacement.headers;
        return replacement;
      });

      const response = await instance.get('/interceptor-headers');

      assert.strictEqual(response.data, undefined);
    });

    it('should ignore behavior inherited after a request interceptor replaces config', async function () {
      let requestTransformCalled = false;
      let responseTransformCalled = false;

      Object.prototype.transformRequest = () => {
        requestTransformCalled = true;
      };
      Object.prototype.transformResponse = () => {
        responseTransformCalled = true;
      };
      Object.prototype.cancelToken = {
        throwIfRequested() {
          throw new Error('unexpected inherited cancelToken');
        },
      };
      Object.prototype.signal = { aborted: true };
      Object.prototype.method = 'delete';

      const instance = axios.create({
        adapter: async (config) => ({
          data: config.method,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });

      instance.interceptors.request.use((config) => {
        const replacement = { ...config };
        delete replacement.transformRequest;
        delete replacement.transformResponse;
        delete replacement.cancelToken;
        delete replacement.signal;
        delete replacement.method;
        return replacement;
      });

      const response = await instance.get('/interceptor-behavior');

      assert.strictEqual(requestTransformCalled, false);
      assert.strictEqual(responseTransformCalled, false);
      assert.strictEqual(response.data, undefined);
    });

    it('should ignore an adapter inherited after a request interceptor replaces config', async function () {
      let called = false;

      Object.prototype.adapter = async (config) => {
        called = true;
        return {
          data: 'unexpected',
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const instance = axios.create();

      instance.interceptors.request.use((config) => {
        const replacement = { ...config };
        delete replacement.adapter;
        return replacement;
      });

      const response = await instance.get('data:,safe', {
        responseType: 'text',
      });

      assert.strictEqual(called, false);
      assert.strictEqual(response.data, 'safe');
    });

    it('should preserve config inherited from a non-shared prototype after interception', async function () {
      const instance = axios.create();

      instance.interceptors.request.use((config) => {
        const replacement = Object.create({
          adapter: async (resolvedConfig) => ({
            data: resolvedConfig.customValue,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: resolvedConfig,
          }),
          customValue: 'preserved',
        });

        replacement.url = config.url;
        replacement.method = config.method;
        replacement.headers = config.headers;

        return replacement;
      });

      const response = await instance.get('/prototype-template');

      assert.strictEqual(response.data, 'preserved');
    });

    [
      ['unchanged', ''],
      ['set to null', 'Object.prototype.constructor = null;'],
      ['deleted', 'delete Object.prototype.constructor;'],
      [
        'replaced by an accessor',
        `Object.defineProperty(Object.prototype, 'constructor', {
          configurable: true,
          get() { return Object; }
        });`,
      ],
    ].forEach(([description, mutateConstructor]) => {
      it(`should exclude a foreign realm Object.prototype with its constructor ${description}`, async function () {
        const context = vm.createContext({
          adapter: async (config) => ({
            data: config.customValue,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          }),
        });

        const replacement = vm.runInContext(
          `
            Object.prototype.transformResponse = () => 'polluted';
            ${mutateConstructor}
            Object.create({adapter, customValue: 'preserved'});
          `,
          context
        );

        const instance = axios.create();

        instance.interceptors.request.use((config) => {
          replacement.url = config.url;
          replacement.method = config.method;
          replacement.headers = config.headers;

          return replacement;
        });

        const response = await instance.get('/cross-realm-prototype-template');

        assert.strictEqual(response.data, 'preserved');
      });
    });
  });

  // utils.merge previously read `result[targetKey]` directly, which walks the
  // prototype chain. A polluted Object.prototype.<key> object would surface as
  // the existing value and be merged into the result.
  describe('utils.merge prototype-chain read', function () {
    it('should not pick up polluted Object.prototype.<key> as the existing value', function () {
      Object.prototype.headers = { evil: 'yes' };

      const result = utils.merge({}, { headers: { 'Content-Type': 'application/json' } });

      assert.strictEqual(result.headers.evil, undefined);
      assert.strictEqual(result.headers['Content-Type'], 'application/json');
    });

    it('should not absorb polluted nested objects when the key is absent from inputs', function () {
      // When the source does not carry `customNested`, the merged result should
      // not surface it either, even if Object.prototype carries it.
      Object.prototype.customNested = { evil: 'yes' };

      const result = utils.merge({}, { safe: 'value' });

      assert.strictEqual(result.hasOwnProperty('customNested'), false);
      assert.strictEqual(result.safe, 'value');
    });
  });

  // Object.defineProperty calls a HasProperty check on `get`/`set` of the
  // descriptor. A polluted Object.prototype.get with a non-function value would
  // throw TypeError at every defineProperty site that uses a plain literal
  // descriptor. Each fixed site should be shielded with `__proto__: null`.
  describe('Object.defineProperty descriptor literals', function () {
    it('should construct AxiosError when Object.prototype.get is polluted', function () {
      Object.prototype.get = 'attacker';

      const err = new AxiosError('hello', 'ECODE');

      assert.strictEqual(err.message, 'hello');
      assert.strictEqual(err.code, 'ECODE');
    });

    it('should construct AxiosHeaders accessor methods when Object.prototype.get is polluted', function () {
      Object.prototype.get = 'attacker';

      // AxiosHeaders.accessor uses Object.defineProperty on the prototype.
      // Triggering a fresh accessor definition exercises the descriptor literal.
      AxiosHeaders.accessor('X-Pp-Test');

      const h = new AxiosHeaders();
      h.setXPpTest('value');
      assert.strictEqual(h.getXPpTest(), 'value');
    });

    it('should not throw in mergeConfig when Object.prototype.get is polluted', function () {
      Object.prototype.get = 'attacker';

      const result = mergeConfig({}, { url: '/x', method: 'get' });

      assert.strictEqual(result.url, '/x');
      assert.strictEqual(result.method, 'get');
      assert.strictEqual(typeof result.hasOwnProperty, 'function');
    });

    it('should not throw in utils.extend when Object.prototype.get is polluted', function () {
      Object.prototype.get = 'attacker';

      const a = {};
      const b = { x: 1, fn() {} };
      utils.extend(a, b);

      assert.strictEqual(a.x, 1);
      assert.strictEqual(typeof a.fn, 'function');
    });

    it('should not throw in utils.extend with thisArg when Object.prototype.get is polluted', function () {
      Object.prototype.get = 'attacker';

      const a = {};
      const ctx = { tag: 'ctx' };
      const b = {
        method() {
          return this.tag;
        },
      };
      utils.extend(a, b, ctx);

      assert.strictEqual(a.method(), 'ctx');
    });

    it('should not throw in utils.inherits when Object.prototype.get is polluted', function () {
      Object.prototype.get = 'attacker';

      function Parent() {}
      function Child() {}
      utils.inherits(Child, Parent);

      assert.strictEqual(Child.prototype.constructor, Child);
      assert.strictEqual(Child.super, Parent.prototype);
    });

    it('should also be shielded against a polluted Object.prototype.set', function () {
      Object.prototype.set = 'attacker';

      // Same surface as `get` — ToPropertyDescriptor checks both. One spot-check
      // covers them all since they share the same fix.
      const result = mergeConfig({}, { url: '/y' });
      assert.strictEqual(result.url, '/y');
    });
  });

  // End-to-end regressions covering published advisory PoCs against full axios
  // request flow. Each test mirrors the exploit scenario from the advisory and
  // asserts the attack does not succeed.
  describe('advisory regression — full request flow', function () {
    function startServer(handler) {
      return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => resolve(server));
      });
    }
    const stop = (s) => new Promise((r) => s.close(r));

    // Full MITM via prototype pollution gadget in
    // `config.proxy`. mergeConfig must not surface a polluted Object.prototype.proxy
    // as the merged config's proxy, otherwise every request would route through
    // an attacker-controlled host.
    it('polluted Object.prototype.proxy must not redirect requests through an attacker proxy', async function () {
      this.timeout(10000);
      const proxyHits = [];
      const attackerProxy = await startServer((req, res) => {
        proxyHits.push({
          url: req.url,
          authorization: req.headers.authorization,
          host: req.headers.host,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"hijacked":true}');
      });

      const realHits = [];
      const realServer = await startServer((req, res) => {
        realHits.push({ url: req.url });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"data":"real"}');
      });

      try {
        Object.prototype.proxy = {
          protocol: 'http',
          host: '127.0.0.1',
          port: attackerProxy.address().port,
        };

        const realPort = realServer.address().port;
        const res = await axios.get(`http://127.0.0.1:${realPort}/api/secrets`, {
          auth: { username: 'admin', password: 'SuperSecret123!' },
        });

        assert.strictEqual(proxyHits.length, 0, 'attacker proxy must not receive any request');
        assert.strictEqual(realHits.length, 1, 'request must reach the real target');
        assert.deepStrictEqual(res.data, { data: 'real' });
      } finally {
        await stop(attackerProxy);
        await stop(realServer);
      }
    });

    // Credential theft and response hijacking via
    // prototype pollution gadget in config merge. A polluted
    // Object.prototype.transformResponse function would otherwise execute with
    // `this = config`, exposing `auth.username`/`auth.password` to the attacker.
    it('polluted Object.prototype.transformResponse must not be invoked or leak request credentials', async function () {
      this.timeout(10000);
      let invoked = false;
      let stolen = null;
      Object.prototype.transformResponse = function pollutedTransform(data) {
        invoked = true;
        stolen = {
          url: this && this.url,
          username: this && this.auth && this.auth.username,
          password: this && this.auth && this.auth.password,
          data,
        };
        return true;
      };

      const server = await startServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"secret":"keep-me"}');
      });

      try {
        const { port } = server.address();
        const res = await axios.get(`http://127.0.0.1:${port}/users`, {
          auth: { username: 'svc-account', password: 'prod-secret-key-123!' },
        });

        assert.strictEqual(invoked, false, 'polluted transformResponse must not run');
        assert.strictEqual(stolen, null, 'no request context must be captured');
        assert.deepStrictEqual(
          res.data,
          { secret: 'keep-me' },
          'response data must reach the caller untampered'
        );
      } finally {
        await stop(server);
      }
    });
  });

  // Nested option fields and iterator sources must be read pollution-safely:
  // a value reachable only through a polluted Object.prototype is ignored.
  describe('inherited nested option fields', function () {
    function definePolluted(key, value) {
      Object.defineProperty(Object.prototype, key, {
        value,
        writable: true,
        configurable: true,
      });
    }

    function startServer(handler) {
      return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => resolve(server));
      });
    }

    const stop = (s) => new Promise((r) => s.close(r));

    it('should ignore inherited data for bodyless method helpers', async function () {
      definePolluted('data', 'inherited-body');

      try {
        for (const method of ['delete', 'get', 'head', 'options']) {
          let seenData = 'unset';

          await axios[method]('/test', {
            adapter(config) {
              seenData = config.data;

              return Promise.resolve({
                data: null,
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
                request: {},
              });
            },
          });

          assert.strictEqual(seenData, undefined, method + ' must not send inherited data');
        }
      } finally {
        delete Object.prototype.data;
      }
    });

    it('should ignore inherited nested serializer fields in getUri', function () {
      let serializeInvoked = false;

      definePolluted('serialize', function () {
        serializeInvoked = true;
        return 'inherited=1';
      });

      try {
        assert.strictEqual(
          axios.getUri({
            url: '/foo',
            params: { value: 'a b' },
            paramsSerializer: {},
          }),
          '/foo?value=a+b'
        );
        assert.strictEqual(serializeInvoked, false);
      } finally {
        delete Object.prototype.serialize;
      }
    });

    it('should ignore inherited serializer options in buildURL', function () {
      let serializeInvoked = false;
      let encodeInvoked = false;

      definePolluted('serialize', function () {
        serializeInvoked = true;
        return 'inherited=1';
      });
      definePolluted('encode', function () {
        encodeInvoked = true;
        return 'inherited';
      });

      try {
        assert.strictEqual(buildURL('/foo', { value: 'a b' }, {}), '/foo?value=a+b');
        assert.strictEqual(serializeInvoked, false);
        assert.strictEqual(encodeInvoked, false);
      } finally {
        delete Object.prototype.serialize;
        delete Object.prototype.encode;
      }
    });

    it('should still honor own serializer options in buildURL', function () {
      assert.strictEqual(
        buildURL('/foo', { value: 'a b' }, { serialize: () => 'own=1' }),
        '/foo?own=1'
      );
      assert.strictEqual(
        buildURL('/foo', { value: 'a b' }, () => 'fn=1'),
        '/foo?fn=1'
      );
    });

    it('should ignore inherited nested auth fields in resolveConfig', function () {
      // resolveConfig encodes credentials with the global btoa (Node 16+)
      if (typeof btoa !== 'function') {
        this.skip();
      }

      definePolluted('username', 'inherited-user');
      definePolluted('password', 'inherited-pass');

      try {
        const config = resolveConfig({
          url: '/foo',
          auth: {},
        });

        assert.strictEqual(config.headers.get('Authorization'), 'Basic Og==');
      } finally {
        delete Object.prototype.username;
        delete Object.prototype.password;
      }
    });

    it('should ignore inherited nested serializer fields in resolveConfig', function () {
      let serializeInvoked = false;
      let encodeInvoked = false;

      definePolluted('serialize', function () {
        serializeInvoked = true;
        return 'inherited=1';
      });
      definePolluted('encode', function () {
        encodeInvoked = true;
        return 'inherited';
      });

      try {
        const config = resolveConfig({
          url: '/foo',
          params: { value: 'a b' },
          paramsSerializer: {},
        });

        assert.strictEqual(config.url, '/foo?value=a+b');
        assert.strictEqual(serializeInvoked, false);
        assert.strictEqual(encodeInvoked, false);
      } finally {
        delete Object.prototype.serialize;
        delete Object.prototype.encode;
      }
    });

    it('should ignore inherited nested request option fields in http adapter', async function () {
      this.timeout(10000);
      const server = await startServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            authorization: req.headers.authorization,
            url: req.url,
          })
        );
      });

      definePolluted('username', 'inherited-user');
      definePolluted('password', 'inherited-pass');
      definePolluted('serialize', function () {
        return 'inherited=1';
      });

      try {
        const response = await axios.get(`http://127.0.0.1:${server.address().port}/demo`, {
          auth: {},
          params: { value: 'a b' },
          paramsSerializer: {},
        });

        assert.deepStrictEqual(response.data, {
          authorization: 'Basic Og==',
          url: '/demo?value=a+b',
        });
      } finally {
        delete Object.prototype.username;
        delete Object.prototype.password;
        delete Object.prototype.serialize;
        await stop(server);
      }
    });

    it('should ignore inherited proxy when http adapter receives a plain config', async function () {
      this.timeout(10000);
      const proxyEnvKeys = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY'];
      const originalProxyEnv = Object.create(null);
      let proxy;
      let target;
      let proxyHits = 0;
      let targetHits = 0;

      for (const key of proxyEnvKeys) {
        originalProxyEnv[key] = process.env[key];
        delete process.env[key];
      }

      try {
        proxy = await startServer((req, res) => {
          proxyHits += 1;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ via: 'proxy', url: req.url }));
        });

        target = await startServer((req, res) => {
          targetHits += 1;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ via: 'target', url: req.url }));
        });

        definePolluted('proxy', {
          protocol: 'http',
          host: '127.0.0.1',
          port: proxy.address().port,
        });

        const response = await httpAdapter({
          method: 'get',
          url: `http://127.0.0.1:${target.address().port}/direct`,
          headers: {},
          maxRedirects: 0,
          maxContentLength: -1,
          maxBodyLength: -1,
          timeout: 0,
        });
        const data = JSON.parse(response.data);

        assert.strictEqual(proxyHits, 0);
        assert.strictEqual(targetHits, 1);
        assert.deepStrictEqual(data, { via: 'target', url: '/direct' });
      } finally {
        delete Object.prototype.proxy;

        for (const key of proxyEnvKeys) {
          if (originalProxyEnv[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = originalProxyEnv[key];
          }
        }

        target && (await stop(target));
        proxy && (await stop(proxy));
      }
    });

    it('should ignore inherited paramsSerializer when http adapter receives a plain config', async function () {
      this.timeout(10000);
      let server;
      let serializerInvoked = false;

      definePolluted('paramsSerializer', function () {
        serializerInvoked = true;
        return 'inherited=1';
      });

      try {
        server = await startServer((req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: req.url }));
        });

        const response = await httpAdapter({
          method: 'get',
          url: `http://127.0.0.1:${server.address().port}/direct`,
          headers: {},
          params: { value: 'a b' },
          proxy: false,
          maxRedirects: 0,
          maxContentLength: -1,
          maxBodyLength: -1,
          timeout: 0,
        });
        const data = JSON.parse(response.data);

        assert.strictEqual(serializerInvoked, false);
        assert.deepStrictEqual(data, { url: '/direct?value=a+b' });
      } finally {
        delete Object.prototype.paramsSerializer;
        server && (await stop(server));
      }
    });

    it('should not use inherited Symbol.iterator for request or response headers in http adapter', async function () {
      let capturedHeaders;
      const stubTransport = {
        request(options, handleResponse) {
          capturedHeaders = Object.assign({}, options.headers);
          const req = new EventEmitter();
          req.write = () => true;
          req.setTimeout = () => {};
          req.destroy = () => {};
          req.end = () => {
            const res = new stream.Readable({ read() {} });
            res.statusCode = 200;
            res.statusMessage = 'OK';
            res.headers = { 'x-server': 'real' };
            res.rawHeaders = [];
            res.req = req;
            process.nextTick(() => {
              handleResponse(res);
              res.push(null);
            });
          };
          return req;
        },
      };

      try {
        Object.prototype[Symbol.iterator] = function* () {
          yield ['X-Injected', 'yes'];
          yield ['Authorization', 'Bearer CHANGED'];
        };

        const response = await axios.get('http://stub.invalid/', {
          headers: {
            Authorization: 'Bearer VALID_USER_TOKEN',
            'X-App': 'safe',
          },
          transport: stubTransport,
          maxRedirects: 0,
        });

        assert.ok(capturedHeaders, 'transport was not invoked');
        assert.strictEqual(capturedHeaders['X-App'], 'safe');
        assert.strictEqual(
          capturedHeaders.Authorization || capturedHeaders.authorization,
          'Bearer VALID_USER_TOKEN'
        );
        assert.strictEqual(capturedHeaders['X-Injected'] || capturedHeaders['x-injected'], undefined);
        assert.strictEqual(response.headers.get('x-server'), 'real');
        assert.strictEqual(response.headers.get('x-injected'), undefined);
      } finally {
        delete Object.prototype[Symbol.iterator];
      }
    });

    it('should not use inherited Symbol.iterator for request headers in fetch adapter', async function () {
      if (typeof fetch !== 'function' || typeof Headers !== 'function') {
        this.skip();
      }

      let capturedHeaders;
      const responseHeaders = new Headers();
      responseHeaders.set('x-server', 'real');

      try {
        Object.prototype[Symbol.iterator] = function* () {
          yield ['X-Injected', 'yes'];
          yield ['Authorization', 'Bearer CHANGED'];
        };

        const response = await axios.get('http://127.0.0.1/', {
          adapter: 'fetch',
          headers: {
            Authorization: 'Bearer VALID_USER_TOKEN',
            'X-App': 'safe',
          },
          env: {
            async fetch(request) {
              capturedHeaders = {
                authorization: request.headers.get('authorization'),
                xApp: request.headers.get('x-app'),
                xInjected: request.headers.get('x-injected'),
              };
              return new Response('ok', { status: 200, headers: responseHeaders });
            },
          },
        });

        assert.ok(capturedHeaders, 'fetch was not invoked');
        assert.strictEqual(capturedHeaders.authorization, 'Bearer VALID_USER_TOKEN');
        assert.strictEqual(capturedHeaders.xApp, 'safe');
        assert.strictEqual(capturedHeaders.xInjected, null);
        assert.strictEqual(response.headers.get('x-server'), 'real');
        assert.strictEqual(response.headers.get('x-injected'), undefined);
      } finally {
        delete Object.prototype[Symbol.iterator];
      }
    });

    it('should ignore inherited nested auth fields in fetch adapter', async function () {
      if (typeof fetch !== 'function') {
        this.skip();
      }

      this.timeout(10000);
      const server = await startServer((req, res) => res.end(req.headers.authorization));

      definePolluted('username', 'inherited-user');
      definePolluted('password', 'inherited-pass');

      try {
        const response = await axios.get(`http://127.0.0.1:${server.address().port}/`, {
          adapter: 'fetch',
          auth: {},
        });

        assert.strictEqual(response.data, 'Basic Og==');
      } finally {
        delete Object.prototype.username;
        delete Object.prototype.password;
        await stop(server);
      }
    });
  });
});
