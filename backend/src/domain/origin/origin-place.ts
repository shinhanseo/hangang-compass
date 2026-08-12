export interface OriginPlace {
  id: string;
  name: string;
}

export interface OriginPlaceSearchItem extends OriginPlace {
  address: string;
  category: string;
}
