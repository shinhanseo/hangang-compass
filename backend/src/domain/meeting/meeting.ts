export interface Participant {
  id: string;
  alias: string;
  stationId: string;
}

export interface Meeting {
  id: string;
  meetingAt: string;
  inviteTokenHash: string;
  hostTokenHash: string;
  participants: Participant[];
  confirmedParkId: string | null;
}
