module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|recyclerlistview|eventemitter3|@d11|react-native-fs)/)',
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  collectCoverageFrom: [
    'rn_app/**/*.{ts,tsx}',
    '!rn_app/**/*.d.ts',
    '!rn_app/**/index.{ts,tsx}',
  ],
};
