import { useEffect, useState } from "react";

import { api } from "../../shared/api/http";
import { rememberRecentMeeting } from "../../shared/lib/recent-meetings";
import { AppIcon } from "../../shared/ui/AppIcon";
import { MobileAppBar } from "../../shared/ui/MobileAppBar";

export function RecoverHostPage({ meetingId }: { meetingId: string }) {
  const [error, setError] = useState("");

  useEffect(() => {
    const capabilities = new URLSearchParams(window.location.hash.slice(1));
    const hostToken = capabilities.get("host") ?? "";
    const inviteToken = capabilities.get("invite") ?? "";
    window.history.replaceState({}, "", `/recover/${meetingId}`);
    if (!hostToken || !inviteToken) {
      setError("방장 전용 링크가 완전하지 않거나 이미 주소에서 제거됐어요.");
      return;
    }
    api<{ hostPath: string; meetingAt: string }>(`/api/meetings/${meetingId}/recover`, {
      method: "POST",
      body: JSON.stringify({ hostToken, inviteToken }),
    }).then((result) => {
      rememberRecentMeeting({ id: meetingId, meetingAt: result.meetingAt });
      window.history.replaceState({}, "", result.hostPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }).catch(() => setError("이 방장 전용 링크가 만료됐거나 사용할 수 없어요."));
  }, [meetingId]);

  return <main className="shell app-screen">
    <MobileAppBar />
    {error ? <section className="state-card"><span className="state-icon">!</span><h1>약속을 불러오지 못했어요</h1><p>{error}</p><a className="primary-action" href="/">새 약속 만들기</a></section>
      : <div className="loading-screen"><span><AppIcon name="refresh" /></span><p>방장 약속을 안전하게 불러오는 중…</p></div>}
  </main>;
}
