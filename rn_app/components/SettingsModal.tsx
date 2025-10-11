import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Dimensions,
} from 'react-native';
import { AppConfig, AppConfigType } from '../config/AppConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const [config, setConfig] = useState<AppConfigType>(AppConfig.config);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (visible) {
      setConfig(AppConfig.config);
      setHasChanges(false);
    }
  }, [visible]);

  const handleConfigChange = (path: string, value: any) => {
    const newConfig = { ...config };
    const keys = path.split('.');
    let current = newConfig as any;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    const requiresReload = AppConfig.update(config);
    
    if (requiresReload) {
      Alert.alert(
        'Reload Required',
        'Some changes require an app reload to take effect. Would you like to reload now?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Reload', onPress: () => {
            // In a real app, this would trigger a reload
            console.log('App reload required');
            onClose();
          }},
        ]
      );
    } else {
      Alert.alert('Success', 'Settings saved successfully!');
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: () => {
          AppConfig.reset();
          setConfig(AppConfig.config);
          setHasChanges(false);
        }},
      ]
    );
  };

  const renderNumberInput = (path: string, label: string, min?: number, max?: number) => {
    // Get value from path
    const getValue = (obj: any, path: string) => {
      return path.split('.').reduce((acc, key) => acc?.[key], obj);
    };
    
    const currentValue = getValue(config, path);
    
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.numberInput}
          value={currentValue?.toString() || ''}
          onChangeText={(text) => {
            const value = parseInt(text) || 0;
            if ((!min || value >= min) && (!max || value <= max)) {
              handleConfigChange(path, value);
            }
          }}
          keyboardType="numeric"
          placeholder={label}
        />
      </View>
    );
  };

  const renderSwitch = (path: string, label: string) => {
    const getValue = (obj: any, path: string) => {
      return path.split('.').reduce((acc, key) => acc?.[key], obj);
    };
    
    const currentValue = getValue(config, path);
    
    return (
      <View style={styles.switchGroup}>
        <Text style={styles.label}>{label}</Text>
        <Switch
          value={currentValue as boolean}
          onValueChange={(value) => handleConfigChange(path, value)}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Feed Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Feed Settings</Text>
            
            {renderNumberInput('feed.maxContentWidth', 'Max Content Width (px)', 300, 1200)}
            
            {renderNumberInput('feed.firstPageSize', 'First Page Size', 5, 20)}
            
            {renderNumberInput('feed.subsequentPageSize', 'Subsequent Page Size', 5, 20)}
          </View>

          {/* Performance Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance</Text>
            
            {renderSwitch('performance.isLowEndDevice', 'Low-end Device Mode')}
            
            {renderSwitch('performance.autoplayOnLowEnd', 'Autoplay on Low-end')}
          </View>

          {/* Prefetch Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prefetch</Text>
            
            {renderSwitch('prefetch.enabled', 'Enable Prefetching')}
            
            {renderSwitch('prefetch.vodOnly', 'VOD Only')}
            
            {renderNumberInput('prefetch.segmentCount', 'Segment Count', 1, 10)}
            
            {renderNumberInput('prefetch.maxConcurrent', 'Max Concurrent', 1, 5)}
          </View>

          {/* Cache Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache</Text>
            
            {renderNumberInput('cache.maxSizeMB', 'Max Cache Size (MB)', 50, 2000)}
          </View>

          {/* Playback Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Playback</Text>
            
            {renderNumberInput('playback.previewDuration', 'Preview Duration (s)', 10, 120)}
            
            {renderSwitch('playback.sequencingEnabled', 'Enable Sequencing')}
            
            {renderSwitch('playback.rotateToSoftPlay', 'Rotate to Soft Play')}
          </View>

          {/* Offline Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Offline</Text>
            
            {renderSwitch('offline.mockOfflineMode', 'Mock Offline Mode')}
            
            {renderSwitch('offline.showOnlyCachedVideos', 'Show Only Cached Videos')}
          </View>

          {/* Visibility Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            
            {renderNumberInput('visibility.nativeThrottleMs', 'Native Throttle (ms)', 10, 200)}
            
            {renderNumberInput('visibility.softPlayThreshold', 'Soft Play Threshold (%)', 10, 50)}
            
            {renderNumberInput('visibility.hardPlayThreshold', 'Hard Play Threshold (%)', 30, 80)}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            disabled={!hasChanges}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: '#333',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#333',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsModal;

