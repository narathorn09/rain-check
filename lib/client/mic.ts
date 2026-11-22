/**
 * Mic settings for voice calls. With echo cancellation on, Android switches to its phone-call
 * audio mode; on the phone tested, her voice crackled whenever the mic was open (sound test F)
 * and played clean otherwise. The call is half-duplex (mic closed while she speaks), so it does
 * not need the phone's echo canceller.
 */
export const CALL_MIC: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/** The earlier call settings, kept so the sound test can compare the two. */
export const CALL_MIC_PROCESSED: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
