import assert from 'assert';
import FormData from 'form-data';
import resolveConfig from '../../../lib/helpers/resolveConfig.js';

describe('helpers::resolveConfig', function () {
  it('should ignore FormData getHeaders inherited only from Object.prototype', function () {
    if (typeof globalThis.FormData !== 'function') {
      this.skip();
    }

    let called = false;
    Object.prototype.getHeaders = () => {
      called = true;
      return { 'Content-Type': 'text/plain', 'X-Injected': 'yes' };
    };

    try {
      const config = resolveConfig({
        url: '/upload',
        data: new globalThis.FormData(),
      });

      assert.strictEqual(called, false);
      assert.strictEqual(config.headers.get('X-Injected'), undefined);
      assert.notStrictEqual(config.headers.get('Content-Type'), 'text/plain');
    } finally {
      delete Object.prototype.getHeaders;
    }
  });

  it('should still use getHeaders of a Node.js form-data instance', function () {
    const form = new FormData();
    form.append('field', 'value');

    const config = resolveConfig({
      url: '/upload',
      data: form,
    });

    assert.ok(
      /^multipart\/form-data; boundary=/.test(config.headers.get('Content-Type')),
      'form-data boundary header must be applied'
    );
  });
});
