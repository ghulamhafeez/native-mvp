import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';

// The actual app lives in the root e:\native-mvp project.
// This folder (native-mvp-frontend) is unused.
export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text>See root project for the actual app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
