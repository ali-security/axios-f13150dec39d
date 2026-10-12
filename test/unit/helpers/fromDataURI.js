import assert from 'assert';
import fromDataURI from '../../../lib/helpers/fromDataURI.js';

describe('helpers::fromDataURI', function () {
  it('should return buffer from data uri', function () {
    const buffer = Buffer.from('123');

    const dataURI = 'data:application/octet-stream;base64,' + buffer.toString('base64');

    assert.deepStrictEqual(fromDataURI(dataURI, false), buffer);
  });

  it('should reject a media type containing more than one slash', function () {
    assert.throws(
      () => {
        fromDataURI('data:text/plain/extra,hello', false);
      },
      (err) => err.code === 'ERR_INVALID_URL'
    );
  });

  it('should reject a long malformed media type within the test timeout', function () {
    this.timeout(1000);

    assert.throws(
      () => {
        fromDataURI(`data:${'a/'.repeat(50000)}invalid`, false);
      },
      (err) => err.code === 'ERR_INVALID_URL'
    );
  });

  it('should reject a long run of slashes without a comma within the test timeout', function () {
    this.timeout(1000);

    assert.throws(
      () => {
        fromDataURI('data:' + '/'.repeat(262139), false);
      },
      (err) => err.code === 'ERR_INVALID_URL'
    );
  });
});
