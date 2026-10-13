import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGeoCity } from '../src/utils/geoCityResolver.js';
import { requestCoordinates } from '../src/services/geolocationService.js';

test('Khujand matches Russian and Tajik aliases in service dictionary', () => {
  assert.equal(resolveGeoCity(40.28256, 69.62216, ['Худжанд', 'Душанбе']), 'Худжанд');
  assert.equal(resolveGeoCity(40.28256, 69.62216, ['Хуҷанд']), 'Хуҷанд');
});

test('Browser request forwards success and permission refusal', async () => {
  const coords = { latitude: 40.28256, longitude: 69.62216 };
  assert.deepEqual(await requestCoordinates({ win: {}, nav: { geolocation: { getCurrentPosition(success) { success({ coords }); } } } }), coords);
  await assert.rejects(requestCoordinates({ win: {}, nav: { geolocation: { getCurrentPosition(success, fail) { fail({ code: 1 }); } } } }), error => error.code === 1);
});
test('Telegram automatic access requires existing permission; explicit button uses native manager', async () => {
  let calls = 0;
  const manager = { isInited: true, isLocationAvailable: true, isAccessGranted: false,
    getLocation(callback) { calls++; callback({ latitude: 40, longitude: 69, horizontal_accuracy: 10 }); } };
  const win = { Telegram: { WebApp: { initData: 'test', LocationManager: manager } } };
  await assert.rejects(requestCoordinates({ win, nav: {}, automatic: true }), error => error.code === 'ACTION_REQUIRED');
  assert.equal(calls, 0);
  assert.deepEqual(await requestCoordinates({ win, nav: {} }), { latitude: 40, longitude: 69, accuracy: 10 });
  assert.equal(calls, 1);
});
test('Dushanbe and international city matching', () => {
  assert.equal(resolveGeoCity(38.53575, 68.77905, ['Душанбе']), 'Душанбе');
  assert.equal(resolveGeoCity(41.26465, 69.21627, ['Ташкент']), 'Ташкент');
  assert.equal(resolveGeoCity(61.25, 73.41667, ['Сургут']), 'Сургут');
});
test('No wrong distant departure or unsupported city', () => {
  assert.equal(resolveGeoCity(40.28256, 69.62216, ['Душанбе']), null);
  assert.equal(resolveGeoCity(0, 0, ['Худжанд']), null);
  assert.equal(resolveGeoCity(40.28256, 69.62216, []), null);
});
test('Malformed and imprecise coordinates are rejected', () => {
  for (const [lat, lon, accuracy] of [[null, 69], ['40', 69], [NaN, 69], [91, 0], [0, 181], [40.28256,69.62216,10001]])
    assert.equal(resolveGeoCity(lat, lon, ['Худжанд'], accuracy), null);
});
