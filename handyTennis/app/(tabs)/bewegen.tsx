import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function FitnessTracker() {
  const [stepCount, setStepCount] = useState(0);
  const [location, setLocation] = useState(null);
  const [deviceIP, setDeviceIP] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sensorStatus, setSensorStatus] = useState('Initialisiere...');

  // Referenzen für Schritt-Erkennung
  const lastStepTime = useRef(Date.now());
  const accelerationHistory = useRef([]);
  const stepThreshold = useRef(1.3); // Schwellenwert für Schritterkennung (empfindlicher)
  const gravityFilter = useRef({ x: 0, y: 0, z: 0 }); // Gleitender Durchschnitt für Gravitation

  // Schrittzähler mit Accelerometer
  useEffect(() => {
    let accelerometerSubscription;
    
    const startStepDetection = async () => {
      try {
        // Setze Aktualisierungsrate (100ms = 10Hz)
        Accelerometer.setUpdateInterval(100);

        accelerometerSubscription = Accelerometer.addListener(({ x, y, z }) => {
          // Low-Pass Filter für Gravitation (gleitender Durchschnitt)
          const alpha = 0.8; // Filterstärke (0.8 = starke Glättung)
          gravityFilter.current.x = alpha * gravityFilter.current.x + (1 - alpha) * x;
          gravityFilter.current.y = alpha * gravityFilter.current.y + (1 - alpha) * y;
          gravityFilter.current.z = alpha * gravityFilter.current.z + (1 - alpha) * z;

          // Entferne Gravitation (High-Pass Filter)
          const linearAccelX = x - gravityFilter.current.x;
          const linearAccelY = y - gravityFilter.current.y;
          const linearAccelZ = z - gravityFilter.current.z;

          // Berechne die Magnitude der linearen Beschleunigung (ohne Gravitation)
          const acceleration = Math.sqrt(
            linearAccelX * linearAccelX + 
            linearAccelY * linearAccelY + 
            linearAccelZ * linearAccelZ
          );

          // Füge zur History hinzu (letzte 10 Werte für bessere Glättung)
          accelerationHistory.current.push(acceleration);
          if (accelerationHistory.current.length > 10) {
            accelerationHistory.current.shift();
          }

          // Erkenne Schritte nur wenn genug Daten vorhanden
          if (accelerationHistory.current.length === 10) {
            const current = accelerationHistory.current[5]; // Mittlerer Wert
            const prev1 = accelerationHistory.current[4];
            const prev2 = accelerationHistory.current[3];
            const next1 = accelerationHistory.current[6];
            const next2 = accelerationHistory.current[7];

            // Peak-Erkennung: Deutlicher Berg in den Daten
            const isPeak = 
              current > stepThreshold.current &&
              current > prev1 && 
              current > next1;

            // Zeitfilter: Mindestens 250ms zwischen Schritten
            const timeSinceLastStep = Date.now() - lastStepTime.current;

            if (isPeak && timeSinceLastStep > 250) {
              console.log('🚶 Schritt erkannt! Beschleunigung:', current.toFixed(2), 'm/s²');
              lastStepTime.current = Date.now();
              setStepCount(prev => prev + 1);
            }
          }
        });

        setSensorStatus('✅ Aktiv');
        console.log('✅ Schrittzähler gestartet - Threshold:', stepThreshold.current);
      } catch (error) {
        console.error('Fehler beim Starten des Accelerometers:', error);
        setSensorStatus('❌ Fehler');
      }
    };

    startStepDetection();

    return () => {
      if (accelerometerSubscription) {
        accelerometerSubscription.remove();
      }
    };
  }, []);

  // GPS-Location initialisieren
  useEffect(() => {
    let locationSubscription;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Berechtigung verweigert', 'GPS-Zugriff wurde nicht gewährt');
          return;
        }

        // Aktuelle Position abrufen
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        // Position kontinuierlich aktualisieren
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        );
      } catch (error) {
        Alert.alert('Fehler', 'GPS konnte nicht gestartet werden');
        console.error(error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // IP-Adresse abrufen
  useEffect(() => {
    const getIP = async () => {
      try {
        const ip = await Network.getIpAddressAsync();
        setDeviceIP(ip);
      } catch (error) {
        console.error('Fehler beim Abrufen der IP:', error);
      }
    };

    getIP();
  }, []);

  // Daten in Datenbank speichern
  const saveToDatabase = async () => {
    if (!location) {
      Alert.alert('Fehler', 'GPS-Position noch nicht verfügbar');
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('fitness_tracking')
        .insert([
          {
            device_ip: deviceIP || 'unknown',
            step_count: stepCount,
            gps_latitude: location.latitude,
            gps_longitude: location.longitude,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        throw error;
      }

      Alert.alert('Erfolg', `Daten gespeichert!\nSchritte: ${stepCount}\nPosition: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    } catch (error) {
      Alert.alert('Fehler', `Speichern fehlgeschlagen: ${error.message}`);
      console.error('Speicherfehler:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Schritte zurücksetzen
  const resetSteps = () => {
    Alert.alert(
      'Schritte zurücksetzen?',
      'Möchtest du den Schrittzähler auf 0 setzen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Zurücksetzen', 
          style: 'destructive',
          onPress: () => {
            setStepCount(0);
            console.log('🔄 Schrittzähler zurückgesetzt');
          }
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fitness Tracker</Text>
        <Text style={styles.subtitle}>Accelerometer Schrittzähler</Text>
      </View>

      {/* Schrittzähler Anzeige */}
      <View style={styles.stepContainer}>
        <Text style={styles.stepLabel}>Schritte (seit App-Start)</Text>
        <Text style={styles.stepCount}>{stepCount}</Text>
        <Text style={styles.deviceInfo}>
          Sensor: {sensorStatus} | IP: {deviceIP || 'Lädt...'}
        </Text>
        <TouchableOpacity style={styles.resetButton} onPress={resetSteps}>
          <Text style={styles.resetButtonText}>🔄 Zurücksetzen</Text>
        </TouchableOpacity>
      </View>

      {/* Karte */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView style={styles.map} region={location} showsUserLocation>
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              title="Deine Position"
              description={`Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`}
            />
          </MapView>
        ) : (
          <View style={styles.loadingMap}>
            <Text style={styles.loadingText}>GPS wird geladen...</Text>
          </View>
        )}
      </View>

      {/* GPS Koordinaten */}
      {location && (
        <View style={styles.coordsContainer}>
          <Text style={styles.coordsText}>
            📍 Lat: {location.latitude.toFixed(6)} | Lng: {location.longitude.toFixed(6)}
          </Text>
        </View>
      )}

      {/* Speichern Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={saveToDatabase}
        disabled={isSaving || !location}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? '💾 Speichert...' : '💾 Daten Speichern'}
        </Text>
      </TouchableOpacity>

      {/* Info Text */}
      <Text style={styles.infoText}>
        💡 Gehe mit dem Handy in der Hand oder Tasche, um Schritte zu zählen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  stepContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  stepLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  stepCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  deviceInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
  },
  resetButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#FF9800',
    borderRadius: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    height: 250,
    marginHorizontal: 20,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 15,
  },
  map: {
    flex: 1,
  },
  loadingMap: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  coordsContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  coordsText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 15,
  },
  saveButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginHorizontal: 40,
  },
});