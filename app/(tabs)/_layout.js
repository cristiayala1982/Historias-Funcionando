import { Tabs } from 'expo-router';

export default function LayoutTabs() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { display: 'none' }, // Mantiene los botones ocultos
      tabBarHideOnKeyboard: true, 
    }}>
      {/* Dejamos ÚNICAMENTE tu pantalla real de HLS */}
      <Tabs.Screen 
        name="home3/index" 
        options={{ title: 'Historias HLS' }} 
      />
    </Tabs>
  );
}