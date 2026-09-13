// Best-effort RAM hint from the browser, for pre-filling an editable input -
// never presented as an authoritative reading. `navigator.deviceMemory`
// (Device Memory API) reports total device memory rounded to the nearest
// power of two AND CAPPED AT 8, deliberately, for privacy - a machine with
// 8, 16, 64, or 256 GiB of RAM all report the same "8"
// (developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory). That
// cap makes it fundamentally unable to distinguish the cases this feature's
// bigger DB recommendations actually depend on (14.9+ GiB variants) - it's
// also Chromium-only, unsupported in Firefox/Safari. Returns null when
// unsupported so the UI can say so honestly instead of showing a fake
// default.
export function estimateDeviceMemoryGiB(): number | null {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof deviceMemory === 'number' ? deviceMemory : null
}
