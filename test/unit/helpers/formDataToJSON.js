import assert from 'assert';
import formDataToJSON from '../../../lib/helpers/formDataToJSON.js';
import AxiosError from '../../../lib/core/AxiosError.js';
import AxiosHeaders from '../../../lib/core/AxiosHeaders.js';
import defaults from '../../../lib/defaults/index.js';
import axios from '../../../lib/axios.js';

describe('helpers::formDataToJSON', function () {
  before(function () {
    // a spec-compliant global FormData (with entries()) is only available on Node 18+
    if (typeof FormData !== 'function') {
      this.skip();
    }
  });

  it('should throw AxiosError when a field path exceeds the default depth limit', function () {
    const formData = new FormData();

    formData.append('foo' + '[bar]'.repeat(101), '123');

    try {
      formDataToJSON(formData);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof AxiosError, 'error must be AxiosError, not RangeError');
      assert.strictEqual(err.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
      assert.ok(!(err instanceof RangeError));
    }
  });

  it('should throw AxiosError while tokenizing very deep field paths', function () {
    const formData = new FormData();

    formData.append('foo' + '[bar]'.repeat(10000), '123');

    try {
      formDataToJSON(formData);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof AxiosError, 'error must be AxiosError, not RangeError');
      assert.strictEqual(err.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
      assert.ok(!(err instanceof RangeError));
    }
  });

  it('should convert a field path at the default depth limit', function () {
    const formData = new FormData();

    formData.append('foo' + '[bar]'.repeat(100), '123');

    let value = formDataToJSON(formData).foo;

    for (let i = 0; i < 100; i++) {
      value = value.bar;
    }

    assert.strictEqual(value, '123');
  });

  it('should throw AxiosError for deep field paths via axios.formToJSON and the JSON request transform', function () {
    const formData = new FormData();

    formData.append('a' + '[x]'.repeat(15000), 'value');

    const assertDepthError = function (err) {
      assert.ok(err instanceof AxiosError, 'error must be AxiosError, not RangeError');
      assert.strictEqual(err.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
      return true;
    };

    assert.throws(function () {
      axios.formToJSON(formData);
    }, assertDepthError);

    assert.throws(function () {
      defaults.transformRequest[0].call(
        {},
        formData,
        new AxiosHeaders({ 'Content-Type': 'application/json' })
      );
    }, assertDepthError);
  });

  it('should reject deeply nested field paths before adapter dispatch', async function () {
    const formData = new FormData();
    let adapterCalled = false;

    formData.append('foo' + '[bar]'.repeat(101), '123');

    let thrown;

    try {
      await axios.post('/foo', formData, {
        headers: { 'Content-Type': 'application/json' },
        adapter(config) {
          adapterCalled = true;
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
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown instanceof AxiosError, 'must be AxiosError');
    assert.strictEqual(thrown.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
    assert.strictEqual(adapterCalled, false);
  });
});
