export interface Participant {
  id: string;
  alias: string;
  origin: {
    placeId: string;
    placeName: string;
  };
}

export interface Meeting {
  id: string;
  meetingAt: string;
  inviteTokenHash: string;
  hostTokenHash: string;
  participants: Participant[];
  confirmedParkId: string | null;
}
