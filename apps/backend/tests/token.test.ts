import { signSessionToken, verifySessionToken, looksLikeJwt } from '../src/lib/token';

describe('session tokens', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  it('round-trips a signed token back to its subject', () => {
    const token = signSessionToken(userId);
    const claims = verifySessionToken(token);
    expect(claims).not.toBeNull();
    expect(claims!.sub).toBe(userId);
    expect(claims!.typ).toBe('session');
  });

  it('rejects a tampered payload', () => {
    const token = signSessionToken(userId);
    const [, sig] = token.split('.');
    // Forge a different subject but keep the original signature.
    const forgedBody = Buffer.from(
      JSON.stringify({ sub: 'attacker', typ: 'session', iat: 1 }),
    ).toString('base64url');
    expect(verifySessionToken(`${forgedBody}.${sig}`)).toBeNull();
  });

  it('rejects a token signed with the wrong key', () => {
    // A well-formed body with a garbage signature must not verify.
    const body = Buffer.from(JSON.stringify({ sub: userId, typ: 'session', iat: 1 })).toString(
      'base64url',
    );
    expect(verifySessionToken(`${body}.not-a-real-signature`)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('only-one-part')).toBeNull();
    expect(verifySessionToken('a.b.c')).toBeNull();
  });

  it('distinguishes JWTs (3 parts) from our session tokens (2 parts)', () => {
    expect(looksLikeJwt(signSessionToken(userId))).toBe(false);
    expect(looksLikeJwt('header.payload.signature')).toBe(true);
  });
});
