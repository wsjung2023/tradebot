import assert from 'node:assert';
import { accountServiceFingerprint } from '../server/utils/kiwoom-cache-key';

const K='appk', S='secr';
// accountType이 다르면 fingerprint가 달라야 함 (이번 버그의 핵심)
const mock = accountServiceFingerprint(K,S,'mock');
const real = accountServiceFingerprint(K,S,'real');
assert.notStrictEqual(mock, real, 'mock vs real fingerprint 달라야 함');
// 같은 타입이면 동일(캐시 재사용)
assert.strictEqual(accountServiceFingerprint(K,S,'mock'), mock, '같은 입력 동일');
// null/undefined/이상값은 mock으로 안전 기본
assert.strictEqual(accountServiceFingerprint(K,S,null), mock, 'null → mock');
assert.strictEqual(accountServiceFingerprint(K,S,undefined), mock, 'undefined → mock');
assert.strictEqual(accountServiceFingerprint(K,S,''), mock, '빈문자 → mock');
assert.strictEqual(accountServiceFingerprint(K,S,'REAL'), mock, '대문자 REAL은 real 아님 → mock(안전)');
console.log('OK: kiwoom-cache-key');
