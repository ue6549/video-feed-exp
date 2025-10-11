// Extend Jest with React Native Testing Library matchers
import '@testing-library/react-native/extend-expect';

// Mock native modules
jest.mock('./rn_app/components/VideoPlayerView', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => {
      const { View } = require('react-native');
      return React.createElement(View, { testID: 'VideoPlayerView', ...props });
    }),
  };
});

jest.mock('./rn_app/services/CacheManager', () => ({
  setupCache: jest.fn(() => Promise.resolve()),
  getCacheStatus: jest.fn(() => Promise.resolve({ isCached: false, cachedBytes: 0 })),
  getTotalCacheSize: jest.fn(() => Promise.resolve(0)),
  clearCache: jest.fn(() => Promise.resolve()),
}));

// Mock FastImage
jest.mock('@d11/react-native-fast-image', () => {
  const React = require('react');
  const { Image } = require('react-native');
  
  const FastImageComponent = React.forwardRef((props, ref) => React.createElement(Image, props));
  
  FastImageComponent.priority = {
    low: 'low',
    normal: 'normal',
    high: 'high',
  };
  
  FastImageComponent.cacheControl = {
    immutable: 'immutable',
    web: 'web',
    cacheOnly: 'cacheOnly',
  };
  
  return {
    __esModule: true,
    default: FastImageComponent,
  };
});

// Mock Animated
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
  };
});

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/cache',
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('')),
  unlink: jest.fn(() => Promise.resolve()),
  exists: jest.fn(() => Promise.resolve(true)),
}));

// Mock RecyclerListView
jest.mock('recyclerlistview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    RecyclerListView: React.forwardRef((props, ref) => React.createElement(View, { testID: 'RecyclerListView' })),
    DataProvider: class DataProvider {
      constructor(rowHasChanged) {
        this.rowHasChanged = rowHasChanged;
      }
      cloneWithRows(data) {
        return this;
      }
      getSize() {
        return 0;
      }
    },
    LayoutProvider: class LayoutProvider {
      constructor(getLayoutTypeForIndex, setLayoutForType) {}
    },
  };
});

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  currentState: 'active',
}));

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

