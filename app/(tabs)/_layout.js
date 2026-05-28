import { Tabs } from 'expo-router';

export default function LayoutTabs() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { display: 'none' }, // Oculta la barra de pestañas abajo
      tabBarHideOnKeyboard: true,       // Oculta la barra si se abre el teclado
    }}>

      {/* 📁 PANTALLA 1: Chats */}
      <Tabs.Screen 
        name="chats/index" 
        options={{ title: 'Laboratorio Chat' }} 
      />
            
      {/* 📁 PANTALLA 2: Historias con Kotlin */}
      <Tabs.Screen 
        name="homekotlin/index" 
        options={{ title: 'Laboratorio historias con kotlin' }} 
      />

    </Tabs>
  );
}