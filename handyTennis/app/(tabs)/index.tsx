import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Gyroscope, GyroscopeMeasurement } from 'expo-sensors';

// Typisierung für die Gyroskop-Daten
type GyroData = { x: number; y: number; z: number };

// Funktion zum Konvertieren von GyroData in einen lesbaren String
const toFixedString = (value: number) => value.toFixed(3);

export default function HomeScreen() {
  // State für die Gyroskop-Daten
  const [data, setData] = useState<GyroData>({ x: 0, y: 0, z: 0 });
  // State für die Sensor-Verfügbarkeit
  const [isAvailable, setIsAvailable] = useState<boolean>(false);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const subscribe = async () => {
      // 1. Verfügbarkeit prüfen
      const available = await Gyroscope.isAvailableAsync();
      setIsAvailable(available);

      if (available) {
        // 2. Update-Intervall setzen (100ms = 10 Updates pro Sekunde)
        // Du kannst dies auf 16 (ca. 60 FPS) setzen für flüssigere Updates, 
        // aber 100 ist gut für eine lesbare Anzeige.
        Gyroscope.setUpdateInterval(100);

        // 3. Listener registrieren und Daten aktualisieren
        subscription = Gyroscope.addListener((gyroscopeData: GyroscopeMeasurement) => {
          // Daten direkt speichern
          setData(gyroscopeData);
        });
      }
    };

    subscribe();

    // 4. Cleanup-Funktion: Listener entfernen beim Unmount der Komponente
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []); // Leeres Array sorgt dafür, dass die Funktion nur einmal beim Mounten ausgeführt wird

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gyro-Sensor-Monitor</Text>
      <Text style={styles.subtitle}>Aktuelle Rotationsrate (rad/s)</Text>

      {/* BLOCK FÜR DIE GYROSKOP-DATEN */}
      <View style={styles.dataCard}>
        {!isAvailable ? (
          <Text style={styles.errorText}>
            Gyroscope ist auf diesem Gerät nicht verfügbar.
          </Text>
        ) : (
          <View style={styles.dataContainer}>
            <Text style={styles.dataText}>
              X-Achse (Pitch): <Text style={styles.dataValue}>{toFixedString(data.x)}</Text>
            </Text>
            <Text style={styles.dataText}>
              Y-Achse (Roll): <Text style={styles.dataValue}>{toFixedString(data.y)}</Text>
            </Text>
            <Text style={styles.dataText}>
              Z-Achse (Yaw): <Text style={styles.dataValue}>{toFixedString(data.z)}</Text>
            </Text>
            <Text style={styles.infoText}>
                Update-Intervall: 100 ms
            </Text>
          </View>
        )}
      </View>
      {/* ENDE BLOCK FÜR DIE GYROSKOP-DATEN */}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Heller Hintergrund
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: '#666',
  },
  dataCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  dataContainer: {
    gap: 10,
  },
  dataText: {
    fontSize: 16,
    color: '#333',
  },
  dataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF', // Blau für die Werte
  },
  infoText: {
      marginTop: 10,
      fontSize: 12,
      color: '#999',
      textAlign: 'center',
  },
  errorText: {
      color: 'red',
      fontWeight: 'bold',
      textAlign: 'center',
      fontSize: 16,
  }
});
