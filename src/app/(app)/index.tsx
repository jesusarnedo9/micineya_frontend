import { MovieReelFeed } from '../../components/reels/movie-reel-feed';
import { useAppExperience } from '../../context/app-experience';

export default function RecommendedScreen() {
  const { loadRecommendations, recommendationsVersion } = useAppExperience();

  return (
    <MovieReelFeed
      key={recommendationsVersion}
      emptyMessage="Elegí tus géneros favoritos para recibir recomendaciones."
      label="Para vos"
      loader={loadRecommendations}
      maxItems={10}
    />
  );
}
