/**
 * Mic settings for voice calls. With echo cancellation on, Android switches to its phone-call
 * audio mode; on the phone tested, her voice crackled in that mode and played clean without
 * it. The call is half-duplex (mic closed while she speaks), so it does not need the phone's
 * echo canceller.
 */
export const CALL_MIC: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};
