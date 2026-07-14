/**
 * Injectable wall-clock abstraction for retention, GDPR, and other scheduled work.
 * @returns Current instant
 */
export type Clock = () => Date;

/** Default {@link Clock} backed by `new Date()`. */
export const systemClock: Clock = () => new Date();
