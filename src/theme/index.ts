// Design tokens matching Chitram mobile app exactly

export const Colors = {
  // Primary palette
  primary: '#7C81FF',
  accent: '#FF9B24',
  secondary: '#00BBAE',

  // Backgrounds
  bgCream: '#FFF8EB',
  bgWhite: '#FFFFFF',

  // Text hierarchy
  textDark: '#1B1B1B',
  textBody: '#424242',
  textMuted: '#9E9E9E',

  // Light backgrounds
  mintLight: '#EBFFFE',
  peachLight: '#FFF0E0',
  lavenderLight: '#EDEEFF',
  roseLight: '#FFF0F0',
  sunshineLight: '#FFF6EB',

  // Semantic colors
  success: '#4CAF82',
  error: '#FF7C7C',
  warning: '#FFB74D',

  // Additional accent colors
  pink: '#FF577B',
  skyBlue: '#00B9F1',
  orange: '#FFA455',

  divider: '#F0EDE8',
  overlay: 'rgba(27, 27, 27, 0.3)',
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  body: 18,
  lg: 22,
  xl: 28,
  xxl: 36,
  hero: 48,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const Shadows = {
  sm: '0 2px 8px rgba(124, 129, 255, 0.05)',
  md: '0 4px 16px rgba(124, 129, 255, 0.08)',
  lg: '0 8px 24px rgba(124, 129, 255, 0.12)',
  glow: '0 0 20px rgba(124, 129, 255, 0.2)',
};

export const theme = {
  Colors,
  FontSizes,
  Spacing,
  Radius,
  Shadows,
};

export default theme;
