export interface Participant {
  id: string;
  alias: string;
  origin: {
    placeId: string;
    placeName: string;
  };
  destination?: {
    placeId: string;
    placeName: string;
  } | null;
}

export type TripMode = "outbound_only" | "round_trip";

export interface Meeting {
  id: string;
  meetingAt: string;
  tripMode: TripMode;
  inviteTokenHash: string;
  hostTokenHash: string;
  participants: Participant[];
  confirmedParkId: string | null;
}
