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

export type TravelPattern = "shared_origin" | "individual_round_trip";

export interface Meeting {
  id: string;
  meetingAt: string;
  travelPattern: TravelPattern;
  sharedOrigin: {
    placeId: string;
    placeName: string;
  } | null;
  inviteTokenHash: string;
  hostTokenHash: string;
  participants: Participant[];
  confirmedParkId: string | null;
}
