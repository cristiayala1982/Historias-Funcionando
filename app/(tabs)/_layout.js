import { Tabs } from 'expo-router';

export default function LayoutTabs() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { display: 'none' }, // Oculta la barra de pestañas abajo
      tabBarHideOnKeyboard: true,       // Oculta la barra si se abre el teclado
    }}>

      {/* 📁 PANTALLA 1: Historias HLS */}
      <Tabs.Screen 
        name="home3/index" 
        options={{ title: 'Laboratorio Historias HLS' }} 
      />

      {/* 📁 PANTALLA 2: Chats */}
      <Tabs.Screen 
        name="chats/index" 
        options={{ title: 'Laboratorio Chat' }} 
      />

    </Tabs>
  );
}