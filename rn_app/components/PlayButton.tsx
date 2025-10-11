import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native';

interface PlayButtonProps {
  onPress: () => void;
  size?: number;
  visible?: boolean;
}

const PlayButton: React.FC<PlayButtonProps> = ({ 
  onPress, 
  size = 60, 
  visible = true 
}) => {
  if (!visible) return null;

  return (
    <TouchableOpacity 
      style={[styles.container, { width: size, height: size }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.playIcon, { 
        borderLeftWidth: size * 0.4,
        borderTopWidth: size * 0.25,
        borderBottomWidth: size * 0.25,
      }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3, // Slight offset to center the triangle
  },
});

export default PlayButton;

