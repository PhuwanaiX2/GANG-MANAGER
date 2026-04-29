import { describe, expect, it } from 'vitest';
import { resolveHealthPort } from '../src/utils/healthPort';

describe('resolveHealthPort', () => {
    it('uses BOT_PORT when it is valid', () => {
        expect(resolveHealthPort({ BOT_PORT: '9000', PORT: '8081' })).toEqual({
            port: 9000,
            source: 'BOT_PORT',
            ignoredInvalidKeys: [],
        });
    });

    it('falls back to PORT when BOT_PORT is invalid', () => {
        expect(resolveHealthPort({ BOT_PORT: 'not-a-port', PORT: '8081' })).toEqual({
            port: 8081,
            source: 'PORT',
            ignoredInvalidKeys: ['BOT_PORT'],
        });
    });

    it('uses the default port when no port is provided', () => {
        expect(resolveHealthPort({})).toEqual({
            port: 8080,
            source: 'default',
            ignoredInvalidKeys: [],
        });
    });

    it('ignores out-of-range ports and falls back safely', () => {
        expect(resolveHealthPort({ BOT_PORT: '70000', PORT: '0' })).toEqual({
            port: 8080,
            source: 'default',
            ignoredInvalidKeys: ['BOT_PORT', 'PORT'],
        });
    });
});
