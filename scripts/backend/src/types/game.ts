export interface Game {
  id: string;
  name: string;
  rating: number | null;
  released: string | null;
  background_image: string | null;
  platforms: string[];
}

export interface GameQuery {
  limit: number;
  offset: number;
  search?: string;
}
