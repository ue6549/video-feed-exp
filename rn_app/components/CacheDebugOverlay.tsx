import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CacheManager from '../services/CacheManager';
import { AppConfig } from '../config/AppConfig';

interface CacheDebugOverlayProps {
  currentVideoUrl?: string;
}

export const CacheDebugOverlay: React.FC<CacheDebugOverlayProps> = ({ currentVideoUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [proxyStatus, setProxyStatus] = useState('Unknown');
  const [currentVideoStatus, setCurrentVideoStatus] = useState<string>('N/A');

  useEffect(() => {
    const updateStats = async () => {
      try {
        const size = await CacheManager.getTotalCacheSize();
        setCacheSize(size);
        
        const status = CacheManager.getInitializationStatus();
        setProxyStatus(status ? 'Running ✅' : 'Stopped ❌');
        
        if (currentVideoUrl) {
          const videoStatus = await CacheManager.getCacheStatus(currentVideoUrl);
          setCurrentVideoStatus(
            videoStatus.isCached 
              ? `HIT (${(videoStatus.cachedBytes / 1024 / 1024).toFixed(2)} MB)` 
              : 'MISS'
          );
        }
      } catch (error) {
        console.error('Cache debug overlay error:', error);
      }
    };
    
    updateStats();
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [currentVideoUrl]);

  // Only show in debug mode when logging is enabled
  if (!AppConfig.config.logging.enabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={() => setIsExpanded(!isExpanded)} 
        style={styles.header}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>📦 Cache {isExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.stat}>Proxy: {proxyStatus}</Text>
          <Text style={styles.stat}>
            Size: {(cacheSize / 1024 / 1024).toFixed(2)} MB
          </Text>
          {currentVideoUrl && (
            <Text style={styles.stat} numberOfLines={1}>
              Current: {currentVideoStatus}
            </Text>
          )}
          <TouchableOpacity 
            onPress={async () => {
              try {
                await CacheManager.clearAllCache();
                setCacheSize(0);
                setCurrentVideoStatus('N/A');
              } catch (error) {
                console.error('Failed to clear cache:', error);
              }
            }}
            style={styles.clearButton}
            activeOpacity={0.8}
          >
            <Text style={styles.clearButtonText}>Clear Cache</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 8,
    minWidth: 180,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    padding: 4,
  },
  headerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  stat: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Menlo',
  },
  clearButton: {
    marginTop: 8,
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CacheDebugOverlay;

