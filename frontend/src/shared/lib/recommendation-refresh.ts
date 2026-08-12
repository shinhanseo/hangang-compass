export const MAX_RECOMMENDATION_REFRESH_TIMER_MS = 60 * 60_000;
export const ARRIVAL_FORECAST_WINDOW_MS = 12 * 60 * 60_000;

export function isOutsideArrivalForecastWindow(meetingAt: string, now = Date.now()): boolean {
  const target = new Date(meetingAt).getTime();
  return Number.isFinite(target) && target - now > ARRIVAL_FORECAST_WINDOW_MS;
}

export function nextRecommendationRefreshDelay(refreshAt: string, now = Date.now()): number {
  const remaining = new Date(refreshAt).getTime() - now;
  return remaining <= 0 ? 1_000 : Math.min(remaining, MAX_RECOMMENDATION_REFRESH_TIMER_MS);
}
