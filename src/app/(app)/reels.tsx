import { MovieReelFeed } from '../../components/reels/movie-reel-feed';

export default function ReelsScreen() {
  return (
    <MovieReelFeed
      endpoint="/api/peliculas/populares"
      infinite
      label="Explorar"
    />
  );
}

