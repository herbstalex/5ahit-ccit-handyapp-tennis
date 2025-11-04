import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Pedometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function FitnessTracker() {
  const [stepCount, setStepCount] = useState(0);
  const [location, setLocation] = useState(null);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [deviceIP, setDeviceIP] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Schrittzähler initialisieren
  useEffect(() => {
    let subscription;

    const subscribeToPedometer = async () => {
      const isAvailable = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(String(isAvailable));

      if (isAvailable) {
        subscription = Pedometer.watchStepCount(result => {
          setStepCount(result.steps);
        });
      }
    };

    subscribeToPedometer();

    return () => {
      if (subscription) {
        subscription.remove();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fitness Tracker</Text>
        <Text style={styles.subtitle}>Schritte & GPS</Text>
      </View>

      {/* Schrittzähler Anzeige */}
      <View style={styles.stepContainer}>
        <Text style={styles.stepLabel}>Schritte heute</Text>
        <Text style={styles.stepCount}>{stepCount}</Text>
        <Text style={styles.deviceInfo}>
          IP: {deviceIP || 'Wird geladen...'}
        </Text>
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

      {/* Status Info */}
      <Text style={styles.statusText}>
        Schrittzähler: {isPedometerAvailable === 'true' ? '✅' : '❌'} | 
        GPS: {location ? '✅' : '⏳'}
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
  mapContainer: {
    height: 300,
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
  },
  saveButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusText: {
    textAlign: 'center',
    marginTop: 15,
    fontSize: 12,
    color: '#999',
  },
});