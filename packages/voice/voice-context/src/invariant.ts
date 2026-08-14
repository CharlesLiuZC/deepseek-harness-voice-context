/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-voice-context`.
 * @module @deepseek-ai/dsh-voice-context/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-voice-context'

/** Cordis companion plugin name. */
export const name = 'voice-context-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the service owns no durable state, emits no cordis
 * events, and holds no cross-plugin mutable state — transcription is stateless
 * and the credential is resolved per call through the credentials seam. The
 * local backend is a child process whose health is the authoritative signal.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
