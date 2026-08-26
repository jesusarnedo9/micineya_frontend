import { View, Text, StyleSheet, Dimensions, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../api/client';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons'; // Íconos incluidos en Expo

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

interface Pelicula {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  videoKey?: string; // ¡El nuevo campo que agregaste en el backend!
}

export default function HomeScreen() {
  const [peliculas, setPeliculas] = useState<Pelicula[]>([]);
  const [cargando, setCargando] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0); // Para saber qué Reel está en pantalla

  useEffect(() => {
    cargarFeed();
  }, []);

  const cargarFeed = async () => {
    try {
      // Para probar el feed infinito, arrancamos con las populares
      const res = await apiClient.get('/api/peliculas/populares');
      setPeliculas(res.data.results || res.data);
    } catch (error) {
      console.error("Error al cargar feed:", error);
    } finally {
      setCargando(false);
    }
  };

  // Esta función mágica detecta cuando deslizás y cambiás de película
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50 // Se activa cuando el reel ocupa la mitad de la pantalla
  });

  const renderReel = ({ item, index }: { item: Pelicula, index: number }) => {
    const isPlaying = index === activeIndex;

    return (
      <View style={styles.reelContainer}>
        
        {/* ZONA DE VIDEO O PÓSTER */}
        <View style={styles.videoWrapper} pointerEvents="none">
          {item.videoKey ? (
            <YoutubePlayer
              height={WINDOW_WIDTH * (9 / 16)} // Proporción cinematográfica 16:9
              width={WINDOW_WIDTH}
              videoId={item.videoKey}
              play={isPlaying} // Solo se reproduce si es el video activo
              initialPlayerParams={{
                controls: false, // Escondemos los controles de YouTube
                loop: true,
                modestbranding: true,
                rel: false
              }}
            />
          ) : (
            <Image 
              source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }} 
              style={styles.posterFallback} 
            />
          )}
        </View>

        {/* INTERFAZ FLOTANTE (OVERLAY) */}
        <View style={styles.overlay}>
          <View style={styles.movieInfo}>
            <Text style={styles.movieTitle}>{item.title}</Text>
            <Text style={styles.movieOverview} numberOfLines={3}>{item.overview}</Text>
          </View>

          {/* Botonera lateral derecha estilo TikTok */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="add-circle-outline" size={40} color="white" />
              <Text style={styles.iconText}>Guardar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton}>
              <Text style={styles.pochocloIcon}>🍿</Text>
              <Text style={styles.iconText}>La vi</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="star-outline" size={35} color="white" />
              <Text style={styles.iconText}>Puntuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={{ color: 'white' }}>Buscando tu próxima película...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={peliculas}
        renderItem={renderReel}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled // ¡ESTA ES LA MAGIA DEL SWIPE!
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        snapToAlignment="start"
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loaderContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 10 },
  reelContainer: {
    height: WINDOW_HEIGHT,
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterFallback: {
    width: WINDOW_WIDTH,
    height: WINDOW_WIDTH * (16 / 9),
    resizeMode: 'cover',
    opacity: 0.8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 40, // Espacio para la barra de navegación del celular
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  movieInfo: {
    flex: 1,
    paddingRight: 20,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    marginBottom: 10,
  },
  movieOverview: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
  actionButtons: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 25,
    paddingBottom: 20,
  },
  iconButton: {
    alignItems: 'center',
    gap: 5,
  },
  iconText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pochocloIcon: {
    fontSize: 32,
  }
});