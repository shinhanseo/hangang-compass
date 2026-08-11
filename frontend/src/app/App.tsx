import { useEffect, useState } from "react";

import { CreateMeetingPage } from "../pages/create-meeting/CreateMeetingPage";
import { HostMeetingPage } from "../pages/host-meeting/HostMeetingPage";
import { JoinMeetingPage } from "../pages/join-meeting/JoinMeetingPage";

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const host = path.match(/^\/host\/([^/]+)$/u);
  const join = path.match(/^\/join\/([^/]+)$/u);
  if (host) return <HostMeetingPage meetingId={host[1]!} />;
  if (join) return <JoinMeetingPage inviteToken={join[1]!} />;
  return <CreateMeetingPage />;
}
