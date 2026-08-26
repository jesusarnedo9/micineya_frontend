import { Redirect } from 'expo-router';

export default function Index() {
  // Por ahora, apenas abrimos la app, pateamos al usuario al Login. 
  // Más adelante acá leeremos el token para decidir si va al Login o al Catálogo.
  return <Redirect href="/(auth)/login" />;
}